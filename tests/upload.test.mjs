import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();
const imageFile = { name: 'photo.png', type: 'image/png', size: 1024 };

test('accepts supported decoded images within size limits', () => {
  assert.equal(Array.from(core.validateImageMeta(imageFile, 1200, 1200, 'image')).length, 0);
  assert.equal(Array.from(core.validateImageMeta({ ...imageFile, type: 'image/jpeg' }, 1200, 1200, 'image')).length, 0);
  assert.equal(Array.from(core.validateImageMeta({ ...imageFile, type: 'image/webp' }, 1200, 1200, 'image')).length, 0);
});

test('rejects unsupported types, huge files and oversized pixel counts', () => {
  assert.ok(core.validateImageMeta({ ...imageFile, type: 'image/gif' }, 100, 100, 'image').length);
  assert.ok(core.validateImageMeta({ ...imageFile, size: 10 * 1024 * 1024 + 1 }, 100, 100, 'image').length);
  assert.ok(core.validateImageMeta(imageFile, 4001, 4000, 'image').length);
  assert.ok(core.validateImageMeta(imageFile, 0, 100, 'image').length);
});

test('QR source must be square and at least 320 pixels on each side', () => {
  assert.equal(core.validateImageMeta(imageFile, 320, 320, 'qr').length, 0);
  assert.ok(core.validateImageMeta(imageFile, 319, 320, 'qr').length);
  assert.ok(core.validateImageMeta(imageFile, 500, 400, 'qr').length);
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
