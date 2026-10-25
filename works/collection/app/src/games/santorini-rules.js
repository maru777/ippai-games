// ぽんとりーに（サントリーニ）のルールと CPU（描画・通信とは独立）。
// 5×5 の盤に、各自の作業員 2 人。1 手 = 作業員を隣（斜めも可）へ 1 マス動かし、そのまわり 1 マスに積み木を 1 段積む。
// 動ける先は、今いる所より 1 段までしか高くなく、ドーム（4 段目）や他の作業員のいるマスには行けない。
// 3 段目に登ったら勝ち。自分の番に動けない（または積めない）なら負け。先手・後手の初期位置は固定。
// 状態: { h: 25 マス（0〜3 段、4 = ドーム）, workers: [[{x,y},{x,y}], [{x,y},{x,y}]], turn, winner(-1 続行 / 0 / 1), last }
// 手: { w: 0 | 1, x, y, bx, by }（3 段目へ登って勝つ手は bx, by を省く）
export const N = 5;

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const idx = (x, y) => y * N + x;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function newState(first = 0) {
  return {
    h: Array(N * N).fill(0),
    workers: [[{ x: 1, y: 3 }, { x: 3, y: 3 }], [{ x: 1, y: 1 }, { x: 3, y: 1 }]],
    turn: first === 1 ? 1 : 0,
    winner: -1,
    last: null,
  };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

const occupied = (s, x, y, ignore) => s.workers.some((team, who) => team.some((p, i) => p.x === x && p.y === y && !(ignore && ignore.who === who && ignore.i === i)));

// 作業員 (seat, w) の行き先
export function steps(s, seat, w) {
  const p = s.workers[seat][w];
  const out = [];
  for (const [dx, dy] of DIRS) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (!inBoard(x, y) || occupied(s, x, y)) continue;
    const hh = s.h[idx(x, y)];
    if (hh >= 4 || hh > s.h[idx(p.x, p.y)] + 1) continue;
    out.push({ x, y });
  }
  return out;
}

// (x, y) に動いたあとに積めるマス（動く前のマスは空く）
export function builds(s, seat, w, x, y) {
  const from = s.workers[seat][w];
  const out = [];
  for (const [dx, dy] of DIRS) {
    const bx = x + dx;
    const by = y + dy;
    if (!inBoard(bx, by) || s.h[idx(bx, by)] >= 4) continue;
    if (occupied(s, bx, by, { who: seat, i: w })) continue;
    if (bx === from.x && by === from.y && false) continue;
    out.push({ x: bx, y: by });
  }
  return out;
}

export function legalMoves(s, seat = s.turn) {
  const out = [];
  for (const w of [0, 1]) {
    for (const t of steps(s, seat, w)) {
      if (s.h[idx(t.x, t.y)] === 3) {
        out.push({ w, x: t.x, y: t.y });
        continue;
      }
      for (const b of builds(s, seat, w, t.x, t.y)) out.push({ w, x: t.x, y: t.y, bx: b.x, by: b.y });
    }
  }
  return out;
}

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn || !a) return null;
  if (a.w !== 0 && a.w !== 1) return null;
  if (!Number.isInteger(a.x) || !Number.isInteger(a.y)) return null;
  if (!steps(s, seat, a.w).some((t) => t.x === a.x && t.y === a.y)) return null;
  const workers = s.workers.map((team) => team.map((p) => ({ ...p })));
  const from = { ...workers[seat][a.w] };
  workers[seat][a.w] = { x: a.x, y: a.y };
  const h = s.h.slice();
  const next = { h, workers, turn: 1 - seat, winner: -1, last: { who: seat, w: a.w, from, x: a.x, y: a.y, bx: -1, by: -1 } };
  if (h[idx(a.x, a.y)] === 3) {
    next.winner = seat;
    return next;
  }
  if (!Number.isInteger(a.bx) || !Number.isInteger(a.by)) return null;
  if (!builds(s, seat, a.w, a.x, a.y).some((b) => b.x === a.bx && b.y === a.by)) return null;
  h[idx(a.bx, a.by)]++;
  next.last.bx = a.bx;
  next.last.by = a.by;
  if (!legalMoves(next, 1 - seat).length) next.winner = seat;
  return next;
}

// ---- CPU ----
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const hasWin = (s, seat) => {
  for (const w of [0, 1]) for (const t of steps(s, seat, w)) if (s.h[idx(t.x, t.y)] === 3) return true;
  return false;
};

function evaluate(s, me) {
  if (s.winner !== -1) return s.winner === me ? 10000 : -10000;
  let v = 0;
  for (const who of [0, 1]) {
    const sign = who === me ? 1 : -1;
    for (let w = 0; w < 2; w++) {
      const p = s.workers[who][w];
      const hh = s.h[idx(p.x, p.y)];
      v += sign * (hh * hh * 4 + (2 - Math.abs(p.x - 2) - Math.abs(p.y - 2) * 0.5) * 1.2 + steps(s, who, w).length * 0.6);
    }
  }
  // 次の手で登られる／登れる
  if (hasWin(s, s.turn)) v += s.turn === me ? 300 : -300;
  return v;
}

function search(s, depth, alpha, beta, me) {
  if (s.winner !== -1 || depth === 0) return evaluate(s, me);
  const moves = legalMoves(s, s.turn);
  if (!moves.length) return s.turn === me ? -10000 : 10000;
  if (s.turn === me) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(s, s.turn, m), depth - 1, alpha, beta, me));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(s, s.turn, m), depth - 1, alpha, beta, me));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function ai(s, seat, level = 'normal') {
  const all = legalMoves(s, seat);
  if (!all.length) return null;
  // どの強さでも、登って勝てるなら勝つ
  const win = all.find((m) => m.bx === undefined);
  if (win) return win;
  if (level === 'easy') return pick(all);
  const depth = level === 'hard' ? 3 : 2;
  let best = [];
  let bv = -Infinity;
  for (const m of all) {
    const v = search(apply(s, seat, m), depth - 1, -Infinity, Infinity, seat) + Math.random() * 0.01;
    if (v > bv) {
      bv = v;
      best = [m];
    }
  }
  return best[0];
}
