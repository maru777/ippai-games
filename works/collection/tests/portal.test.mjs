// ポータル（最初の画面）の検証: ドラッグではゲームが選ばれず、離したときのタップで選ばれる。タブで世界が切り替わる。
// 実行: node works/collection/tests/portal.test.mjs
import assert from 'node:assert/strict';
import { GAMES } from '../app/src/games/registry.js';
import { createPortal, WORLDS } from '../app/src/portal.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const g = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => (k === 'measureText' ? { width: 10 } : k.startsWith('create') ? g : g)),
  set: (t, k, v) => {
    t[k] = v;
    return true;
  },
});
const mem = {};
const store = { load: (k, d) => mem[k] ?? d, save: (k, v) => { mem[k] = v; } };

function setup() {
  const picked = [];
  const portal = createPortal({ games: GAMES, store, best: () => null, onSelect: (it) => picked.push(it.id) });
  const input = { pressed: false, released: false, pointerDown: false, down: false, keyAction: false, x: 0, y: 0 };
  const frame = (ev = {}) => {
    Object.assign(input, ev);
    portal.update(1 / 60, input);
    portal.draw(g);
    input.pressed = false;
    input.released = false;
  };
  const tap = (x, y) => {
    frame({ pressed: true, pointerDown: true, down: true, x, y });
    frame({ released: true, pointerDown: false, down: false, x, y });
  };
  return { portal, picked, frame, tap };
}

test('registry: すべてのゲームが world を持ち、3 つの世界のどれかに属する', () => {
  const ids = new Set(WORLDS.map((w) => w.id));
  for (const it of GAMES) assert.ok(ids.has(it.world), `${it.id} の world が不正`);
  assert.equal(new Set(GAMES.map((i) => i.id)).size, GAMES.length, 'id が重複');
});

test('タップで 1 つ目のゲームが選ばれる', () => {
  const { picked, tap } = setup();
  tap(120, 90);
  assert.deepEqual(picked, ['cave-heli']);
});

test('ドラッグ（スクロール）では選ばれず、離したあとも選ばれない', () => {
  const { picked, frame } = setup();
  frame({ pressed: true, pointerDown: true, down: true, x: 120, y: 200 });
  for (let y = 190; y >= 120; y -= 10) frame({ pointerDown: true, down: true, x: 120, y });
  frame({ released: true, pointerDown: false, down: false, x: 120, y: 120 });
  for (let i = 0; i < 30; i++) frame();
  assert.deepEqual(picked, [], 'スクロールしただけでゲームが始まった');
});

test('ドラッグで一覧が動き、行き過ぎない', () => {
  const { portal, picked, frame, tap } = setup();
  frame({ pressed: true, pointerDown: true, down: true, x: 120, y: 280 });
  for (let y = 270; y >= 70; y -= 10) frame({ pointerDown: true, down: true, x: 120, y });
  frame({ released: true, pointerDown: false, down: false, x: 120, y: 70 });
  for (let i = 0; i < 120; i++) frame();
  tap(120, 80); // スクロール後の先頭は 1 つ目ではない
  assert.equal(picked.length, 1);
  assert.notEqual(picked[0], 'cave-heli');
  assert.equal(portal.world, 'keitai');
});

test('タブで世界が切り替わり、一覧がその世界のゲームになる', () => {
  const { portal, picked, tap } = setup();
  tap(120, 53); // 2 つ目のタブ（対戦・ボード）
  assert.equal(portal.world, 'versus');
  tap(120, 90);
  assert.equal(GAMES.find((i) => i.id === picked[0]).world, 'versus');
  tap(200, 53); // 3 つ目（パズル＆戦略）
  assert.equal(portal.world, 'puzzle');
});

test('保存した世界が次回の最初に選ばれる', () => {
  const { tap } = setup();
  tap(200, 53);
  const again = createPortal({ games: GAMES, store, best: () => null, onSelect: () => {} });
  assert.equal(again.world, 'puzzle');
});

console.log(`\n${passed} 件すべて成功`);
