// ドット囲みのルールと CPU。5×5 の点（箱 4×4）。線を 1 本ずつ引き、箱の 4 辺目を引いた人がその箱をもらい、もう 1 本引ける。
// 辺の番号: 横線 h(i, j) = i * 4 + j（i = 点の行 0〜4、j = 0〜3）／縦線 v(i, j) = 20 + i * 5 + j（i = 箱の行 0〜3、j = 点の列 0〜4）
// 状態: { e: 40 本（-1 未 / 引いた座席）, box: 16 個（-1 未 / もらった座席）, score: [a, b], turn, winner(-1 / 0 / 1 / 2), last(辺番号), taken(直前に取った箱) }
// 手: { t: 'h' | 'v', i, j }
export const D = 5; // 点の数
export const B = 4; // 箱の数（1 辺）
export const EDGES = 40;

export const edgeIndex = (t, i, j) => (t === 'h' ? i * B + j : 20 + i * D + j);

export function edgeOf(idx) {
  if (idx < 20) return { t: 'h', i: Math.floor(idx / B), j: idx % B };
  const k = idx - 20;
  return { t: 'v', i: Math.floor(k / D), j: k % D };
}

// 箱 (r, c) の 4 辺
export function boxEdges(r, c) {
  return [edgeIndex('h', r, c), edgeIndex('h', r + 1, c), edgeIndex('v', r, c), edgeIndex('v', r, c + 1)];
}

// 辺 idx に隣り合う箱（0〜2 個）
const ADJ = Array.from({ length: EDGES }, () => []);
for (let r = 0; r < B; r++) {
  for (let c = 0; c < B; c++) for (const e of boxEdges(r, c)) ADJ[e].push(r * B + c);
}
const BOX_EDGES = Array.from({ length: B * B }, (_, k) => boxEdges(Math.floor(k / B), k % B));

export function newState(first) {
  return { e: Array(EDGES).fill(-1), box: Array(B * B).fill(-1), score: [0, 0], turn: first, winner: -1, last: null, taken: [] };
}

export function legalMoves(s) {
  const m = [];
  for (let k = 0; k < EDGES; k++) if (s.e[k] === -1) m.push(edgeOf(k));
  return m;
}

export function score(s, seat) {
  return s.score[seat];
}

export function turn(s) {
  return s.turn;
}

export function winner(s) {
  return s.winner;
}

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn) return null;
  if (!a || (a.t !== 'h' && a.t !== 'v') || !Number.isInteger(a.i) || !Number.isInteger(a.j)) return null;
  const ok = a.t === 'h' ? a.i >= 0 && a.i < D && a.j >= 0 && a.j < B : a.i >= 0 && a.i < B && a.j >= 0 && a.j < D;
  if (!ok) return null;
  const idx = edgeIndex(a.t, a.i, a.j);
  if (s.e[idx] !== -1) return null;
  const e = s.e.slice();
  e[idx] = seat;
  const box = s.box.slice();
  const sc = s.score.slice();
  const taken = [];
  for (const b of ADJ[idx]) {
    if (box[b] === -1 && BOX_EDGES[b].every((k) => e[k] !== -1)) {
      box[b] = seat;
      sc[seat]++;
      taken.push(b);
    }
  }
  const done = sc[0] + sc[1] === B * B;
  const win = done ? (sc[0] === sc[1] ? 2 : sc[0] > sc[1] ? 0 : 1) : -1;
  return { e, box, score: sc, turn: taken.length ? seat : 1 - seat, winner: win, last: idx, taken };
}

// ---- CPU ----
const sides = (e, b) => BOX_EDGES[b].reduce((n, k) => n + (e[k] !== -1 ? 1 : 0), 0);

// 3 辺そろっている箱を取れる辺（なければ -1）
function takeableEdge(e, box) {
  for (let b = 0; b < B * B; b++) {
    if (box[b] !== -1 || sides(e, b) !== 3) continue;
    for (const k of BOX_EDGES[b]) if (e[k] === -1) return k;
  }
  return -1;
}

// 辺 idx を引くと 3 辺目の箱ができる（相手に取られる）か
function makesThird(e, box, idx) {
  for (const b of ADJ[idx]) if (box[b] === -1 && sides(e, b) === 2) return true;
  return false;
}

// 相手が欲張りに取り続けたときに取れる箱の数
function greedyCapture(e, box) {
  const ee = e.slice();
  const bb = box.slice();
  let n = 0;
  for (;;) {
    const k = takeableEdge(ee, bb);
    if (k < 0) return n;
    ee[k] = 9;
    for (const b of ADJ[k]) {
      if (bb[b] === -1 && BOX_EDGES[b].every((x) => ee[x] !== -1)) {
        bb[b] = 9;
        n++;
      }
    }
  }
}

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const toAction = (k) => {
  const { t, i, j } = edgeOf(k);
  return { t, i, j };
};

// 残りの辺が少ないとき、最後まで読み切る（メモ化つき negamax）。値 = 手番側の（取った箱 − 取られた箱）
function solve(e, box, memo) {
  let key = 0;
  for (let k = 0; k < EDGES; k++) if (e[k] !== -1) key += 2 ** k;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = -Infinity;
  let any = false;
  for (let k = 0; k < EDGES; k++) {
    if (e[k] !== -1) continue;
    any = true;
    e[k] = 0;
    let gain = 0;
    const got = [];
    for (const b of ADJ[k]) {
      if (box[b] === -1 && BOX_EDGES[b].every((x) => e[x] !== -1)) {
        box[b] = 0;
        got.push(b);
        gain++;
      }
    }
    const v = gain > 0 ? gain + solve(e, box, memo) : -solve(e, box, memo);
    for (const b of got) box[b] = -1;
    e[k] = -1;
    if (v > best) best = v;
  }
  const r = any ? best : 0;
  memo.set(key, r);
  return r;
}

function solveBest(s) {
  const e = s.e.slice();
  const box = s.box.slice();
  const memo = new Map();
  let best = [];
  let bv = -Infinity;
  for (let k = 0; k < EDGES; k++) {
    if (e[k] !== -1) continue;
    e[k] = 0;
    let gain = 0;
    const got = [];
    for (const b of ADJ[k]) {
      if (box[b] === -1 && BOX_EDGES[b].every((x) => e[x] !== -1)) {
        box[b] = 0;
        got.push(b);
        gain++;
      }
    }
    const v = gain > 0 ? gain + solve(e, box, memo) : -solve(e, box, memo);
    for (const b of got) box[b] = -1;
    e[k] = -1;
    if (v > bv) {
      bv = v;
      best = [k];
    } else if (v === bv) best.push(k);
  }
  return pickRandom(best);
}

export function ai(s, seat, level) {
  const free = [];
  for (let k = 0; k < EDGES; k++) if (s.e[k] === -1) free.push(k);
  if (!free.length) return null;
  const take = takeableEdge(s.e, s.box);
  const safe = free.filter((k) => !makesThird(s.e, s.box, k));
  if (level === 'easy') {
    if (take >= 0 && Math.random() < 0.6) return toAction(take);
    return toAction(pickRandom(safe.length && Math.random() < 0.6 ? safe : free));
  }
  if (level === 'hard' && free.length <= 16) return toAction(solveBest(s));
  if (take >= 0) return toAction(take);
  if (safe.length) return toAction(pickRandom(safe));
  // 安全な線がない: 相手に取られる箱が最も少ない線を引く
  let best = [];
  let bv = Infinity;
  for (const k of free) {
    const e = s.e.slice();
    e[k] = seat;
    const v = greedyCapture(e, s.box);
    if (v < bv) {
      bv = v;
      best = [k];
    } else if (v === bv) best.push(k);
  }
  return toAction(pickRandom(best));
}
