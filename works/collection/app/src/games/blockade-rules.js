// ぶろっけーぽん（ブロッケード）のルールと CPU（描画・通信とは独立）。
// 9×9 の盤。各自のコマは 2 つで、相手の出発マス 2 つに両方とも着いたら勝ち。
// 自分の番は「コマを 1 つ、最大 2 マス進める（飛び越し不可）」か「壁を 1 枚置く」のどちらか。壁は 2 マス分の長さで、各自 8 枚。
// 壁を置いて、どれかのコマが自分のゴールのどれにも行けなくなる置き方は禁止。決着がつかないまま 300 手で引き分け。
// 壁の座標と「塞がれているか」の判定は、こりぽーるのルール（wall-race-rules.js）と同じ。
// 状態: { pawns: [[{x,y},{x,y}], [{x,y},{x,y}]], walls, left: [8, 8], turn, winner(-1 続行 / 0 / 1 / 2 引き分け), plies, last }
// 手: { k: 'move', p: 0 | 1, x, y } | { k: 'wall', x, y, o: 'h' | 'v' } | { k: 'pass' }（動かすことも壁を置くこともできないとき）
import { N, blocked } from './wall-race-rules.js';

export { N };
export const WALLS_EACH = 8;
export const MAX_PLIES = 300;
export const STARTS = [
  [{ x: 2, y: N - 1 }, { x: 6, y: N - 1 }],
  [{ x: 2, y: 0 }, { x: 6, y: 0 }],
];
// 座席 seat が目指すマス（相手の出発マス）
export const goalsOf = (seat) => STARTS[1 - seat];

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const hasWall = (walls, x, y, o) => walls.some((w) => w.x === x && w.y === y && w.o === o);

export function newState(first = 0) {
  return {
    pawns: [STARTS[0].map((p) => ({ ...p })), STARTS[1].map((p) => ({ ...p }))],
    walls: [],
    left: [WALLS_EACH, WALLS_EACH],
    turn: first === 1 ? 1 : 0,
    winner: -1,
    plies: 0,
    last: null,
  };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

const occupied = (s, x, y) => s.pawns.some((team) => team.some((p) => p.x === x && p.y === y));

// コマ p が 1 手で行けるマス（最大 2 歩。壁・他のコマは越えられない）
export function reachable(s, seat, p) {
  const from = s.pawns[seat][p];
  const out = [];
  const seen = new Set([from.y * N + from.x]);
  let frontier = [[from.x, from.y]];
  for (let step = 1; step <= 2; step++) {
    const nextFrontier = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (blocked(s.walls, x, y, nx, ny) || occupied(s, nx, ny) || seen.has(ny * N + nx)) continue;
        seen.add(ny * N + nx);
        out.push({ x: nx, y: ny });
        nextFrontier.push([nx, ny]);
      }
    }
    frontier = nextFrontier;
  }
  return out;
}

// 壁を無視したコマの最短手数（コマ以外の障害物は壁だけ）。行けなければ Infinity。
export function dist(walls, from, goals) {
  const seen = new Map([[from.y * N + from.x, 0]]);
  const q = [[from.x, from.y]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    const d = seen.get(y * N + x);
    if (goals.some((g) => g.x === x && g.y === y)) return d;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(walls, x, y, nx, ny) || seen.has(ny * N + nx)) continue;
      seen.set(ny * N + nx, d + 1);
      q.push([nx, ny]);
    }
  }
  return Infinity;
}

export function canPlaceWall(s, seat, w) {
  if (w.o !== 'h' && w.o !== 'v') return false;
  if (!Number.isInteger(w.x) || !Number.isInteger(w.y) || w.x < 0 || w.y < 0 || w.x > N - 2 || w.y > N - 2) return false;
  if (s.left[seat] <= 0) return false;
  const other = w.o === 'h' ? 'v' : 'h';
  if (hasWall(s.walls, w.x, w.y, w.o) || hasWall(s.walls, w.x, w.y, other)) return false;
  const dx = w.o === 'h' ? 1 : 0;
  const dy = w.o === 'v' ? 1 : 0;
  if (hasWall(s.walls, w.x + dx, w.y + dy, w.o) || hasWall(s.walls, w.x - dx, w.y - dy, w.o)) return false;
  const walls = [...s.walls, { x: w.x, y: w.y, o: w.o }];
  for (const who of [0, 1]) for (const p of s.pawns[who]) if (dist(walls, p, goalsOf(who)) === Infinity) return false;
  return true;
}

export function legalMoves(s, seat = s.turn) {
  const out = [];
  for (const p of [0, 1]) for (const t of reachable(s, seat, p)) out.push({ k: 'move', p, x: t.x, y: t.y });
  if (s.left[seat] > 0) {
    for (let y = 0; y < N - 1; y++) {
      for (let x = 0; x < N - 1; x++) for (const o of ['h', 'v']) if (canPlaceWall(s, seat, { x, y, o })) out.push({ k: 'wall', x, y, o });
    }
  }
  if (!out.length) out.push({ k: 'pass' }); // 動かせるコマも置ける壁もないときは、パス
  return out;
}

const onGoals = (team, goals) => team.every((p) => goals.some((g) => g.x === p.x && g.y === p.y)) && !(team[0].x === team[1].x && team[0].y === team[1].y);

export function apply(s, seat, a) {
  if (s.winner !== -1 || s.turn !== seat || !a) return null;
  let next;
  if (a.k === 'pass') {
    if (legalMoves(s, seat).some((m) => m.k !== 'pass')) return null;
    next = { ...s, last: { k: 'pass', who: seat } };
  } else if (a.k === 'move') {
    if (a.p !== 0 && a.p !== 1) return null;
    if (!reachable(s, seat, a.p).some((t) => t.x === a.x && t.y === a.y)) return null;
    const pawns = s.pawns.map((team) => team.map((p) => ({ ...p })));
    const from = { ...pawns[seat][a.p] };
    pawns[seat][a.p] = { x: a.x, y: a.y };
    next = { ...s, pawns, last: { k: 'move', p: a.p, who: seat, from, x: a.x, y: a.y } };
  } else if (a.k === 'wall') {
    if (!canPlaceWall(s, seat, a)) return null;
    const left = [...s.left];
    left[seat]--;
    next = { ...s, walls: [...s.walls, { x: a.x, y: a.y, o: a.o }], left, last: { k: 'wall', who: seat, x: a.x, y: a.y, o: a.o } };
  } else return null;
  next.turn = 1 - seat;
  next.plies = s.plies + 1;
  next.winner = -1;
  if (onGoals(next.pawns[seat], goalsOf(seat))) next.winner = seat;
  else if (next.plies >= MAX_PLIES) next.winner = 2;
  return next;
}

// ---- CPU ----
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pawnDist(s, seat) {
  const goals = goalsOf(seat);
  return s.pawns[seat].reduce((sum, p) => sum + Math.min(dist(s.walls, p, goals), 40), 0);
}

function evaluate(s, me) {
  if (s.winner === me) return 1000;
  if (s.winner === 1 - me) return -1000;
  if (s.winner === 2) return 0;
  return pawnDist(s, 1 - me) - pawnDist(s, me) + (s.left[me] - s.left[1 - me]) * 0.15;
}

// 相手のコマの最短経路をまたぐ壁を、効果の大きい順に少数だけ候補にする
function wallCandidates(s, seat, k) {
  if (s.left[seat] <= 0) return [];
  const goals = goalsOf(1 - seat);
  const base = pawnDist(s, 1 - seat);
  const seen = new Set();
  const out = [];
  for (const p of s.pawns[1 - seat]) {
    for (let x = Math.max(0, p.x - 2); x <= Math.min(N - 2, p.x + 1); x++) {
      for (let y = Math.max(0, p.y - 2); y <= Math.min(N - 2, p.y + 1); y++) {
        for (const o of ['h', 'v']) {
          const key = `${x},${y},${o}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const w = { x, y, o };
          if (!canPlaceWall(s, seat, w)) continue;
          const t = { ...s, walls: [...s.walls, w] };
          const gain = pawnDist(t, 1 - seat) - base;
          if (gain > 0) out.push({ a: { k: 'wall', x, y, o }, gain });
        }
      }
    }
  }
  void goals;
  out.sort((p, q) => q.gain - p.gain);
  return out.slice(0, k).map((x) => x.a);
}

function cands(s, seat, k) {
  const out = [];
  for (const p of [0, 1]) for (const t of reachable(s, seat, p)) out.push({ k: 'move', p, x: t.x, y: t.y });
  return out.concat(wallCandidates(s, seat, k));
}

function search(s, seat, depth, alpha, beta, me, k) {
  if (s.winner !== -1 || depth === 0) return evaluate(s, me);
  const moves = cands(s, seat, k);
  if (!moves.length) return evaluate(s, me);
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
    // 7 割は前へ進み、3 割はでたらめ
    const all = legalMoves(s, seat);
    if (Math.random() < 0.3) return pick(all);
    const moves = all.filter((m) => m.k === 'move');
    let best = moves;
    let bv = -Infinity;
    for (const m of moves) {
      const v = -pawnDist(apply(s, seat, m), seat) + Math.random();
      if (v > bv) {
        bv = v;
        best = [m];
      }
    }
    return best[0] || pick(all);
  }
  const depth = level === 'hard' ? 2 : 1;
  const moves = cands(s, seat, level === 'hard' ? 8 : 6);
  if (!moves.length) return null;
  let best = moves[0];
  let bv = -Infinity;
  for (const m of moves) {
    const v = search(apply(s, seat, m), 1 - seat, depth - 1, -Infinity, Infinity, seat, 6) + Math.random() * 0.01;
    if (v > bv) {
      bv = v;
      best = m;
    }
  }
  return best;
}
