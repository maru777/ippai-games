// ぽっくす（ヘックス）のルールと CPU（描画・通信とは独立）。
// 9×9 のひし形の盤（六角のマス）。座席 0 は上の辺と下の辺を、座席 1 は左の辺と右の辺を、自分の石でつなげたら勝ち（引き分けなし）。
// 先手が最初の 1 手を打ったあと、後手は「入れ替え」（その石を自分の色にする）を選べる（先手の有利を消すための決まり）。
// マス (x, y) の隣: (x±1, y), (x, y±1), (x+1, y-1), (x-1, y+1)。
// 状態: { cells: 81 マス（-1 空き / 0 / 1）, turn, first（先手の座席）, plies, winner(-1 続行 / 0 / 1), last }
// 手: { x, y } | { swap: true }
export const N = 9;

const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const idx = (x, y) => y * N + x;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

export function newState(first = 0) {
  return { cells: Array(N * N).fill(-1), turn: first === 1 ? 1 : 0, first: first === 1 ? 1 : 0, plies: 0, winner: -1, last: null };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

// seat の石が、自分の 2 辺をつないでいるか（つないでいればその石の並び idx[] を返す）
export function connected(cells, seat) {
  const prev = new Array(N * N).fill(-2);
  const q = [];
  for (let k = 0; k < N; k++) {
    const i = seat === 0 ? idx(k, 0) : idx(0, k);
    if (cells[i] === seat) {
      prev[i] = -1;
      q.push(i);
    }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % N;
    const y = Math.floor(i / N);
    if ((seat === 0 && y === N - 1) || (seat === 1 && x === N - 1)) {
      const path = [];
      for (let j = i; j !== -1; j = prev[j]) path.push(j);
      return path;
    }
    for (const [dx, dy] of NEIGH) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBoard(nx, ny)) continue;
      const j = idx(nx, ny);
      if (cells[j] !== seat || prev[j] !== -2) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  return null;
}

export function legalMoves(s) {
  const out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (s.cells[idx(x, y)] === -1) out.push({ x, y });
  if (canSwap(s)) out.push({ swap: true });
  return out;
}

export const canSwap = (s) => s.plies === 1 && s.turn !== s.first;

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn || !a) return null;
  if (a.swap) {
    if (!canSwap(s)) return null;
    const cells = s.cells.map((v) => (v === -1 ? -1 : 1 - v));
    return { ...s, cells, turn: 1 - seat, plies: 2, last: { swap: true, who: seat } };
  }
  if (!Number.isInteger(a.x) || !Number.isInteger(a.y) || !inBoard(a.x, a.y) || s.cells[idx(a.x, a.y)] !== -1) return null;
  const cells = s.cells.slice();
  cells[idx(a.x, a.y)] = seat;
  const next = { ...s, cells, turn: 1 - seat, plies: s.plies + 1, last: { x: a.x, y: a.y, who: seat } };
  if (connected(cells, seat)) next.winner = seat;
  return next;
}

// ---- CPU ----
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 空きマスを順番にランダムで埋めて勝者を決める（ヘックスは全部埋めれば必ずどちらかがつながる）
function playout(cells, toMove, me, empties) {
  const c = cells.slice();
  const order = empties.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let who = toMove;
  for (const i of order) {
    c[i] = who;
    who = 1 - who;
  }
  return connected(c, me) ? 1 : 0;
}

// 石の近く（2 マス以内）の空きマス。石がなければ中央付近
function nearby(s) {
  const out = new Set();
  let any = false;
  for (let i = 0; i < N * N; i++) {
    if (s.cells[i] === -1) continue;
    any = true;
    const x = i % N;
    const y = Math.floor(i / N);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx + dy) > 2) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inBoard(nx, ny) && s.cells[idx(nx, ny)] === -1) out.add(idx(nx, ny));
      }
    }
  }
  if (!any) for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) out.add(idx(x, y));
  return [...out];
}

export function ai(s, seat, level = 'normal') {
  if (canSwap(s)) {
    // 最初の石が中央付近なら入れ替える（強さによる）
    const i = s.cells.findIndex((v) => v !== -1);
    const x = i % N;
    const y = Math.floor(i / N);
    const central = Math.abs(x - 4) + Math.abs(y - 4) <= 3;
    if (level !== 'easy' && central) return { swap: true };
  }
  const empties = [];
  for (let i = 0; i < N * N; i++) if (s.cells[i] === -1) empties.push(i);
  if (!empties.length) return null;
  const cand = level === 'easy' ? [] : nearby(s);
  if (level === 'easy') {
    const near = nearby(s);
    const i = Math.random() < 0.5 ? pick(near) : pick(empties);
    return { x: i % N, y: Math.floor(i / N) };
  }
  const budget = level === 'hard' ? 14000 : 3000;
  const per = Math.max(10, Math.floor(budget / cand.length));
  let best = cand[0];
  let bv = -1;
  for (const i of cand) {
    const cells = s.cells.slice();
    cells[i] = seat;
    if (connected(cells, seat)) return { x: i % N, y: Math.floor(i / N) };
    const rest = empties.filter((e) => e !== i);
    let wins = 0;
    for (let k = 0; k < per; k++) wins += playout(cells, 1 - seat, seat, rest);
    const v = wins / per + Math.random() * 0.001;
    if (v > bv) {
      bv = v;
      best = i;
    }
  }
  return { x: best % N, y: Math.floor(best / N) };
}
