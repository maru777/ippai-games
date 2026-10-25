// あまぽん（アマゾン）のルールと CPU（描画・通信とは独立）。
// 6×6 の盤に、各自クイーン 2 体。1 手 = クイーンを（縦・横・斜めに、飛び越さず）好きなだけ動かし、
// 動かした先から同じように「矢」を 1 本撃って、そのマスをふさぐ。自分の番に動かせなくなったら負け。
// 状態: { cells: 36 マス（-1 空き / 0 / 1 クイーン / 2 矢）, turn, winner(-1 続行 / 0 / 1), last }
// 手: { fx, fy, tx, ty, ax, ay }（動かす前・行き先・矢のマス）
export const N = 6;

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const idx = (x, y) => y * N + x;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function newState(first = 0) {
  const cells = Array(N * N).fill(-1);
  // 座席 1 は上、座席 0 は下。{1,4} 列に 2 体ずつ
  for (const x of [1, 4]) {
    cells[idx(x, 0)] = 1;
    cells[idx(x, N - 1)] = 0;
  }
  return { cells, turn: first === 1 ? 1 : 0, winner: -1, last: null };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

// (x, y) から、飛び越さずに行けるマス（cells は盤の配列。from のマスは空いているものとして扱う）
export function reach(cells, x, y) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBoard(nx, ny) && cells[idx(nx, ny)] === -1) {
      out.push({ x: nx, y: ny });
      nx += dx;
      ny += dy;
    }
  }
  return out;
}

export function queensOf(cells, seat) {
  const out = [];
  for (let i = 0; i < N * N; i++) if (cells[i] === seat) out.push({ x: i % N, y: Math.floor(i / N) });
  return out;
}

export function legalMoves(s, seat = s.turn) {
  const out = [];
  for (const q of queensOf(s.cells, seat)) {
    const base = s.cells.slice();
    base[idx(q.x, q.y)] = -1; // 動かす前のマスは、矢を撃つときには空いている
    for (const t of reach(s.cells, q.x, q.y)) {
      const c = base.slice();
      c[idx(t.x, t.y)] = seat;
      for (const a of reach(c, t.x, t.y)) out.push({ fx: q.x, fy: q.y, tx: t.x, ty: t.y, ax: a.x, ay: a.y });
    }
  }
  return out;
}

const hasMove = (cells, seat) => queensOf(cells, seat).some((q) => reach(cells, q.x, q.y).length > 0);

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn || !a) return null;
  if (![a.fx, a.fy, a.tx, a.ty, a.ax, a.ay].every(Number.isInteger)) return null;
  if (!inBoard(a.fx, a.fy) || !inBoard(a.tx, a.ty) || !inBoard(a.ax, a.ay)) return null;
  if (s.cells[idx(a.fx, a.fy)] !== seat) return null;
  if (!reach(s.cells, a.fx, a.fy).some((m) => m.x === a.tx && m.y === a.ty)) return null;
  const cells = s.cells.slice();
  cells[idx(a.fx, a.fy)] = -1;
  cells[idx(a.tx, a.ty)] = seat;
  if (!reach(cells, a.tx, a.ty).some((m) => m.x === a.ax && m.y === a.ay)) return null;
  cells[idx(a.ax, a.ay)] = 2;
  const next = { cells, turn: 1 - seat, winner: -1, last: { ...a, who: seat } };
  if (!hasMove(cells, 1 - seat)) next.winner = seat;
  return next;
}

// ---- CPU ----
// 各マスに、先に着けるのがどちらかを数える（クイーンの動きでの最短手数）。
function queenDist(cells, qs) {
  const dist = new Array(N * N).fill(Infinity);
  const q = [];
  for (const p of qs) {
    dist[idx(p.x, p.y)] = 0;
    q.push([p.x, p.y]);
  }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    const d = dist[idx(x, y)];
    for (const [dx, dy] of DIRS) {
      let nx = x + dx;
      let ny = y + dy;
      while (inBoard(nx, ny) && (cells[idx(nx, ny)] === -1 || dist[idx(nx, ny)] === 0)) {
        if (dist[idx(nx, ny)] === Infinity) {
          dist[idx(nx, ny)] = d + 1;
          q.push([nx, ny]);
        }
        nx += dx;
        ny += dy;
      }
    }
  }
  return dist;
}

function evaluate(s, seat) {
  if (s.winner !== -1) return s.winner === seat ? 1000 : -1000;
  const dm = queenDist(s.cells, queensOf(s.cells, seat));
  const dt = queenDist(s.cells, queensOf(s.cells, 1 - seat));
  let v = 0;
  for (let i = 0; i < N * N; i++) {
    if (s.cells[i] !== -1) continue;
    if (dm[i] < dt[i]) v += 1 + (dm[i] === Infinity ? 0 : 0.2 / (1 + dm[i]));
    else if (dt[i] < dm[i]) v -= 1 + (dt[i] === Infinity ? 0 : 0.2 / (1 + dt[i]));
    else if (dm[i] !== Infinity) v += seat === s.turn ? 0.15 : -0.15; // 同着は手番側が少し有利
  }
  return v;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function topMoves(s, seat, k) {
  const all = legalMoves(s, seat);
  if (all.length <= k) return all;
  const scored = all.map((m) => ({ m, v: evaluate(apply({ ...s, turn: seat, winner: -1 }, seat, m), seat) }));
  scored.sort((p, q) => q.v - p.v);
  return scored.slice(0, k).map((x) => x.m);
}

function search(s, seat, depth, alpha, beta, me, k) {
  if (s.winner !== -1 || depth === 0) return evaluate(s, me);
  const moves = topMoves(s, seat, k);
  if (!moves.length) return seat === me ? -1000 : 1000;
  if (seat === me) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(s, seat, m), 1 - seat, depth - 1, alpha, beta, me, k));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(s, seat, m), 1 - seat, depth - 1, alpha, beta, me, k));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function ai(s, seat, level = 'normal') {
  if (level === 'easy') {
    const all = legalMoves(s, seat);
    return all.length ? pick(all) : null;
  }
  const first = level === 'hard' ? 14 : 30; // 最初の手は多めに候補を持つ
  const moves = topMoves(s, seat, first);
  if (!moves.length) return null;
  if (level === 'normal') return moves[0];
  let best = moves[0];
  let bv = -Infinity;
  for (const m of moves) {
    const v = search(apply(s, seat, m), 1 - seat, 1, -Infinity, Infinity, seat, 8) + Math.random() * 0.01;
    if (v > bv) {
      bv = v;
      best = m;
    }
  }
  return best;
}
