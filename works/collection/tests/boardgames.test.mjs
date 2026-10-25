// 新しい対戦ボードゲーム（あいぽれーしょん・あまぽん・ぶろっけーぽん・ぽんとりーに・おにぽま・ぽっくす）のルールと CPU の検証。
// 共通の検証: 違反の手は null / 1 手ごとに手番が替わる / ランダムどうしが必ず終局する / つよい CPU はランダムに勝つ。
// 実行: node works/collection/tests/boardgames.test.mjs
import assert from 'node:assert/strict';
import * as iso from '../app/src/games/isolation-rules.js';
import * as ama from '../app/src/games/amazons-rules.js';
import * as blk from '../app/src/games/blockade-rules.js';
import * as san from '../app/src/games/santorini-rules.js';
import * as oni from '../app/src/games/onitama-rules.js';
import * as hex from '../app/src/games/hex-rules.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

// mod の 1 局。levels[seat] が 'random' ならランダム、それ以外は ai(level)。勝者（0/1/2）を返す。
function play(mod, levels, first = 0, seed = 1, maxPlies = 600) {
  let s = mod.newState(first, seed);
  for (let i = 0; i < maxPlies && mod.winner(s) === -1; i++) {
    const seat = mod.turn(s);
    let a;
    if (levels[seat] === 'random') a = rnd(mod.legalMoves(s, seat));
    else a = mod.ai(s, seat, levels[seat]);
    assert.ok(a, `手がない（seat ${seat}, 手数 ${i}）`);
    const next = mod.apply(s, seat, a);
    assert.ok(next, `CPU が違反の手を返した: ${JSON.stringify(a)}`);
    assert.equal(mod.turn(next) === seat && mod.winner(next) === -1, false, '手番が替わらない');
    s = next;
  }
  return mod.winner(s);
}

// 勝ち数（seat 0 を level A、seat 1 を level B。先手を交互に）
function match(mod, a, b, games) {
  let wa = 0;
  for (let i = 0; i < games; i++) {
    const first = i % 2;
    const w = play(mod, [a, b], first, 100 + i);
    if (w === 0) wa++;
  }
  return wa;
}

test('isolation: 初期配置・違反の手・手番違いは null', () => {
  const s = iso.newState(0);
  assert.deepEqual(s.pawns, [{ x: 3, y: 6 }, { x: 3, y: 0 }]);
  assert.equal(iso.apply(s, 1, { x: 3, y: 1, rx: 0, ry: 0 }), null, '手番違い');
  assert.equal(iso.apply(s, 0, { x: 3, y: 4, rx: 0, ry: 0 }), null, '2 マス先');
  assert.equal(iso.apply(s, 0, { x: 3, y: 5, rx: 3, ry: 5 }), null, '行き先を消すことはできない');
  assert.equal(iso.apply(s, 0, { x: 3, y: 5, rx: 3, ry: 0 }), null, '相手のコマのマスは消せない');
  const n = iso.apply(s, 0, { x: 3, y: 5, rx: 0, ry: 0 });
  assert.ok(n);
  assert.equal(n.gone[0], 1);
  assert.equal(n.turn, 1);
});

test('isolation: 動けなくなった側が負ける', () => {
  const s = iso.newState(0);
  // 相手（上）のまわりを消し切った盤を作る
  const gone = Array(49).fill(0);
  for (const [x, y] of [[2, 0], [4, 0], [2, 1], [3, 1]]) gone[y * 7 + x] = 1;
  const t = { ...s, gone, pawns: [{ x: 3, y: 6 }, { x: 3, y: 0 }], turn: 0 };
  const n = iso.apply(t, 0, { x: 3, y: 5, rx: 4, ry: 1 });
  assert.equal(n.winner, 0);
});

test('isolation: ランダムどうしが必ず終局し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(play(iso, ['random', 'random'], i % 2, i), -1);
  const wins = match(iso, 'hard', 'random', 10);
  assert.ok(wins >= 9, `つよい CPU の勝ち ${wins}/10`);
  const mid = match(iso, 'normal', 'random', 10);
  assert.ok(mid >= 7, `ふつうの CPU の勝ち ${mid}/10`);
});

test('isolation: つよい CPU の 1 手は 1.5 秒以内', () => {
  const s = iso.newState(0);
  const t0 = Date.now();
  iso.ai(s, 0, 'hard');
  assert.ok(Date.now() - t0 < 1500, `${Date.now() - t0}ms`);
});

test('amazons: 初期配置は各 2 体、違反の手は null、矢は動かした先から撃つ', () => {
  const s = ama.newState(0);
  assert.equal(ama.queensOf(s.cells, 0).length, 2);
  assert.equal(ama.queensOf(s.cells, 1).length, 2);
  assert.equal(ama.apply(s, 1, { fx: 1, fy: 0, tx: 1, ty: 2, ax: 1, ay: 3 }), null, '手番違い');
  assert.equal(ama.apply(s, 0, { fx: 1, fy: 5, tx: 1, ty: 0, ax: 0, ay: 0 }), null, '相手のクイーンを飛び越せない');
  assert.ok(ama.apply(s, 0, { fx: 1, fy: 5, tx: 1, ty: 3, ax: 2, ay: 3 }));
  assert.equal(ama.apply(s, 0, { fx: 1, fy: 5, tx: 1, ty: 3, ax: 0, ay: 0 }), null, '矢は行き先から届く所だけ');
  assert.ok(ama.apply(s, 0, { fx: 1, fy: 5, tx: 1, ty: 3, ax: 1, ay: 5 }), '動かす前のマスにも矢を撃てる');
  const n = ama.apply(s, 0, { fx: 1, fy: 5, tx: 1, ty: 3, ax: 2, ay: 3 });
  assert.equal(n.cells[3 * 6 + 2], 2);
  assert.equal(n.cells[3 * 6 + 1], 0);
});

test('amazons: ランダムどうしが必ず終局し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(play(ama, ['random', 'random'], i % 2, i), -1);
  const wins = match(ama, 'hard', 'random', 8);
  assert.ok(wins >= 7, `つよい CPU の勝ち ${wins}/8`);
  const mid = match(ama, 'normal', 'random', 8);
  assert.ok(mid >= 6, `ふつうの CPU の勝ち ${mid}/8`);
});

test('amazons: つよい CPU の 1 手は 2 秒以内', () => {
  const s = ama.newState(0);
  const t0 = Date.now();
  ama.ai(s, 0, 'hard');
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
});

test('blockade: 初期配置・移動は最大 2 マス・飛び越し不可・壁で塞げる', () => {
  const s = blk.newState(0);
  assert.equal(s.pawns[0].length, 2);
  assert.equal(blk.apply(s, 1, { k: 'move', p: 0, x: 2, y: 1 }), null, '手番違い');
  assert.equal(blk.apply(s, 0, { k: 'move', p: 0, x: 2, y: 5 }), null, '3 マスは動けない');
  assert.ok(blk.apply(s, 0, { k: 'move', p: 0, x: 2, y: 6 }), '2 マスは動ける');
  assert.ok(blk.apply(s, 0, { k: 'move', p: 1, x: 5, y: 7 }), '斜めは 2 歩で行ける');
  const w = blk.apply(s, 0, { k: 'wall', x: 2, y: 6, o: 'h' });
  assert.ok(w);
  assert.equal(w.left[0], 7);
  assert.equal(blk.apply(w, 1, { k: 'wall', x: 2, y: 6, o: 'h' }), null, '重なる壁は置けない');
});

test('blockade: 両方のコマが相手の出発マスに着いたら勝ち', () => {
  const s = blk.newState(0);
  const t = { ...s, pawns: [[{ x: 2, y: 1 }, { x: 6, y: 0 }], s.pawns[1].map((p) => ({ ...p, y: 5 }))], turn: 0 };
  const n = blk.apply(t, 0, { k: 'move', p: 0, x: 2, y: 0 });
  assert.equal(n.winner, 0);
});

test('blockade: ランダムどうしは終局（引き分け含む）し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 6; i++) assert.notEqual(play(blk, ['random', 'random'], i % 2, i, 400), -1);
  let wins = 0;
  for (let i = 0; i < 8; i++) if (play(blk, ['hard', 'random'], i % 2, i, 400) === 0) wins++;
  assert.ok(wins >= 5, `つよい CPU の勝ち ${wins}/8`); // 相手のコマがゴールに居座ると引き分けになることがある
});

test('blockade: つよい CPU の 1 手は 2 秒以内', () => {
  const s = blk.newState(0);
  const t0 = Date.now();
  blk.ai(s, 0, 'hard');
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
});

test('santorini: 初期配置・移動と積み木・違反の手は null', () => {
  const s = san.newState(0);
  assert.equal(san.apply(s, 1, { w: 0, x: 1, y: 0, bx: 0, by: 0 }), null, '手番違い');
  assert.equal(san.apply(s, 0, { w: 0, x: 3, y: 3, bx: 3, by: 4 }), null, '作業員のいるマスへは動けない');
  assert.equal(san.apply(s, 0, { w: 0, x: 1, y: 2 }), null, '積み木を積まない手は（勝ち以外）無効');
  const n = san.apply(s, 0, { w: 0, x: 1, y: 2, bx: 1, by: 3 });
  assert.ok(n);
  assert.equal(n.h[3 * 5 + 1], 1, '動く前のマスにも積める');
  assert.equal(n.turn, 1);
  assert.equal(san.apply(n, 1, { w: 0, x: 1, y: 2, bx: 0, by: 0 }), null, '作業員のいるマスへは動けない');
});

test('santorini: 2 段上へは登れず、3 段目に登ったら勝ち、ドームには動けない', () => {
  const s = san.newState(0);
  const h = Array(25).fill(0);
  h[3 * 5 + 1] = 0;
  h[2 * 5 + 1] = 2; // 隣は 2 段
  const t = { ...s, h };
  assert.equal(san.apply(t, 0, { w: 0, x: 1, y: 2, bx: 0, by: 3 }), null, '0 段から 2 段へは登れない');
  const h2 = Array(25).fill(0);
  h2[3 * 5 + 1] = 2;
  h2[2 * 5 + 1] = 3;
  const u = { ...s, h: h2 };
  const w = san.apply(u, 0, { w: 0, x: 1, y: 2 });
  assert.equal(w.winner, 0);
  const h3 = Array(25).fill(0);
  h3[2 * 5 + 1] = 4;
  assert.equal(san.apply({ ...s, h: h3 }, 0, { w: 0, x: 1, y: 2, bx: 0, by: 3 }), null, 'ドームには動けない');
});

test('santorini: ランダムどうしが必ず終局し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(play(san, ['random', 'random'], i % 2, i), -1);
  const wins = match(san, 'hard', 'random', 8);
  assert.ok(wins >= 7, `つよい CPU の勝ち ${wins}/8`);
  const mid = match(san, 'normal', 'random', 8);
  assert.ok(mid >= 6, `ふつうの CPU の勝ち ${mid}/8`);
});

test('santorini: つよい CPU の 1 手は 2 秒以内', () => {
  const s = san.newState(0);
  const t0 = Date.now();
  san.ai(s, 0, 'hard');
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
});

test('onitama: 同じ seed なら同じ配札で、5 枚はすべて違う', () => {
  const a = oni.newState(0, 123);
  const b = oni.newState(0, 123);
  assert.deepEqual(a.hands, b.hands);
  assert.equal(a.side, b.side);
  const all = [...a.hands[0], ...a.hands[1], a.side];
  assert.equal(new Set(all).size, 5);
  assert.notDeepEqual(oni.newState(0, 123).hands, oni.newState(0, 124).hands);
});

test('onitama: カードの動き（座席 1 は反転）・使ったカードが横と入れ替わる・違反は null', () => {
  const s = oni.newState(0, 7);
  const c = s.hands[0][0];
  const [dx, dy] = oni.cardOf(c).moves[0];
  assert.deepEqual(oni.offsets(c, 1)[0], [-dx, -dy]);
  const mv = oni.legalMoves(s, 0).find((m) => !m.pass);
  const n = oni.apply(s, 0, mv);
  assert.ok(n);
  assert.equal(n.side, mv.c);
  assert.ok(n.hands[0].includes(s.side));
  assert.equal(oni.apply(s, 1, oni.legalMoves(s, 1)[0]), null, '手番違い');
  assert.equal(oni.apply(s, 0, { c: 'nonexistent', fx: 0, fy: 4, tx: 0, ty: 3 }), null, '持っていないカード');
});

test('onitama: 師匠を取る・神殿に着くと勝ち', () => {
  const s = oni.newState(0, 7);
  const board = Array(25).fill(-1);
  board[4 * 5 + 2] = 1; // 座席 0 の師匠（下）
  board[1 * 5 + 2] = 3; // 座席 1 の師匠
  const t1 = { ...s, board, hands: [['tiger', 'boar'], ['ox', 'horse']], side: 'crab', turn: 0 };
  // 虎: 前へ 2 マス。(2,4) → (2,2)
  const mid = oni.apply(t1, 0, { c: 'tiger', fx: 2, fy: 4, tx: 2, ty: 2 });
  assert.equal(mid.winner, -1);
  const b2 = Array(25).fill(-1);
  b2[2 * 5 + 2] = 1;
  b2[1 * 5 + 2] = 3;
  const cap = oni.apply({ ...t1, board: b2 }, 0, { c: 'boar', fx: 2, fy: 2, tx: 2, ty: 1 });
  assert.equal(cap.winner, 0, '師匠を取って勝ち');
  const b3 = Array(25).fill(-1);
  b3[1 * 5 + 2] = 1;
  b3[3 * 5 + 0] = 3;
  const tmp = oni.apply({ ...t1, board: b3 }, 0, { c: 'boar', fx: 2, fy: 1, tx: 2, ty: 0 });
  assert.equal(tmp.winner, 0, '神殿に着いて勝ち');
});

test('onitama: ランダムどうしが終局し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(play(oni, ['random', 'random'], i % 2, 10 + i, 800), -1);
  const wins = match(oni, 'hard', 'random', 8);
  assert.ok(wins >= 7, `つよい CPU の勝ち ${wins}/8`);
  const mid = match(oni, 'normal', 'random', 8);
  assert.ok(mid >= 6, `ふつうの CPU の勝ち ${mid}/8`);
});

test('onitama: つよい CPU の 1 手は 2 秒以内', () => {
  const s = oni.newState(0, 5);
  const t0 = Date.now();
  oni.ai(s, 0, 'hard');
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
});

test('hex: 辺から辺へつながると勝ち・斜めの隣（右上と左下）はつながる', () => {
  let s = hex.newState(0);
  // 座席 0 が x=0 の列を上から下へ 9 個つなぐ（座席 1 は離れた場所に置く）
  for (let y = 0; y < 9; y++) {
    s = hex.apply(s, 0, { x: 0, y });
    assert.ok(s, `y=${y}`);
    if (y < 8) {
      s = hex.apply(s, 1, { x: 4, y: y === 0 ? 4 : y === 4 ? 0 : y });
      if (!s) break;
    }
  }
  const cells = Array(81).fill(-1);
  // 斜め（x+1, y-1）でつながる並び: (8,0) から (0,8) へ
  for (let k = 0; k < 9; k++) cells[k * 9 + (8 - k)] = 0;
  assert.ok(hex.connected(cells, 0), '右上〜左下の斜めはつながっている');
  const cells2 = Array(81).fill(-1);
  for (let k = 0; k < 9; k++) cells2[k * 9 + k] = 0; // 左上〜右下の斜めは、六角の隣ではない
  assert.equal(hex.connected(cells2, 0), null);
  const row = Array(81).fill(-1);
  for (let x = 0; x < 9; x++) row[4 * 9 + x] = 1;
  assert.ok(hex.connected(row, 1), '座席 1 は左右の辺');
});

test('hex: 後手は最初の 1 手のあとだけ入れ替えられる', () => {
  const s0 = hex.newState(0);
  assert.equal(hex.apply(s0, 0, { swap: true }), null);
  const s1 = hex.apply(s0, 0, { x: 4, y: 4 });
  assert.equal(hex.apply(s1, 0, { x: 3, y: 3 }), null, '手番違い');
  const sw = hex.apply(s1, 1, { swap: true });
  assert.ok(sw);
  assert.equal(sw.cells[4 * 9 + 4], 1, '石が後手の色になる');
  assert.equal(sw.turn, 0);
  assert.equal(hex.apply(sw, 0, { x: 4, y: 4 }), null, '石のあるマスには置けない');
  const s2 = hex.apply(s1, 1, { x: 0, y: 0 });
  assert.equal(hex.apply(s2, 0, { swap: true }), null, '2 手目以降は入れ替えられない');
});

test('hex: ランダムどうしが必ず決着し、つよい CPU はランダムにほぼ勝つ', () => {
  for (let i = 0; i < 20; i++) assert.notEqual(play(hex, ['random', 'random'], i % 2, i), -1);
  const wins = match(hex, 'hard', 'random', 8);
  assert.ok(wins >= 7, `つよい CPU の勝ち ${wins}/8`);
  const mid = match(hex, 'normal', 'random', 8);
  assert.ok(mid >= 6, `ふつうの CPU の勝ち ${mid}/8`);
});

test('hex: つよい CPU の 1 手は 2 秒以内', () => {
  let s = hex.newState(0);
  s = hex.apply(s, 0, { x: 4, y: 4 });
  const t0 = Date.now();
  hex.ai(s, 1, 'hard');
  assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0}ms`);
});

console.log(`\n${passed} 件すべて成功`);
