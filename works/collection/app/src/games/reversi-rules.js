// リバーシのルールと CPU（描画・通信とは独立）。座席 0 / 1 がそのまま石の色。
// 状態: { board: 64 マス（-1 空 / 0 / 1）, turn, winner(-1 続行 / 0 / 1 / 2 引き分け), passed(直前にパスした座席 / -1), last, flips }
// 手: { x, y }
export const N = 8;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// 場所の価値（角は高く、角の隣は低い）
const WEIGHT = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, -1, -1, -1, -1, -2, 10,
  5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5,
  10, -2, -1, -1, -1, -1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

export function newState(first) {
  const board = Array(64).fill(-1);
  board[3 * N + 3] = 1;
  board[4 * N + 4] = 1;
  board[3 * N + 4] = 0;
  board[4 * N + 3] = 0;
  return { board, turn: first, winner: -1, passed: -1, last: null, flips: [] };
}

// (x, y) に seat が置いたとき裏返る石の位置（空なら置けない）
function flipsAt(board, x, y, seat) {
  if (board[y * N + x] !== -1) return [];
  const out = [];
  for (const [dx, dy] of DIRS) {
    let cx = x + dx;
    let cy = y + dy;
    const line = [];
    while (cx >= 0 && cx < N && cy >= 0 && cy < N && board[cy * N + cx] === 1 - seat) {
      line.push(cy * N + cx);
      cx += dx;
      cy += dy;
    }
    if (line.length && cx >= 0 && cx < N && cy >= 0 && cy < N && board[cy * N + cx] === seat) out.push(...line);
  }
  return out;
}

function hasMove(board, seat) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (board[y * N + x] === -1 && flipsAt(board, x, y, seat).length) return true;
    }
  }
  return false;
}

export function legalMoves(s, seat = s.turn) {
  const m = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const f = flipsAt(s.board, x, y, seat);
      if (f.length) m.push({ x, y, flips: f.length });
    }
  }
  return m;
}

export function count(board) {
  const c = [0, 0];
  for (const v of board) if (v >= 0) c[v]++;
  return c;
}

export function score(s, seat) {
  return count(s.board)[seat];
}

export function turn(s) {
  return s.turn;
}

export function winner(s) {
  return s.winner;
}

// seat が (x, y) に置く。違反なら null。
export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn) return null;
  if (!a || !Number.isInteger(a.x) || !Number.isInteger(a.y) || a.x < 0 || a.x >= N || a.y < 0 || a.y >= N) return null;
  const f = flipsAt(s.board, a.x, a.y, seat);
  if (!f.length) return null;
  const board = s.board.slice();
  board[a.y * N + a.x] = seat;
  for (const i of f) board[i] = seat;
  let next = 1 - seat;
  let passed = -1;
  let win = -1;
  if (!hasMove(board, next)) {
    if (hasMove(board, seat)) {
      passed = next;
      next = seat;
    } else {
      const c = count(board);
      win = c[0] === c[1] ? 2 : c[0] > c[1] ? 0 : 1;
    }
  }
  return { board, turn: next, winner: win, passed, last: { x: a.x, y: a.y }, flips: f };
}

// ---- CPU ----
function place(board, idx, seat, flips) {
  const b = board.slice();
  b[idx] = seat;
  for (const i of flips) b[i] = seat;
  return b;
}

function movesOf(board, seat) {
  const out = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const f = flipsAt(board, x, y, seat);
      if (f.length) out.push({ idx: y * N + x, flips: f });
    }
  }
  return out;
}

function evaluate(board, seat) {
  let pos = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === seat) pos += WEIGHT[i];
    else if (board[i] === 1 - seat) pos -= WEIGHT[i];
  }
  const mob = movesOf(board, seat).length - movesOf(board, 1 - seat).length;
  return pos + mob * 6;
}

function discDiff(board, seat) {
  const c = count(board);
  return c[seat] - c[1 - seat];
}

// negamax + αβ。seat が打つ番の評価値（seat から見て大きいほど良い）
function search(board, seat, depth, alpha, beta, empties) {
  const moves = movesOf(board, seat);
  if (!moves.length) {
    if (!hasMove(board, 1 - seat)) return discDiff(board, seat) * 1000;
    return -search(board, 1 - seat, depth, -beta, -alpha, empties);
  }
  if (depth <= 0) return evaluate(board, seat);
  moves.sort((a, b) => WEIGHT[b.idx] - WEIGHT[a.idx]);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(place(board, m.idx, seat, m.flips), 1 - seat, depth - 1, -beta, -alpha, empties - 1);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function ai(s, seat, level) {
  const moves = movesOf(s.board, seat);
  if (!moves.length) return null;
  const toAction = (m) => ({ x: m.idx % N, y: Math.floor(m.idx / N) });
  if (level === 'easy') {
    let best = null;
    let bv = -Infinity;
    for (const m of moves) {
      const v = m.flips.length + WEIGHT[m.idx] / 25 + Math.random() * 5;
      if (v > bv) {
        bv = v;
        best = m;
      }
    }
    return toAction(best);
  }
  let empties = 0;
  for (const v of s.board) if (v === -1) empties++;
  // 終盤は最後まで読み切る。それ以外は難易度に応じた深さ。
  const depth = level === 'hard' ? (empties <= 9 ? empties : 5) : 3;
  moves.sort((a, b) => WEIGHT[b.idx] - WEIGHT[a.idx]);
  let best = moves[0];
  let bv = -Infinity;
  for (const m of moves) {
    const v = -search(place(s.board, m.idx, seat, m.flips), 1 - seat, depth - 1, -Infinity, Infinity, empties - 1) + Math.random() * 0.5;
    if (v > bv) {
      bv = v;
      best = m;
    }
  }
  return toAction(best);
}
