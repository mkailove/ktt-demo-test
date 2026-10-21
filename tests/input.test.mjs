import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './support.mjs';

const core = loadCore();

test('default state restores the PRD example without image files', () => {
  const state = core.createDefaultState();
  assert.equal(state.template, 'center');
  assert.equal(state.tag, '今日开团');
  assert.equal(state.brand, '小美优选·团长');
  assert.equal(state.title, '【新疆直发】阿克苏冰糖心苹果 5斤装');
  assert.equal(state.subtitle, '咬一口爆汁甜脆·产地现摘现发');
  assert.deepEqual(Array.from(state.bullets), [
    '产地直发，没有中间商加价',
    '冰糖心占比高，一口爆汁甜',
    '坏果包赔，售后无忧',
  ]);
  assert.equal(state.originalPrice, '39.90');
  assert.equal(state.groupPrice, '19.90');
  assert.equal(state.ratioMode, 'auto');
  assert.equal(state.fitMode, 'contain');
  assert.equal(state.image, null);
  assert.equal(state.qr, null);
});

test('Unicode code points count emoji as one character', () => {
  assert.equal(core.countCodePoints('苹果😀'), 3);
});

test('money parser uses integer cents and rejects invalid decimals', () => {
  assert.equal(core.parseMoneyToCents('39.90'), 3990);
  assert.equal(core.parseMoneyToCents('0.01'), 1);
  assert.equal(core.parseMoneyToCents('0'), 0);
  assert.equal(core.parseMoneyToCents('1.234'), null);
  assert.equal(core.parseMoneyToCents('1000000'), null);
});

test('field validation names title, price, bullet and note errors', () => {
  const state = core.createDefaultState();
  state.title = ' ';
  state.groupPrice = '0';
  state.originalPrice = '1.234';
  state.bullets = Array(7).fill('卖点');
  state.leaderNote = '字'.repeat(49);
  const fields = Array.from(core.validateFields(state), error => error.field);
  assert.ok(fields.includes('title'));
  assert.ok(fields.includes('groupPrice'));
  assert.ok(fields.includes('originalPrice'));
  assert.ok(fields.includes('bullets'));
  assert.ok(fields.includes('leaderNote'));
});

test('original price below group price is rejected', () => {
  const state = core.createDefaultState();
  state.originalPrice = '19.89';
  assert.ok(Array.from(core.validateFields(state), error => error.field).includes('originalPrice'));
});
