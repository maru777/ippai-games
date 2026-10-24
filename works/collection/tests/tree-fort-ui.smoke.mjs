// ツリー砦の画面の煙テスト: 4 スキン × 3 演出のすべてで、ツリー → ショップ → 戦闘 → 結果 を描いて例外が出ないことを確認する。
// 描画先は何もしない偽の canvas（呼び出されるだけ）。実行: node works/collection/tests/tree-fort-ui.smoke.mjs
import assert from 'node:assert/strict';
import { Store } from '../app/src/core/storage.js';
import { SKINS, EFFECTS } from '../app/src/games/tree-fort-skins.js';
import { BTN_SHOP, BTN_GO, BTN_RETREAT, BTN_ARMORY } from '../app/src/games/tree-fort-view.js';
import { ARM_TABS, BTN_ARM_UP, BTN_ARM_EQ, BTN_ARM_BACK, slotRect } from '../app/src/games/tree-fort-wview.js';
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

function makeEnv() {
  const input = {
    pressed: false, released: false, pointerDown: false, x: 0, y: 0, keyAction: false, left: false, right: false, down: false,
    pointers: [], keys: new Set(),
  };
  let ended = 0;
  return { env: { W: 240, H: 320, input, sound, end: () => { ended++; } }, input, ended: () => ended };
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

let count = 0;
let combo = 0;
for (const skin of SKINS) {
  for (const fx of EFFECTS) {
    // 12 通りのたびに、装備する武器を 6 つずつずらして、全武器の描画を通す
    const ids = Array.from({ length: 6 }, (_, k) => WEAPONS[(combo * 3 + k) % WEAPONS.length].id);
    combo++;
    Store.save('tree-fort-save', {
      weapons: Object.fromEntries(WEAPONS.map((w, i) => [w.id, 1 + (i % 5)])), loadout: ids, slots: 5,
      owned: ['core', 'atk1', 'atk2', 'atk3', 'atk4', 'atk5', 'spd1', 'spd2', 'spd3', 'spd4', 'spd5', 'def1', 'def2', 'def3', 'def4', 'def5', 'eco1', 'eco2', 'eco3', 'eco4'],
      points: 999, bestWave: 3, runs: 2, skinsOwned: SKINS.map((s) => s.id), fxOwned: EFFECTS.map((e) => e.id), skin: skin.id, fx: fx.id,
    });
    const { env, input, ended } = makeEnv();
    const game = create(env);
    // ツリー
    for (let i = 0; i < 20; i++) frame(game, input, 1 / 60);
    // ショップを開いて、全部の行を順に選ぶ
    frame(game, input, 1 / 60, { x: BTN_SHOP.x + 5, y: BTN_SHOP.y + 5 });
    for (let i = 0; i < 10; i++) frame(game, input, 1 / 60);
    for (const y of [60, 83, 106, 129, 174, 197, 220]) frame(game, input, 1 / 60, { x: 100, y });
    frame(game, input, 1 / 60, { x: BTN_GO.x + 5, y: BTN_GO.y + 5 }); // もどる
    // 武器庫: タブ・行・強化・装備・枠・もどる
    frame(game, input, 1 / 60, { x: BTN_ARMORY.x + 5, y: BTN_ARMORY.y + 5 });
    for (let i = 0; i < 6; i++) frame(game, input, 1 / 60);
    const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    frame(game, input, 1 / 60, mid(ARM_TABS[1].rect));
    for (const y of [70, 96, 122, 148, 174, 200]) frame(game, input, 1 / 60, { x: 100, y });
    frame(game, input, 1 / 60, mid(ARM_TABS[0].rect));
    for (const y of [70, 96, 122, 148, 174, 200]) {
      frame(game, input, 1 / 60, { x: 100, y });
      frame(game, input, 1 / 60, mid(BTN_ARM_UP));
      frame(game, input, 1 / 60, mid(BTN_ARM_EQ));
    }
    frame(game, input, 1 / 60, mid(slotRect(5)));
    frame(game, input, 1 / 60, mid(slotRect(4)));
    frame(game, input, 1 / 60, mid(slotRect(4)));
    frame(game, input, 1 / 60, mid(slotRect(0)));
    frame(game, input, 1 / 60, mid(BTN_ARM_BACK));
    // 戦闘（キー操作で出撃）。手動攻撃のタップも混ぜて 90 秒ぶん進める
    input.keyAction = true;
    frame(game, input, 1 / 60);
    input.keyAction = false;
    for (let i = 0; i < 60 * 90 && ended() === 0; i++) {
      frame(game, input, 1 / 60, i % 25 === 0 ? { x: 60 + (i % 120), y: 150 } : null);
    }
    // 90 秒で終わらなければ撤退で結果へ
    if (ended() === 0) frame(game, input, 1 / 60, { x: BTN_RETREAT.x + 5, y: BTN_RETREAT.y + 5 });
    assert.equal(ended(), 1, '結果画面へ進めない');
    count++;
    // 結果画面の描画（シェルが呼ぶ形）
    game.tick(1 / 60);
    game.drawOver(g, { retry: { x: 30, y: 196, w: 180, h: 30 }, menu: { x: 30, y: 234, w: 180, h: 30 } });
    game.draw(g);
    // 再挑戦（reset）でツリーへ戻る
    game.reset();
    for (let i = 0; i < 5; i++) frame(game, input, 1 / 60);
  }
}
assert.equal(count, SKINS.length * EFFECTS.length);
console.log(`ok - ${count} 通り（スキン × 演出）で、ツリー・ショップ・戦闘・結果の描画が例外なく動いた`);
