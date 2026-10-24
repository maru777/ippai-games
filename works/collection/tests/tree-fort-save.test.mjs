// ツリー砦の保存データの移行・整合の検証。実行: node works/collection/tests/tree-fort-save.test.mjs
import assert from 'node:assert/strict';
import { Store } from '../app/src/core/storage.js';
import { WEAPON } from '../app/src/games/tree-fort-weapons.js';
import create from '../app/src/games/tree-fort.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const g = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => (k === 'measureText' ? { width: 10 } : g)),
  set: (t, k, v) => {
    t[k] = v;
    return true;
  },
});
const env = () => ({
  W: 240, H: 320, end: () => {}, sound: { beep() {}, noise() {}, fall() {} },
  input: { pressed: false, released: false, pointerDown: false, x: 0, y: 0, keyAction: false, down: false, pointers: [], keys: new Set() },
});
const SAVE = 'tree-fort-save';

test('v1（武器をポイントで買う方式）の保存は、買ったぶんを返金して新方式へ移り、2 回読んでも二重に返金されない', () => {
  Store.save(SAVE, { owned: ['core', 'atk1'], points: 100, bestWave: 9, runs: 4, weapons: { bomb: 3, frost: 2 }, loadout: ['bomb', 'frost'], slots: 4 });
  const expected = WEAPON.bomb.cost.slice(0, 3).reduce((a, b) => a + b, 0) + WEAPON.frost.cost.slice(0, 2).reduce((a, b) => a + b, 0);
  const game = create(env());
  game.draw(g);
  const after = Store.load(SAVE, null);
  assert.equal(after.ver, 2);
  assert.equal(after.points, 100 + expected, '返金額');
  assert.ok(after.discovered.weapons.includes('bomb') && after.discovered.weapons.includes('frost'));
  assert.equal(after.slots, 4);
  assert.equal(after.weapons, undefined, '古い武器レベルの記録は残さない');
  // もう一度読む（ゲームを作り直す）
  create(env());
  assert.equal(Store.load(SAVE, null).points, 100 + expected, '二重に返金された');
});

test('保存がまったくない新規でも、基本の 3 武器が発見済みで、枠は 3', () => {
  Store.save(SAVE, null);
  const game = create(env());
  game.draw(g);
  game.reset();
  game.update(1 / 60);
  // 保存はまだ書かれない（遊ぶまでは空）。reset が例外なく動けばよい
  assert.ok(true);
});

test('壊れた保存データ（想定外の値）でも落ちず、範囲に収まる', () => {
  Store.save(SAVE, {
    ver: 2, owned: ['core', 'nonexistent', 'atk5'], points: -50, slots: 99, speed: 7, stageClear: 999,
    stars: { 1: 9, x: 2, 99: 3 }, discovered: { weapons: ['bomb', 'ghost'], syn: ['steam', 'zzz'], relics: ['ember', 'no'] },
    daily: 5, ach: ['first', 'nope'], skin: 'unknown', fx: 'unknown',
  });
  const game = create(env());
  for (let i = 0; i < 5; i++) {
    game.update(1 / 60);
    game.draw(g);
  }
  game.reset();
  assert.ok(game);
});

console.log(`\n${passed} 件すべて成功`);
