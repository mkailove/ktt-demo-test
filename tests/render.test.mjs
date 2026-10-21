import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();
const measure = (text, size) => Array.from(text).reduce((width, character) => width + size * (/^[\x00-\xff]$/.test(character) ? 0.55 : 1), 0);
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
    ['center', '#FF4B5B', 100, 520],
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

test('center preview gives the default product image prominence and keeps selling points below it', () => {
  const layout = core.buildPosterLayout(core.createDefaultState(), measure);
  const image = layout.elements.find(element => element.kind === 'placeholder-image');
  const bullets = layout.elements.filter(element => element.field === 'bullets');
  const price = layout.elements.find(element => element.field === 'groupPrice');
  assert.ok(image.height >= 500);
  assert.ok(image.width >= 375);
  assert.ok(bullets.length >= 3);
  assert.equal(bullets[0].y - (image.y + image.height), 28);
  assert.ok(price.y >= 892);
  assert.ok(bullets.every(element => element.y + element.fontSize < price.y));
  assert.ok(bullets.every(element => element.fontSize >= 22));
});

test('top brand, tag and subtitle align to their color blocks with clear image spacing', () => {
  const state = core.createDefaultState();
  const layout = core.buildPosterLayout(state, measure);
  const brand = layout.elements.find(element => element.field === 'brand');
  const tag = layout.elements.find(element => element.field === 'tag');
  const tagBlock = layout.elements.find(element => element.kind === 'round-rect' && element.color === '#FFE36B');
  const title = layout.elements.find(element => element.field === 'title');
  const subtitle = layout.elements.find(element => element.field === 'subtitle');
  const subtitleBlock = layout.elements.find(element => element.kind === 'round-rect' && element.color === '#F2F4F6');
  const product = layout.elements.find(element => element.kind === 'placeholder-image');
  assert.equal(brand.baseline, 'middle');
  assert.equal(brand.y, 45);
  assert.ok(brand.fontSize >= 27);
  assert.equal(tag.baseline, 'middle');
  assert.equal(tag.y, tagBlock.y + tagBlock.height / 2);
  assert.equal(title.y, 106);
  assert.equal(subtitle.baseline, 'middle');
  assert.ok(subtitle.fontSize >= 22);
  assert.equal(subtitle.y, subtitleBlock.y + subtitleBlock.height / 2);
  assert.ok(product.y - (subtitleBlock.y + subtitleBlock.height) >= 12);
  state.title = 'A'.repeat(50);
  const longTitle = core.buildPosterLayout(state, measure);
  assert.equal(longTitle.elements.find(element => element.field === 'title').y, 100);
});

test('center preview keeps landscape products close to the selling points in automatic ratio', () => {
  const state = core.createDefaultState();
  state.image = { width: 1300, height: 1000, bitmap: {} };
  const layout = core.buildPosterLayout(state, measure);
  const image = layout.elements.find(element => element.kind === 'image').placement;
  const firstBullet = layout.elements.find(element => element.field === 'bullets');
  assert.ok(image.width > 600);
  assert.ok(firstBullet.y - (image.y + image.height) >= 28);
  assert.ok(firstBullet.y - (image.y + image.height) <= 42);
  assert.deepEqual(Array.from(layout.errors), []);
});

test('bold headings wrap using their rendered weight instead of normal font metrics', () => {
  const state = core.createDefaultState();
  state.title = 'A'.repeat(26);
  const weightSensitiveMeasure = (text, size, weight = 'normal') =>
    Array.from(text).length * size * (weight === 'bold' ? 0.77 : 0.7);
  const layout = core.buildPosterLayout(state, weightSensitiveMeasure);
  const titleLines = layout.elements.filter(element => element.field === 'title');
  assert.equal(titleLines.length, 2);
  assert.deepEqual(Array.from(layout.errors), []);
});

test('six selling points yield image height without crossing the price band', () => {
  const state = core.createDefaultState();
  const defaultLayout = core.buildPosterLayout(state, measure);
  state.bullets = Array.from({ length: 6 }, (_, index) => `卖点${index + 1}`);
  const denseLayout = core.buildPosterLayout(state, measure);
  assert.ok(denseLayout.regions.image.height < defaultLayout.regions.image.height);
  assert.ok(denseLayout.regions.image.height >= 320);
  assert.deepEqual(Array.from(denseLayout.errors), []);
  const price = denseLayout.elements.find(element => element.field === 'groupPrice');
  const bullets = denseLayout.elements.filter(element => element.field === 'bullets');
  assert.equal(bullets.length, 6);
  assert.ok(bullets.every(element => element.y + element.fontSize < price.y));
});

test('QR layout keeps the full code on the purchase panel background without a white block', () => {
  const state = core.createDefaultState();
  state.qr = { ...image };
  const layout = core.buildPosterLayout(state, measure);
  const qr = Array.from(layout.elements).find(element => element.kind === 'qr');
  const panel = Array.from(layout.elements).find(element => element.kind === 'round-rect' && element.y === 1064);
  assert.deepEqual([qr.x, qr.y, qr.width, qr.height], [72, 1078, 176, 176]);
  assert.equal(qr.background, panel.color);
  assert.equal(layout.elements.some(element => element.kind === 'rect' && element.color === '#FFFFFF' && element.y >= panel.y), false);
});

test('price row shares a vertical center and centers the discount within its larger pill', () => {
  const layout = core.buildPosterLayout(core.createDefaultState(), measure);
  const priceBand = layout.elements.find(element => element.kind === 'round-rect' && element.y === 892);
  const group = layout.elements.find(element => element.field === 'groupPrice');
  const original = layout.elements.find(element => element.field === 'originalPrice');
  const discount = layout.elements.find(element => element.field === 'discount');
  const pill = layout.elements.find(element => element.kind === 'round-rect' && element.color === layout.theme && element.y > priceBand.y);
  const middle = priceBand.y + priceBand.height / 2;
  assert.equal(group.y, middle);
  assert.equal(original.y, middle);
  assert.equal(discount.y, middle);
  assert.ok(group.x + measure(group.text, group.fontSize) < original.x);
  assert.ok(original.x + measure(original.text, original.fontSize) < pill.x);
  assert.equal(discount.x, pill.x + pill.width / 2);
  assert.ok(pill.height >= 44);
  assert.ok(discount.fontSize >= 22);
});

test('leader note is centered by its line count and separated from purchase panel', () => {
  const layout = core.buildPosterLayout(core.createDefaultState(), measure);
  const notePanel = layout.elements.find(element => element.kind === 'round-rect' && element.y === 984);
  const purchasePanel = layout.elements.find(element => element.kind === 'round-rect' && element.y === 1064);
  const lines = layout.elements.filter(element => element.field === 'leaderNote');
  const label = layout.elements.find(element => element.field === 'leaderLabel');
  const divider = layout.elements.find(element => element.kind === 'dashed-line');
  assert.equal(lines.length, 2);
  assert.equal(notePanel.height, 72);
  assert.equal(purchasePanel.height, 204);
  assert.equal(lines[0].y - notePanel.y, notePanel.y + notePanel.height - (lines.at(-1).y + 24));
  assert.ok(lines.at(-1).y + lines.at(-1).fontSize < notePanel.y + notePanel.height);
  assert.ok(label.fontSize >= 20);
  assert.equal(label.y, notePanel.y + notePanel.height / 2);
  assert.deepEqual([divider.x, divider.y, divider.width], [0, 1060, 720]);
  assert.ok(divider.y > notePanel.y + notePanel.height && divider.y < purchasePanel.y);
});

test('layout rejects multiline note overflow without entering the QR region', () => {
  const state = core.createDefaultState();
  state.leaderNote = '一\n二\n三\n四';
  const layout = core.buildPosterLayout(state, measure);
  assert.ok(Array.from(layout.errors, error => error.field).includes('leaderNote'));
  assert.ok(Array.from(layout.elements).filter(element => element.field === 'leaderNote').every(element => element.y < 1064));
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
