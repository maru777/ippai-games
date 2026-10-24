// 四目並べ（落とし込み）のルールと CPU。7 列 × 6 段。縦・横・斜めに 4 つ並べたら勝ち。
// 状態: { cells: 42 マス（-1 空 / 0 / 1。index = 段 * 7 + 列、段 0 が上）, turn, winner(-1 / 0 / 1 / 2 引き分け), line(勝ちの 4 マス), last }
// 手: { c }（列 0〜6）
export const COLS = 7;
export const ROWS = 6;

export function newState(first) {
  return { cells: Array(COLS * ROWS).fill(-1), turn: first, winner: -1, line: null, last: null };
}

export function dropRow(cells, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (cells[r * COLS + c] === -1) return r;
  return -1;
}

export function legalMoves(s) {
  const m = [];
  for (let c = 0; c < COLS; c++) if (s.cells[c] === -1) m.push({ c });
  return m;
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// (r, c) を含む seat の 4 連があれば、そのマスの配列
function lineAt(cells, r, c, seat) {
  for (const [dc, dr] of DIRS) {
    const line = [r * COLS + c];
    for (const sgn of [1, -1]) {
      let rr = r + dr * sgn;
      let cc = c + dc * sgn;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && cells[rr * COLS + cc] === seat) {
        line.push(rr * COLS + cc);
        rr += dr * sgn;
        cc += dc * sgn;
      }
    }
    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}

export function score() {
  return null;
}

export function turn(s) {
  return s.turn;
}

export function winner(s) {
  return s.winner;
}

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn) return null;
  if (!a || !Number.isInteger(a.c) || a.c < 0 || a.c >= COLS) return null;
  const r = dropRow(s.cells, a.c);
  if (r < 0) return null;
  const cells = s.cells.slice();
  cells[r * COLS + a.c] = seat;
  const line = lineAt(cells, r, a.c, seat);
  let win = -1;
  if (line) win = seat;
  else if (cells.every((v) => v !== -1)) win = 2;
  return { cells, turn: win === -1 ? 1 - seat : seat, winner: win, line, last: { r, c: a.c } };
}

// ---- CPU ----
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // 中央から調べる（枝刈りが効く）

function windowScore(cells, seat) {
  let sc = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dc, dr] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const v = cells[(r + dr * k) * COLS + c + dc * k];
          if (v === seat) mine++;
          else if (v === 1 - seat) theirs++;
        }
        if (mine && theirs) continue;
        if (mine === 3) sc += 5;
        else if (mine === 2) sc += 2;
        else if (theirs === 3) sc -= 6;
        else if (theirs === 2) sc -= 2;
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    const v = cells[r * COLS + 3];
    if (v === seat) sc += 3;
    else if (v === 1 - seat) sc -= 3;
  }
  return sc;
}

// seat が打つ番の評価（seat から見て大きいほど良い）。cells は呼び出し側と共有して戻す（undo）。
function negamax(cells, seat, depth, alpha, beta) {
  let any = false;
  for (const c of ORDER) {
    const r = dropRow(cells, c);
    if (r < 0) continue;
    any = true;
    cells[r * COLS + c] = seat;
    if (lineAt(cells, r, c, seat)) {
      cells[r * COLS + c] = -1;
      return 10000 + depth; // 早い勝ちほど高い
    }
    cells[r * COLS + c] = -1;
  }
  if (!any) return 0;
  if (depth <= 0) return windowScore(cells, seat);
  let best = -Infinity;
  for (const c of ORDER) {
    const r = dropRow(cells, c);
    if (r < 0) continue;
    cells[r * COLS + c] = seat;
    const v = -negamax(cells, 1 - seat, depth - 1, -beta, -alpha);
    cells[r * COLS + c] = -1;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function ai(s, seat, level) {
  const cols = legalMoves(s).map((m) => m.c);
  if (!cols.length) return null;
  const cells = s.cells.slice();
  const pick = (depth, noise) => {
    let best = cols[0];
    let bv = -Infinity;
    for (const c of ORDER) {
      if (!cols.includes(c)) continue;
      const r = dropRow(cells, c);
      cells[r * COLS + c] = seat;
      let v;
      if (lineAt(cells, r, c, seat)) v = 100000;
      else v = -negamax(cells, 1 - seat, depth - 1, -Infinity, Infinity);
      cells[r * COLS + c] = -1;
      v += Math.random() * noise;
      if (v > bv) {
        bv = v;
        best = c;
      }
    }
    return { c: best };
  };
  if (level === 'easy') {
    if (Math.random() < 0.35) return { c: cols[Math.floor(Math.random() * cols.length)] };
    return pick(2, 3);
  }
  return level === 'hard' ? pick(7, 0.5) : pick(4, 1);
}
