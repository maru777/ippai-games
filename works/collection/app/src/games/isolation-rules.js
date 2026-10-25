// あいぽれーしょん（アイソレーション）のルールと CPU（描画・通信とは独立）。
// 7×7 の盤。1 手 = 自分のコマを隣（斜めも可）の空きマスへ 1 つ動かし、そのあと空きマスを 1 つ選んで消す。
// 自分の番に動かせなくなったら負け。座席 0 は下側、座席 1 は上側から始まる。
// 状態: { gone: 49 マス（0 空き / 1 消えた）, pawns: [{x,y},{x,y}], turn, winner(-1 続行 / 0 / 1), last }
// 手: { x, y, rx, ry }（コマの行き先と、消すマス）
export const N = 7;

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const idx = (x, y) => y * N + x;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function newState(first = 0) {
  return { gone: Array(N * N).fill(0), pawns: [{ x: 3, y: N - 1 }, { x: 3, y: 0 }], turn: first === 1 ? 1 : 0, winner: -1, last: null };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

const free = (s, x, y, extra) => inBoard(x, y) && !s.gone[idx(x, y)] && !s.pawns.some((p) => p.x === x && p.y === y) && !(extra && extra.x === x && extra.y === y);

// seat のコマの行き先
export function steps(s, seat) {
  const p = s.pawns[seat];
  const out = [];
  for (const [dx, dy] of DIRS) {
    if (free(s, p.x + dx, p.y + dy)) out.push({ x: p.x + dx, y: p.y + dy });
  }
  return out;
}

// 消せるマス（コマがいない空きマス）。to は動かした先（まだ盤に反映していないとき用）、from は動かす前の位置。
function erasable(s, seat, to) {
  const out = [];
  const me = s.pawns[seat];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (s.gone[idx(x, y)]) continue;
      if (x === to.x && y === to.y) continue;
      if (x === s.pawns[1 - seat].x && y === s.pawns[1 - seat].y) continue;
      // 動かす前の位置は、動かしたあとは空く
      if (x === me.x && y === me.y) { out.push({ x, y }); continue; }
      out.push({ x, y });
    }
  }
  return out;
}

export function legalMoves(s, seat = s.turn) {
  const out = [];
  for (const to of steps(s, seat)) for (const r of erasable(s, seat, to)) out.push({ x: to.x, y: to.y, rx: r.x, ry: r.y });
  return out;
}

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn || !a) return null;
  if (![a.x, a.y, a.rx, a.ry].every(Number.isInteger)) return null;
  if (!steps(s, seat).some((m) => m.x === a.x && m.y === a.y)) return null;
  if (!erasable(s, seat, a).some((m) => m.x === a.rx && m.y === a.ry)) return null;
  const gone = s.gone.slice();
  gone[idx(a.rx, a.ry)] = 1;
  const pawns = s.pawns.map((p) => ({ ...p }));
  pawns[seat] = { x: a.x, y: a.y };
  const next = { gone, pawns, turn: 1 - seat, winner: -1, last: { x: a.x, y: a.y, rx: a.rx, ry: a.ry, who: seat } };
  if (!steps(next, 1 - seat).length) next.winner = seat;
  return next;
}

// ---- CPU ----
// 盤の領域の見積もり: 各マスに、先に着けるのがどちらかを数える（同時は数えない）。
function territory(s, seat) {
  const dist = [new Map(), new Map()];
  for (const w of [0, 1]) {
    const q = [[s.pawns[w].x, s.pawns[w].y]];
    dist[w].set(idx(s.pawns[w].x, s.pawns[w].y), 0);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      const d = dist[w].get(idx(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBoard(nx, ny) || s.gone[idx(nx, ny)] || dist[w].has(idx(nx, ny))) continue;
        dist[w].set(idx(nx, ny), d + 1);
        q.push([nx, ny]);
      }
    }
  }
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < N * N; i++) {
    const a = dist[seat].get(i);
    const b = dist[1 - seat].get(i);
    if (a !== undefined && (b === undefined || a < b)) mine++;
    else if (b !== undefined && (a === undefined || b < a)) theirs++;
  }
  return mine - theirs;
}

function evaluate(s, seat) {
  if (s.winner !== -1) return s.winner === seat ? 1000 : -1000;
  return territory(s, seat) * 1.5 + (steps(s, seat).length - steps(s, 1 - seat).length) * 1.0;
}

// 消す候補を絞る: 相手のコマのまわり・自分の行き先のまわりを優先し、少数だけ試す
function candidates(s, seat, limit) {
  const out = [];
  for (const to of steps(s, seat)) {
    const opp = s.pawns[1 - seat];
    const near = erasable(s, seat, to)
      .map((r) => ({ r, k: Math.max(Math.abs(r.x - opp.x), Math.abs(r.y - opp.y)) * 2 + Math.max(Math.abs(r.x - to.x), Math.abs(r.y - to.y)) * 0.5 }))
      .sort((p, q) => p.k - q.k)
      .slice(0, limit);
    for (const { r } of near) out.push({ x: to.x, y: to.y, rx: r.x, ry: r.y });
  }
  return out;
}

function search(s, seat, depth, alpha, beta, me, limit) {
  if (s.winner !== -1 || depth === 0) return evaluate(s, me);
  const moves = candidates(s, seat, limit);
  if (!moves.length) return seat === me ? -1000 : 1000;
  if (seat === me) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(apply(s, seat, m), 1 - seat, depth - 1, alpha, beta, me, limit));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(apply(s, seat, m), 1 - seat, depth - 1, alpha, beta, me, limit));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function ai(s, seat, level = 'normal') {
  if (level === 'easy') {
    const all = legalMoves(s, seat);
    return all.length ? pick(all) : null;
  }
  const depth = level === 'hard' ? 3 : 1;
  const limit = level === 'hard' ? 5 : 4;
  const moves = candidates(s, seat, limit);
  if (!moves.length) return null;
  let best = [];
  let bv = -Infinity;
  for (const m of moves) {
    const v = search(apply(s, seat, m), 1 - seat, depth - 1, -Infinity, Infinity, seat, limit) + Math.random() * 0.01;
    if (v > bv) {
      bv = v;
      best = [m];
    }
  }
  return best[0];
}
