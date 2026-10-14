// かべレースの CPU。状態と座席から「次の 1 手」を返す（描画・通信とは独立）。
// 評価 = (相手の最短手数 − 自分の最短手数) + 0.4 × (自分の残り壁 − 相手の残り壁)。壁は温存すると少し得になる。
import { N, legalMoves, canPlaceWall, apply, pathLength, goalRow } from './wall-race-rules.js';

export const LEVELS = [
  { id: 'easy', label: 'かんたん' },
  { id: 'normal', label: 'ふつう' },
  { id: 'hard', label: 'つよい' },
];

const WALL_COST = 0.4;

function evaluate(s, seat) {
  const me = pathLength(s.walls, s.pawns[seat], goalRow(seat));
  const op = pathLength(s.walls, s.pawns[1 - seat], goalRow(1 - seat));
  return op - me + WALL_COST * (s.left[seat] - s.left[1 - seat]);
}

// 指せる手の一覧（移動 + 置ける壁）
function candidates(s, seat) {
  const out = legalMoves(s, seat).map((m) => ({ k: 'move', x: m.x, y: m.y }));
  if (s.left[seat] > 0) {
    for (let y = 0; y < N - 1; y++) {
      for (let x = 0; x < N - 1; x++) {
        for (const o of ['h', 'v']) {
          if (canPlaceWall(s, seat, { x, y, o }).ok) out.push({ k: 'wall', x, y, o });
        }
      }
    }
  }
  return out;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 最も評価の高い手（同点はランダム）。noise は評価のゆらぎ（弱い CPU ほど大きい）
function best(list, noise = 0) {
  let top = -Infinity;
  let tops = [];
  for (const c of list) {
    const v = c.v + (noise ? (Math.random() - 0.5) * noise : 0);
    if (v > top + 1e-9) {
      top = v;
      tops = [c];
    } else if (Math.abs(v - top) <= 1e-9) {
      tops.push(c);
    }
  }
  return pick(tops);
}

function shortestMove(s, seat) {
  const moves = legalMoves(s, seat);
  const scored = moves.map((m) => ({
    a: { k: 'move', x: m.x, y: m.y },
    v: -pathLength(s.walls, { x: m.x, y: m.y }, goalRow(seat)),
  }));
  return best(scored).a;
}

export function chooseAction(s, seat, level) {
  if (level === 'easy') {
    const moves = legalMoves(s, seat);
    if (Math.random() < 0.2) {
      const m = pick(moves);
      return { k: 'move', x: m.x, y: m.y };
    }
    // ときどき、相手を 2 手以上遠回りさせられる壁だけ置く
    if (s.left[seat] > 0 && Math.random() < 0.15) {
      const base = pathLength(s.walls, s.pawns[1 - seat], goalRow(1 - seat));
      const good = candidates(s, seat)
        .filter((c) => c.k === 'wall')
        .filter((c) => pathLength([...s.walls, c], s.pawns[1 - seat], goalRow(1 - seat)) - base >= 2);
      if (good.length) return pick(good);
    }
    return shortestMove(s, seat);
  }

  const cands = candidates(s, seat);
  if (level === 'normal') {
    const scored = cands.map((a) => ({ a, v: evaluate(apply(s, seat, a), seat) }));
    return best(scored, 0.6).a;
  }

  // つよい: 自分の手 → 相手の最善の返し、の 2 手先を読む（評価の高い順に絞って探索する）
  const first = cands
    .map((a) => ({ a, next: apply(s, seat, a), v: 0 }))
    .map((c) => ({ ...c, v: evaluate(c.next, seat) }))
    .sort((p, q) => q.v - p.v)
    .slice(0, 14);
  const scored = first.map((c) => {
    if (c.next.winner !== -1) return { a: c.a, v: 1000 };
    let worst = Infinity;
    for (const b of candidates(c.next, 1 - seat)) {
      const after = apply(c.next, 1 - seat, b);
      const v = after.winner !== -1 ? -1000 : evaluate(after, seat);
      if (v < worst) worst = v;
    }
    return { a: c.a, v: worst };
  });
  return best(scored, 0.1).a;
}
