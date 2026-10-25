// 対戦ボードゲームの画面の煙テスト: 各ゲームを、CPU 戦・1 台で 2 人の両方で、ランダムなタップを送りながら動かして、
// 例外が出ないこと（描画・入力・CPU の手・結果）を確認する。描画先は何もしない偽の canvas。
// 実行: node works/collection/tests/boardgames.smoke.mjs
import assert from 'node:assert/strict';
globalThis.window = { location: { search: '' }, addEventListener() {}, removeEventListener() {} }; // オンラインの設定の読み取り用（接続先なし = サーバー未設定扱い）
const { GAMES } = await import('../app/src/games/registry.js');

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
  const input = { pressed: false, released: false, pointerDown: false, x: 0, y: 0, keyAction: false, left: false, right: false, down: false, pointers: [], keys: new Set(), canvas: { addEventListener: noop, removeEventListener: noop } };
  let ended = 0;
  return { env: { W: 240, H: 520, input, sound, end: () => { ended++; } }, input, ended: () => ended };
}

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

const IDS = ['wall-race', 'isolation', 'amazons', 'blockade', 'santorini', 'onitama', 'hex', 'reversi', 'four', 'dots'];
let n = 0;
for (const id of IDS) {
  const item = GAMES.find((x) => x.id === id);
  assert.ok(item, `registry に ${id} がない`);
  const mod = await item.load();
  for (const kind of ['cpu', 'local']) {
    const { env, input, ended } = makeEnv();
    const game = mod.default(env);
    if (game.resize) game.resize(240, env.H); // 縦長（高さ 520）で動かす
    game.reset();
    for (let i = 0; i < 5; i++) frame(game, input, 1 / 30);
    // 「？」の遊び方を開いて閉じる
    frame(game, input, 1 / 30, { x: 222, y: 16 });
    frame(game, input, 1 / 30, { x: 120, y: 160 });
    if (kind === 'cpu') {
      frame(game, input, 1 / 30, { x: 120, y: 100 }); // CPU と対戦
      frame(game, input, 1 / 30, { x: 120, y: 160 }); // ふつう
    } else {
      frame(game, input, 1 / 30, { x: 120, y: 141 }); // 1 台で 2 人
    }
    if (kind === 'local' && id === 'wall-race') continue; // こりぽーるは「1 台で 2 人」を持たない
    for (let i = 0; i < 6000 && ended() === 0; i++) {
      const tap = i % 3 === 0 ? { x: 8 + Math.random() * 224, y: 30 + Math.random() * 280 } : null;
      frame(game, input, 1 / 30, tap);
    }
    // 結果画面（シェルが呼ぶ形）
    if (ended()) {
      for (let i = 0; i < 30; i++) game.tick(1 / 30);
      game.drawOver(g, { retry: { x: 30, y: 196, w: 180, h: 30 }, menu: { x: 30, y: 234, w: 180, h: 30 } });
    }
    game.reset();
    for (let i = 0; i < 3; i++) frame(game, input, 1 / 30);
    n++;
  }
}
console.log(`ok - ${n} 通り（ゲーム × 対戦方式）で、ランダムな操作でも例外が出なかった`);
