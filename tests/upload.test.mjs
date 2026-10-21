import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();
const imageFile = { name: 'photo.png', type: 'image/png', size: 1024 };

test('accepts decoded images without fixed format, file size or pixel limits', () => {
  assert.equal(core.validateImageMeta({ ...imageFile, name: 'photo.gif', type: 'image/gif' }, 1200, 1200, 'image').length, 0);
  assert.equal(core.validateImageMeta({ ...imageFile, name: 'photo.avif', type: 'image/avif', size: 100 * 1024 * 1024 }, 5000, 4000, 'image').length, 0);
  assert.equal(core.validateImageMeta({ ...imageFile, name: 'photo.unknown', type: '' }, 100, 100, 'image').length, 0);
});

test('rejects images with invalid decoded dimensions', () => {
  assert.ok(core.validateImageMeta(imageFile, 0, 100, 'image').length);
  assert.ok(core.validateImageMeta(imageFile, 100, Number.NaN, 'image').length);
});

test('accepts rectangular and small decoded QR images', () => {
  assert.equal(core.validateImageMeta({ ...imageFile, type: 'image/gif', size: 25 * 1024 * 1024 }, 180, 90, 'qr').length, 0);
  assert.equal(core.validateImageMeta(imageFile, 1, 1, 'qr').length, 0);
});

test('failed decode and cancelled selection preserve the previous image', async () => {
  const controller = core.createImageSelectionController(async file => {
    if (file.name === 'broken.png') throw new Error('decode failed');
    return { bitmap: { close() {} }, width: 500, height: 500 };
  });
  assert.equal((await controller.select('image', imageFile)).applied, true);
  const previous = controller.current('image');
  assert.equal((await controller.select('image', { ...imageFile, name: 'broken.png' })).applied, false);
  assert.equal(controller.current('image'), previous);
  assert.equal((await controller.select('image', null)).applied, false);
  assert.equal(controller.current('image'), previous);
});

test('a slow old selection cannot overwrite the later selection', async () => {
  let finishOld;
  const controller = core.createImageSelectionController(file => {
    if (file.name === 'old.png') return new Promise(resolve => { finishOld = resolve; });
    return Promise.resolve({ bitmap: { close() {} }, width: 500, height: 500 });
  });
  const oldResult = controller.select('image', { ...imageFile, name: 'old.png' });
  assert.equal((await controller.select('image', { ...imageFile, name: 'new.png' })).applied, true);
  finishOld({ bitmap: { close() {} }, width: 500, height: 500 });
  assert.equal((await oldResult).applied, false);
  assert.equal(controller.current('image').file.name, 'new.png');
});

test('uses successful browser decoding even when file metadata differs', async () => {
  const controller = core.createImageSelectionController(async () => ({ bitmap: { close() {} }, width: 500, height: 400 }));
  const file = { name: 'picture.data', type: 'application/octet-stream', size: 25 * 1024 * 1024 };
  assert.equal((await controller.select('image', file)).applied, true);
  assert.equal((await controller.select('qr', file)).applied, true);
});

test('a stale decode error does not surface after a newer image succeeds', async () => {
  let rejectOld;
  const controller = core.createImageSelectionController(file => file.name === 'old.png'
    ? new Promise((_, reject) => { rejectOld = reject; })
    : Promise.resolve({ bitmap: { close() {} }, width: 500, height: 500 }));
  const pending = controller.select('image', { ...imageFile, name: 'old.png' });
  assert.equal((await controller.select('image', imageFile)).applied, true);
  rejectOld(new Error('read failed'));
  assert.equal((await pending).stale, true);
  assert.equal(controller.current('image').file.name, 'photo.png');
});
