// ツリー砦の画面の煙テスト: 4 スキン × 3 演出のすべてで、
//   ツリー → ショップ → 図鑑 → ステージ選択 → 戦闘（レベルアップ・宝箱・契約の選択、倍速、オーバードライブ）→ 結果 を描いて、
//   例外が出ないことを確認する。描画先は何もしない偽の canvas（呼び出されるだけ）。
// 画面の高さ H は 320（固定）と 520（縦長の上限）の両方で動かす（H ごとに矩形が変わるので、ボタンは矩形から位置を求めて押す）。
// 実行: node works/collection/tests/tree-fort-ui.smoke.mjs
import assert from 'node:assert/strict';
import { Store } from '../app/src/core/storage.js';
import { SKINS, EFFECTS } from '../app/src/games/tree-fort-skins.js';
import { BTN_SHOP, BTN_GO, BTN_RETREAT, BTN_ARMORY, shopLayout, MAP } from '../app/src/games/tree-fort-view.js';
import {
  BTN_ST_BACK, BTN_ST_GO, ST_LIST, cardRects, BTN_REROLL, BTN_SPEED, BTN_OD, CX_TABS, CX_LIST, BTN_CX_BACK, slotRect,
} from '../app/src/games/tree-fort-rview.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';
import create from '../app/src/games/tree-fort.js';

// どんなメソッド呼び出しも受け付ける偽の 2D コンテキスト
const g = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (...a) => (k === 'measureText' ? { width: 10 } : g)),
  set: (t, k, v) => {
    t[k] = v;
    return true;
  },
});

const noop = () => {};
const sound = { beep: noop, noise: noop, fall: noop, unlock: noop };

function makeEnv(H) {
  const input = {
    pressed: false, released: false, pointerDown: false, x: 0, y: 0, keyAction: false, left: false, right: false, down: false,
    pointers: [], keys: new Set(),
  };
  let ended = 0;
  return { env: { W: 240, H, input, sound, end: () => { ended++; } }, input, ended: () => ended };
}

// 1 フレーム進める（タップする位置を渡すと、その位置を押して離す）
function frame(game, input, dt, tap) {
  if (tap) {
    input.pressed = true;
    input.released = true;
    input.x = tap.x;
    input.y = tap.y;
  }
  game.update(dt);
  game.draw(g);
  input.pressed = false;
  input.released = false;
}
const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

let count = 0;
for (const H of [320, 520]) {
  let combo = 0;
  for (const skin of SKINS) {
    for (const fx of EFFECTS) {
      combo++;
      Store.save('tree-fort-save', {
        ver: 2,
        owned: ['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'spd1', 'spd2', 'spd3', 'def1', 'def2', 'grw1', 'grw2', 'grw3', 'grw4'],
        points: 999, bestWave: 3, runs: 2, skinsOwned: SKINS.map((s) => s.id), fxOwned: EFFECTS.map((e) => e.id), skin: skin.id, fx: fx.id,
        slots: 5, discovered: { weapons: WEAPONS.slice(0, 5 + (combo % 7)).map((w) => w.id), syn: ['steam'], relics: ['ember'] },
        stageClear: combo % 2 ? 3 : 10, stars: { 1: 3, 2: 2, 3: 1 }, speed: 1 + (combo % 3), daily: { key: '', done: false }, ach: ['first'], bestCombo: 12, bestRelics: 1,
      });
      const { env, input, ended } = makeEnv(H);
      const game = create(env);
      for (let i = 0; i < 20; i++) frame(game, input, 1 / 60);
      // ショップ
      frame(game, input, 1 / 60, mid(BTN_SHOP));
      for (let i = 0; i < 6; i++) frame(game, input, 1 / 60);
      for (const row of shopLayout().rows) frame(game, input, 1 / 60, mid(row.rect));
      frame(game, input, 1 / 60, mid(BTN_GO)); // もどる
      // 図鑑: 全タブの行を順にタップして、枠も押す
      frame(game, input, 1 / 60, mid(BTN_ARMORY));
      for (const t of CX_TABS) {
        frame(game, input, 1 / 60, mid(t.rect));
        for (const y of [14, 40, 66, 92, 118, 144, 170].map((d) => CX_LIST.y + d)) frame(game, input, 1 / 60, { x: 100, y });
      }
      frame(game, input, 1 / 60, mid(slotRect(5)));
      frame(game, input, 1 / 60, mid(slotRect(5)));
      frame(game, input, 1 / 60, mid(BTN_CX_BACK));
      // ステージ選択 → 戻る → もう一度選択して、ステージ 1 へ出撃
      frame(game, input, 1 / 60, mid(BTN_GO));
      for (const y of [16, 42, 68, 94, 120, 146, 172].map((d) => ST_LIST.y + d)) frame(game, input, 1 / 60, { x: 100, y });
      frame(game, input, 1 / 60, mid(BTN_ST_BACK));
      frame(game, input, 1 / 60, mid(BTN_GO));
      frame(game, input, 1 / 60, { x: 100, y: ST_LIST.y + 12 }); // 1 つ目（ステージ 1）
      frame(game, input, 1 / 60, mid(BTN_ST_GO));
      // 戦闘: レベルアップ等の選択は、出たらカードを順にタップ。倍速・オーバードライブ・手動攻撃も混ぜる。
      for (let i = 0; i < 60 * 240 && ended() === 0; i++) {
        const tap = i % 41 === 0 ? { x: 60 + (i % 120), y: 150 } : i % 400 === 0 ? mid(BTN_SPEED) : i % 233 === 0 ? mid(BTN_OD) : null;
        frame(game, input, 1 / 60, tap);
        // 選択の画面（止まっている）には、一定時間ごとにカードやボタンをタップする
        if (i % 20 === 5) {
          for (const r of cardRects(3)) frame(game, input, 1 / 60, mid(r));
          frame(game, input, 1 / 60, mid(BTN_REROLL));
          for (const r of cardRects(4)) frame(game, input, 1 / 60, mid(r));
        }
      }
      // 連打の間は選択が止まったまま（手を止めて 0.7 秒待つと選べる）。出ている選択を片づけてから、撤退する。
      // 撤退は 2 回タップで確定（1 回目は「もう一度」の表示になるだけ）。間に新しい選択が出たら、やり直す。
      for (let a = 0; a < 40 && ended() === 0; a++) {
        for (let k = 0; k < 40; k++) frame(game, input, 1 / 60);
        frame(game, input, 1 / 60, mid(cardRects(3)[0]));
        frame(game, input, 1 / 60, mid(BTN_RETREAT));
        assert.equal(ended(), 0, '1 回のタップで撤退してしまう');
        for (let k = 0; k < 24; k++) frame(game, input, 1 / 60);
        frame(game, input, 1 / 60, mid(BTN_RETREAT));
      }
      assert.equal(ended(), 1, '結果画面へ進めない');
      count++;
      // 結果画面（シェルが呼ぶ形）
      for (let i = 0; i < 90; i++) game.tick(1 / 60);
      game.drawOver(g, { retry: { x: 30, y: H - 124, w: 180, h: 30 }, menu: { x: 30, y: H - 86, w: 180, h: 30 } });
      game.draw(g);
      // 再挑戦（reset）で、ステージ選択へ戻る
      game.reset();
      for (let i = 0; i < 5; i++) frame(game, input, 1 / 60);
    }
  }
}
assert.equal(count, SKINS.length * EFFECTS.length * 2);
console.log(`ok - ${count} 通り（画面の高さ 320・520 × スキン × 演出）で、ツリー・ショップ・図鑑・ステージ選択・戦闘（選択）・結果の描画が例外なく動いた`);
