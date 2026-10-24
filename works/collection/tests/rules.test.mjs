// ルール・CPU の検証（描画なし）。実行: node works/collection/tests/rules.test.mjs
import assert from 'node:assert/strict';
import * as rev from '../app/src/games/reversi-rules.js';
import * as four from '../app/src/games/four-rules.js';
import * as dots from '../app/src/games/dots-rules.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- リバーシ ----------
test('reversi: 初期配置は 2 対 2、先手の合法手は 4 つ', () => {
  const s = rev.newState(0);
  assert.deepEqual(rev.count(s.board), [2, 2]);
  assert.equal(rev.legalMoves(s).length, 4);
});

test('reversi: 違反の手・手番違いは null', () => {
  const s = rev.newState(0);
  assert.equal(rev.apply(s, 0, { x: 0, y: 0 }), null);
  assert.equal(rev.apply(s, 1, rev.legalMoves(s)[0]), null);
  assert.equal(rev.apply(s, 0, { x: -1, y: 3 }), null);
  assert.equal(rev.apply(s, 0, null), null);
});

test('reversi: 1 手で石が増え、裏返る', () => {
  const s = rev.newState(0);
  const m = rev.legalMoves(s)[0];
  const n = rev.apply(s, 0, m);
  const c = rev.count(n.board);
  assert.equal(c[0] + c[1], 5);
  assert.equal(c[0], 2 + 1 + n.flips.length);
});

test('reversi: ランダム対 CPU の対局がすべて終局し、石数が合う', () => {
  for (let g = 0; g < 30; g++) {
    let s = rev.newState(g % 2);
    let plies = 0;
    while (s.winner === -1 && plies < 200) {
      const seat = s.turn;
      const a = seat === 0 ? rand(rev.legalMoves(s)) : rev.ai(s, seat, ['easy', 'normal'][g % 2]);
      s = rev.apply(s, seat, a);
      assert.ok(s, '合法手のはずが null');
      plies++;
    }
    assert.notEqual(s.winner, -1);
    const c = rev.count(s.board);
    assert.ok(c[0] + c[1] <= 64);
    assert.equal(s.winner, c[0] === c[1] ? 2 : c[0] > c[1] ? 0 : 1);
  }
});

test('reversi: つよい CPU はランダムにほぼ勝つ', () => {
  let wins = 0;
  for (let g = 0; g < 6; g++) {
    let s = rev.newState(g % 2);
    while (s.winner === -1) {
      const a = s.turn === 0 ? rand(rev.legalMoves(s)) : rev.ai(s, 1, 'hard');
      s = rev.apply(s, s.turn, a);
    }
    if (s.winner === 1) wins++;
  }
  assert.ok(wins >= 5, `つよい CPU の勝ち ${wins}/6`);
});

// ---------- 四目並べ ----------
const dropAll = (moves, first = 0) => {
  let s = four.newState(first);
  for (const c of moves) {
    s = four.apply(s, s.turn, { c });
    assert.ok(s);
  }
  return s;
};

test('four: 横 4 連で勝ち', () => {
  const s = dropAll([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(s.winner, 0);
  assert.equal(s.line.length, 4);
});

test('four: 縦 4 連・斜め 4 連で勝ち', () => {
  assert.equal(dropAll([0, 1, 0, 1, 0, 1, 0]).winner, 0);
  // 斜め: 0 の座席が (列0 段5)(列1 段4)(列2 段3)(列3 段2) を取る
  const s = dropAll([0, 1, 1, 2, 3, 2, 2, 3, 6, 3, 3]);
  assert.equal(s.winner, 0);
});

test('four: 満杯の列には置けない／手番違いは null', () => {
  const s = dropAll([0, 0, 0, 0, 0, 0]);
  assert.equal(four.apply(s, s.turn, { c: 0 }), null);
  assert.equal(four.apply(s, 1 - s.turn, { c: 1 }), null);
  assert.equal(four.legalMoves(s).length, 6);
});

test('four: CPU は即勝ちを決め、相手の即勝ちを防ぐ', () => {
  // 座席 0 が横に 3 つ（列 0,1,2）、座席 1 は積んだだけ。座席 0 の番なら列 3 で勝つ。
  let s = dropAll([0, 0, 1, 1, 2, 2]);
  assert.deepEqual(four.ai(s, 0, 'hard'), { c: 3 });
  // 座席 1 の番で、座席 0 が列 3 に置けば勝つ形 → 防ぐ
  s = dropAll([0, 6, 1, 6, 2]);
  assert.deepEqual(four.ai(s, 1, 'normal'), { c: 3 });
});

test('four: ランダム対 CPU の対局がすべて終局する', () => {
  for (let g = 0; g < 20; g++) {
    let s = four.newState(g % 2);
    let plies = 0;
    while (s.winner === -1 && plies < 100) {
      const a = s.turn === 0 ? rand(four.legalMoves(s)) : four.ai(s, 1, ['easy', 'normal', 'hard'][g % 3]);
      s = four.apply(s, s.turn, a);
      assert.ok(s);
      plies++;
    }
    assert.notEqual(s.winner, -1);
  }
});

// ---------- ドット囲み ----------
test('dots: 4 辺目で箱をもらい、もう 1 本引ける', () => {
  let s = dots.newState(0);
  // 左上の箱 (0,0) の辺: h(0,0) h(1,0) v(0,0) v(0,1)
  const edges = [['h', 0, 0], ['h', 1, 0], ['v', 0, 0]];
  for (const [t, i, j] of edges) {
    s = dots.apply(s, s.turn, { t, i, j });
    assert.ok(s);
  }
  assert.equal(s.turn, 1, '箱ができない手では手番が移る'); // 3 手目まで（0,1,0）→ 次は 1
  const before = s.turn;
  s = dots.apply(s, before, { t: 'v', i: 0, j: 1 });
  assert.equal(s.score[before], 1);
  assert.equal(s.turn, before, '箱を取ったら続けて引く');
  assert.deepEqual(s.taken, [0]);
});

test('dots: 同じ辺・範囲外・手番違いは null', () => {
  const s = dots.apply(dots.newState(0), 0, { t: 'h', i: 0, j: 0 });
  assert.equal(dots.apply(s, 1, { t: 'h', i: 0, j: 0 }), null);
  assert.equal(dots.apply(s, 1, { t: 'h', i: 5, j: 0 }), null);
  assert.equal(dots.apply(s, 1, { t: 'v', i: 0, j: 5 }), null);
  assert.equal(dots.apply(s, 0, { t: 'h', i: 1, j: 0 }), null);
});

test('dots: ランダム対 CPU の対局が終局し、箱の合計が 16', () => {
  for (let g = 0; g < 20; g++) {
    let s = dots.newState(g % 2);
    let plies = 0;
    while (s.winner === -1 && plies < 100) {
      const a = s.turn === 0 ? rand(dots.legalMoves(s)) : dots.ai(s, 1, ['easy', 'normal', 'hard'][g % 3]);
      s = dots.apply(s, s.turn, a);
      assert.ok(s);
      plies++;
    }
    assert.notEqual(s.winner, -1);
    assert.equal(s.score[0] + s.score[1], 16);
  }
});

test('dots: 読み切りの CPU は、残り 6 辺の局面で全探索と同じ最善値', () => {
  // 全探索（apply ベース）: 手番側から見た（自分の箱 − 相手の箱）の最大値
  const brute = (s) => {
    if (s.winner !== -1) return 0;
    let best = -Infinity;
    for (const m of dots.legalMoves(s)) {
      const n = dots.apply(s, s.turn, m);
      const gain = n.score[s.turn] - s.score[s.turn];
      const v = n.turn === s.turn ? gain + brute(n) : gain - brute(n);
      if (v > best) best = v;
    }
    return best;
  };
  for (let g = 0; g < 8; g++) {
    let s = dots.newState(0);
    while (dots.legalMoves(s).length > 6) s = dots.apply(s, s.turn, rand(dots.legalMoves(s)));
    const m = dots.ai(s, s.turn, 'hard');
    const n = dots.apply(s, s.turn, m);
    const gain = n.score[s.turn] - s.score[s.turn];
    const v = n.turn === s.turn ? gain + brute(n) : gain - brute(n);
    assert.equal(v, brute(s));
  }
});

test('dots: 読み切りの CPU（残り 16 辺）が実用的な時間で返る', () => {
  let s = dots.newState(0);
  while (dots.legalMoves(s).length > 16) s = dots.apply(s, s.turn, rand(dots.legalMoves(s)));
  const t0 = Date.now();
  const m = dots.ai(s, s.turn, 'hard');
  const ms = Date.now() - t0;
  assert.ok(dots.apply(s, s.turn, m));
  console.log(`   読み切り 16 辺: ${ms}ms`);
  assert.ok(ms < 3000, `${ms}ms は遅すぎる`);
});

console.log(`\n${passed} 件すべて成功`);
