import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();
const measure = (text, size) => Array.from(text).length * size * 0.9;
const image = { width: 1000, height: 1000, bitmap: {} };

test('automatic aspect ratio uses square layout at 0.9 and 1.1 boundaries', () => {
  const box = { x: 0, y: 0, width: 400, height: 400 };
  assert.equal(core.computeImagePlacement({ width: 900, height: 1000 }, box, 'auto', 'contain').width, 400);
  assert.equal(core.computeImagePlacement({ width: 1100, height: 1000 }, box, 'auto', 'contain').width, 400);
  assert.ok(core.computeImagePlacement({ width: 1200, height: 1000 }, box, 'auto', 'contain').height < 400);
});

test('cover crops from center and contain keeps the whole source', () => {
  const box = { x: 0, y: 0, width: 300, height: 400 };
  const contain = core.computeImagePlacement({ width: 1000, height: 1000 }, box, '3:4', 'contain');
  const cover = core.computeImagePlacement({ width: 1000, height: 1000 }, box, '3:4', 'cover');
  assert.equal(contain.sourceWidth, 1000);
  assert.equal(contain.drawHeight, 300);
  assert.equal(cover.sourceWidth, 750);
  assert.equal(cover.sourceX, 125);
  assert.equal(cover.drawHeight, 400);
});

test('three templates keep their distinct image regions and colors', () => {
  const state = core.createDefaultState();
  state.image = image;
  const expected = [
    ['center', '#FF4B5B', 120, 480],
    ['left', '#20A9C7', 32, 396],
    ['hero', '#FF783F', 32, 656],
  ];
  for (const [template, theme, x, width] of expected) {
    state.template = template;
    const layout = core.buildPosterLayout(state, measure);
    assert.equal(layout.theme, theme);
    assert.equal(layout.regions.image.x, x);
    assert.equal(layout.regions.image.width, width);
  }
});

test('QR layout preserves 176 pixel image and 24 pixel white quiet zone', () => {
  const state = core.createDefaultState();
  state.qr = { ...image };
  const layout = core.buildPosterLayout(state, measure);
  const qr = Array.from(layout.elements).find(element => element.kind === 'qr');
  assert.deepEqual([qr.x, qr.y, qr.width, qr.height, qr.quietZone], [56, 1044, 176, 176, 24]);
});

test('layout rejects multiline note overflow without entering the QR region', () => {
  const state = core.createDefaultState();
  state.leaderNote = '一\n二\n三\n四';
  const layout = core.buildPosterLayout(state, measure);
  assert.ok(Array.from(layout.errors, error => error.field).includes('leaderNote'));
  assert.ok(Array.from(layout.elements).filter(element => element.field === 'leaderNote').every(element => element.y < 1016));
});

test('default example fits all three template layouts', () => {
  const state = core.createDefaultState();
  for (const template of ['center', 'left', 'hero']) {
    state.template = template;
    const layout = core.buildPosterLayout(state, measure);
    assert.deepEqual(Array.from(layout.errors), []);
  }
});

test('discounted original price has a strike line and equal prices do not', () => {
  const state = core.createDefaultState();
  const discounted = core.buildPosterLayout(state, measure);
  assert.ok(Array.from(discounted.elements).some(element => element.kind === 'strike'));
  state.originalPrice = '19.90';
  const equal = core.buildPosterLayout(state, measure);
  assert.equal(Array.from(equal.elements).some(element => element.kind === 'strike'), false);
});

test('missing image uses a centered 3:4 placeholder in automatic mode', () => {
  const state = core.createDefaultState();
  const layout = core.buildPosterLayout(state, measure);
  const placeholder = Array.from(layout.elements).find(element => element.kind === 'placeholder-image');
  assert.equal(placeholder.width / placeholder.height, 0.75);
  assert.equal(placeholder.x + placeholder.width / 2, 360);
});
