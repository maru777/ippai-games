// ツリー砦の「開始装備」の枝（武器庫・開始枠・9 武器の解放）と、出撃前に開始装備を選ぶ流れの検証。
// 実行: node works/collection/tests/tree-fort-start.test.mjs
import assert from 'node:assert/strict';
import {
  TREE, NODE, computeStats, canBuy, TREE_WEAPON_NODE, startSelectable, unlockedWeapons, startSlotCount, startWeapons,
} from '../app/src/games/tree-fort-data.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';
import { Store } from '../app/src/core/storage.js';
import { BTN_GO, BTN_BUY, MAP, STEP, NODE_R, ZOOM_OUT, PAN_LIMIT, overviewPan, nodeScreenPos } from '../app/src/games/tree-fort-view.js';
import { BTN_ST_GO } from '../app/src/games/tree-fort-rview.js';
import { loadoutCards } from '../app/src/games/tree-fort-loadoutview.js';
import create from '../app/src/games/tree-fort.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const S = (ids) => new Set(ids);

test('nodes: 武器庫・開始枠 2 つ・9 武器の解放の 12 ノードが、位置・前提・費用どおりにそろう', () => {
  const st = TREE.filter((n) => /^st\d+$/.test(n.id));
  assert.equal(st.length, 12);
  assert.equal(new Set(TREE.map((n) => `${n.gx},${n.gy}`)).size, TREE.length, 'ノードの位置が重なる');
  assert.equal(NODE.st1.cost, 100);
  assert.equal(NODE.st2.cost, 400);
  assert.equal(NODE.st3.cost, 900);
  const costs = ['st4', 'st5', 'st6', 'st7', 'st8', 'st9', 'st10', 'st11', 'st12'].map((id) => NODE[id].cost);
  assert.ok(costs.every((c) => c >= 200 && c <= 500), `武器の解放は 200〜500 P（${costs}）`);
  // 武器庫を取らないと、武器の解放も開始枠も取れない
  for (const id of ['st2', 'st4', 'st12']) assert.equal(canBuy(S(['core']), 9999, id).ok, false, id);
  assert.equal(canBuy(S(['core']), 9999, 'st1').ok, true);
  assert.equal(canBuy(S(['core', 'st1']), 9999, 'st4').ok, true);
  assert.equal(canBuy(S(['core', 'st1']), 9999, 'st3').ok, false, '開始枠 +2 は +1 の後');
  // 12 武器がすべて、解放ノードを持つ
  assert.equal(Object.keys(TREE_WEAPON_NODE).length, WEAPONS.length);
  for (const w of WEAPONS) assert.ok(NODE[TREE_WEAPON_NODE[w.id]].unlock === w.id, `${w.id} の解放ノード`);
});

test('slots: 開始枠は、基本 1 つ。開始枠のノードで増える。以前の 3 武器を解放済みなら、その数を下限にする', () => {
  const stats = (owned) => computeStats(owned);
  assert.equal(startSlotCount(S(['core', 'st1']), stats(['core', 'st1'])), 1);
  assert.equal(startSlotCount(S(['core', 'st1', 'st2']), stats(['core', 'st1', 'st2'])), 2);
  assert.equal(startSlotCount(S(['core', 'st1', 'st2', 'st3']), stats(['core', 'st1', 'st2', 'st3'])), 3);
  const legacy = ['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'spd1', 'spd2', 'spd3', 'spd4', 'spd5', 'def1', 'def2', 'def3', 'def4', 'def5', 'st1'];
  assert.equal(startSlotCount(S(legacy), stats(legacy)), 3, '以前の 3 武器を解放済みなら、減らない');
});

test('choose: 武器庫がなければ、解放した武器をすべて持って出撃。あれば、選んだものを枠まで', () => {
  const noGate = S(['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5']);
  assert.equal(startSelectable(noGate), false);
  assert.deepEqual(startWeapons(noGate, ['flame'], computeStats(noGate)), ['bomb'], '武器庫なしは、以前どおり');
  const owned = S(['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'st1', 'st4', 'st5']);
  const stats = computeStats(owned);
  assert.deepEqual(unlockedWeapons(owned).sort(), ['bomb', 'flame', 'frost']);
  assert.equal(startSlotCount(owned, stats), 1);
  assert.deepEqual(startWeapons(owned, ['frost'], stats), ['frost'], '選んだ武器');
  assert.deepEqual(startWeapons(owned, ['frost', 'flame'], stats), ['frost'], '枠を超えた分は外れる');
  assert.deepEqual(startWeapons(owned, ['laser', 'frost'], stats), ['frost'], '未解放の武器は外れる');
  assert.deepEqual(startWeapons(owned, [], stats), ['bomb'], '何も選んでいなければ、解放した順の先頭');
  assert.deepEqual(startWeapons(owned, ['frost', 'frost'], stats), ['frost'], '重ならない');
});

// 描画先: fillText の文字を集める偽の canvas
function recorder() {
  const texts = [];
  const g = new Proxy({}, {
    get: (t, k) => {
      if (k === 'fillText') return (s) => texts.push(String(s));
      return k in t ? t[k] : (...a) => (k === 'measureText' ? { width: 10 } : g);
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
  return { g, texts };
}

test('flow: 開始装備が枠より多いとき、出撃の前に選ぶ画面が出て、選んだ武器で戦闘が始まる', () => {
  Store.save('tree-fort-save', {
    ver: 2, owned: ['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'st1', 'st4', 'st5'], points: 0, slots: 3, skin: 'neon', stageClear: 1, startWeapons: ['frost'],
    discovered: { weapons: ['bomb', 'flame', 'frost'], syn: [], relics: [] }, daily: { key: '', done: false },
  });
  const input = { pressed: false, released: false, pointerDown: false, x: 0, y: 0, keyAction: false, left: false, right: false, down: false, pointers: [], keys: new Set() };
  const noop = () => {};
  const game = create({ W: 240, H: 320, input, sound: { beep: noop, noise: noop, fall: noop, unlock: noop }, end: noop });
  const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const shot = () => {
    const r = recorder();
    game.draw(r.g);
    return r.texts.join('|');
  };
  const tap = (p) => {
    input.pressed = true;
    input.released = true;
    input.x = p.x;
    input.y = p.y;
    game.update(1 / 30);
    input.pressed = false;
    input.released = false;
    game.update(1 / 30);
  };
  for (let i = 0; i < 20; i++) game.update(1 / 30);
  tap(mid(BTN_GO)); // 出撃 → ステージ選択
  for (let i = 0; i < 5; i++) game.update(1 / 30);
  tap(mid(BTN_ST_GO)); // ステージを選んで出撃 → 開始装備の画面
  const s1 = shot();
  assert.ok(s1.includes('開始装備を選ぶ'), '選ぶ画面が出ない');
  assert.ok(s1.includes('1 / 1'), '前回の選択（氷結弾）が入っている');
  const cards = loadoutCards({ save: { owned: S(['atk5', 'st4', 'st5']) }, H: 320 });
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  tap(mid(byId.frost.rect)); // 氷結弾を外す
  assert.ok(shot().includes('0 / 1'));
  tap(mid(byId.flame.rect)); // 火炎放射を選ぶ
  assert.ok(shot().includes('1 / 1'));
  tap(mid(byId.bomb.rect)); // 枠がいっぱい → 選べない
  assert.ok(shot().includes('1 / 1'));
  tap(mid(BTN_BUY)); // 出撃
  for (let i = 0; i < 10; i++) game.update(1 / 30);
  const s2 = shot();
  assert.ok(!s2.includes('開始装備を選ぶ'), '戦闘が始まる');
  assert.ok(/W\d+\/30|WAVE|波/.test(s2), '戦闘の画面');
  assert.deepEqual(Store.load('tree-fort-save').startWeapons, ['flame'], '選んだ開始装備が保存される');
});

test('zoom: ツリー全体が、全体表示で画面に収まり、ふだんの表示では端のノードまでドラッグで届く', () => {
  // 全体表示: すべてのノードが、地図の枠の中（ノードの半径ぶんの余白つき）に入る
  const over = { pan: overviewPan(), zoom: ZOOM_OUT };
  for (const n of TREE) {
    const p = nodeScreenPos(over, n);
    const r = NODE_R * ZOOM_OUT;
    assert.ok(p.x - r >= MAP.x && p.x + r <= MAP.x + MAP.w, `${n.id} が横に収まらない（${p.x}）`);
    assert.ok(p.y - r >= MAP.y && p.y + r <= MAP.y + MAP.h, `${n.id} が縦に収まらない（${p.y}）`);
  }
  // ふだんの表示: どのノードも、ドラッグの範囲内で、画面の真ん中に持ってこられる
  for (const n of TREE) {
    assert.ok(Math.abs(n.gx * STEP) <= PAN_LIMIT && Math.abs(n.gy * STEP) <= PAN_LIMIT, `${n.id} に届かない`);
  }
  // 拡大に戻るとき、タップしたノードが真ん中に来る
  const n = NODE.arm10;
  const back = { pan: { x: -n.gx * STEP, y: -n.gy * STEP }, zoom: 1 };
  const p = nodeScreenPos(back, n);
  assert.ok(Math.abs(p.x - 120) < 1e-9 && Math.abs(p.y - (MAP.y + MAP.h / 2)) < 1e-9, '真ん中に来る');
});

console.log(`\n${passed} 件すべて成功`);
