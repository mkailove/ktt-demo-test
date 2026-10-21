import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();
const measure = (text, size) => Array.from(text).length * size * 0.9;

function validState() {
  const state = core.createDefaultState();
  state.image = { width: 500, height: 500, bitmap: {} };
  state.qr = { width: 500, height: 500, bitmap: {} };
  return state;
}

test('export validation rejects missing images and layout overflow', () => {
  const state = core.createDefaultState();
  let layout = core.buildPosterLayout(state, measure);
  assert.deepEqual(Array.from(core.validateForExport(state, layout), error => error.field).sort(), ['image', 'qr']);
  state.image = { width: 500, height: 500, bitmap: {} };
  state.qr = { width: 500, height: 500, bitmap: {} };
  state.leaderNote = '一\n二\n三\n四';
  layout = core.buildPosterLayout(state, measure);
  assert.ok(Array.from(core.validateForExport(state, layout), error => error.field).includes('leaderNote'));
});

test('export validation rejects invalid amounts even with images', () => {
  const state = validState();
  state.groupPrice = '0';
  const layout = core.buildPosterLayout(state, measure);
  assert.ok(Array.from(core.validateForExport(state, layout), error => error.field).includes('groupPrice'));
});

test('filename uses local timestamp and removes invalid title characters', () => {
  const state = validState();
  state.title = '苹果:5斤/特价?.';
  assert.equal(core.makeExportFilename(state, new Date(2026, 9, 22, 8, 9, 7)), '团购海报_居中促销_苹果5斤特价_20261022-080907.png');
});

test('export draws a snapshot before awaiting download and rejects a parallel call', async () => {
  let finish;
  let rendered;
  const controller = core.createExportController(
    snapshot => {
      rendered = { title: snapshot.title, bullets: [...snapshot.bullets] };
      return { canvas: { pixels: snapshot.title }, layout: core.buildPosterLayout(snapshot, measure) };
    },
    () => new Promise(resolve => { finish = resolve; }),
  );
  const state = validState();
  const originalTitle = state.title;
  const pending = controller.export(state);
  state.title = '后来的标题';
  state.bullets[0] = '后来的卖点';
  assert.equal(rendered.title, originalTitle);
  assert.equal(rendered.bullets[0], '产地直发，没有中间商加价');
  assert.equal((await controller.export(state)).busy, true);
  finish();
  assert.equal((await pending).ok, true);
});

test('failed download releases the export lock for retry', async () => {
  let calls = 0;
  const controller = core.createExportController(
    snapshot => ({ canvas: {}, layout: core.buildPosterLayout(snapshot, measure) }),
    async () => { if (++calls === 1) throw new Error('disk full'); },
  );
  const state = validState();
  assert.equal((await controller.export(state)).ok, false);
  assert.equal((await controller.export(state)).ok, true);
  assert.equal(calls, 2);
});
