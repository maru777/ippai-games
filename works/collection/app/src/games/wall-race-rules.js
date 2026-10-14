// かべレースのルール（描画・通信を含まない純粋なロジック。node でも検証できる）。
// 盤は 9×9。座席 0 は下端(y=8)から上端(y=0)へ、座席 1 は上端(y=0)から下端(y=8)へ進む。
// 壁は 2 マス分の長さ。{ x, y, o } は (x,y) と (x+1,y+1) の 4 マスの交点に置く壁で、
//   o='h': 行 y と y+1 の間を、列 x と x+1 にわたって塞ぐ（横壁）
//   o='v': 列 x と x+1 の間を、行 y と y+1 にわたって塞ぐ（縦壁）
export const N = 9;
export const WALLS_EACH = 10;

// first: 最初に指す座席（0 か 1）。先手・後手は呼び出し側がランダムに決める。
export function newState(first = 0) {
  return {
    pawns: [{ x: 4, y: 8 }, { x: 4, y: 0 }],
    walls: [],
    left: [WALLS_EACH, WALLS_EACH],
    turn: first === 1 ? 1 : 0,
    winner: -1,
  };
}

export function cloneState(s) {
  return {
    pawns: s.pawns.map((p) => ({ ...p })),
    walls: s.walls.map((w) => ({ ...w })),
    left: [...s.left],
    turn: s.turn,
    winner: s.winner,
  };
}

export function goalRow(seat) {
  return seat === 0 ? 0 : N - 1;
}

const hasWall = (walls, x, y, o) => walls.some((w) => w.x === x && w.y === y && w.o === o);

// 隣り合う 2 マス (x,y)→(nx,ny) の間が壁で塞がれているか（盤の外も塞がれている扱い）
export function blocked(walls, x, y, nx, ny) {
  if (nx < 0 || ny < 0 || nx >= N || ny >= N) return true;
  if (ny === y) {
    const c = Math.min(x, nx);
    return hasWall(walls, c, y, 'v') || hasWall(walls, c, y - 1, 'v');
  }
  const r = Math.min(y, ny);
  return hasWall(walls, x, r, 'h') || hasWall(walls, x - 1, r, 'h');
}

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// 座席 seat のコマが 1 手で行ける升（飛び越し・斜め移動を含む）
export function legalMoves(s, seat) {
  const me = s.pawns[seat];
  const op = s.pawns[1 - seat];
  const out = [];
  for (const [dx, dy] of DIRS) {
    const nx = me.x + dx;
    const ny = me.y + dy;
    if (blocked(s.walls, me.x, me.y, nx, ny)) continue;
    if (nx !== op.x || ny !== op.y) {
      out.push({ x: nx, y: ny });
      continue;
    }
    // 相手が隣にいる: まっすぐ飛び越す。後ろが塞がれていれば斜めへ。
    const jx = nx + dx;
    const jy = ny + dy;
    if (!blocked(s.walls, nx, ny, jx, jy)) {
      out.push({ x: jx, y: jy });
    } else {
      for (const [sx, sy] of DIRS) {
        if (sx === dx && sy === dy) continue;
        if (sx === -dx && sy === -dy) continue;
        const tx = nx + sx;
        const ty = ny + sy;
        if (!blocked(s.walls, nx, ny, tx, ty)) out.push({ x: tx, y: ty });
      }
    }
  }
  return out;
}

// 壁を無視した最短手数。ゴールに行けなければ Infinity。
export function pathLength(walls, from, goal) {
  const dist = new Map();
  const key = (x, y) => y * N + x;
  const q = [[from.x, from.y]];
  dist.set(key(from.x, from.y), 0);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    const d = dist.get(key(x, y));
    if (y === goal) return d;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (blocked(walls, x, y, nx, ny) || dist.has(key(nx, ny))) continue;
      dist.set(key(nx, ny), d + 1);
      q.push([nx, ny]);
    }
  }
  return Infinity;
}

// 壁を置けるか。理由は reason に入る（置けるときは ok: true）。
export function canPlaceWall(s, seat, w) {
  if (w.o !== 'h' && w.o !== 'v') return { ok: false, reason: 'bad' };
  if (!Number.isInteger(w.x) || !Number.isInteger(w.y)) return { ok: false, reason: 'bad' };
  if (w.x < 0 || w.y < 0 || w.x > N - 2 || w.y > N - 2) return { ok: false, reason: 'range' };
  if (s.left[seat] <= 0) return { ok: false, reason: 'none-left' };
  const other = w.o === 'h' ? 'v' : 'h';
  if (hasWall(s.walls, w.x, w.y, w.o) || hasWall(s.walls, w.x, w.y, other)) {
    return { ok: false, reason: 'overlap' };
  }
  const dx = w.o === 'h' ? 1 : 0;
  const dy = w.o === 'v' ? 1 : 0;
  if (hasWall(s.walls, w.x + dx, w.y + dy, w.o) || hasWall(s.walls, w.x - dx, w.y - dy, w.o)) {
    return { ok: false, reason: 'overlap' };
  }
  const walls = [...s.walls, { x: w.x, y: w.y, o: w.o }];
  for (const p of [0, 1]) {
    if (pathLength(walls, s.pawns[p], goalRow(p)) === Infinity) {
      return { ok: false, reason: 'blocks-path' };
    }
  }
  return { ok: true };
}

// 手を適用した新しい状態を返す。不正な手なら null（呼び出し側で無視する）。
// action: { k: 'move', x, y } | { k: 'wall', x, y, o }
export function apply(s, seat, action) {
  if (s.winner !== -1 || s.turn !== seat || !action) return null;
  const next = cloneState(s);
  if (action.k === 'move') {
    if (!legalMoves(s, seat).some((m) => m.x === action.x && m.y === action.y)) return null;
    next.pawns[seat] = { x: action.x, y: action.y };
    if (action.y === goalRow(seat)) next.winner = seat;
  } else if (action.k === 'wall') {
    if (!canPlaceWall(s, seat, action).ok) return null;
    next.walls.push({ x: action.x, y: action.y, o: action.o });
    next.left[seat]--;
  } else {
    return null;
  }
  next.turn = 1 - seat;
  return next;
}
