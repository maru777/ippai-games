// おにぽま（オニタマ）のルールと CPU（描画・通信とは独立）。
// 5×5 の盤に、各自 5 つ（生徒 4 + 師匠 1）。動き方は「カード」で決まる。16 枚から 5 枚が選ばれ、各自 2 枚の手札と、横に 1 枚。
// 1 手 = 手札のカード 1 枚を選び、その動きでコマを 1 つ動かす。使ったカードは横のカードと入れ替わる（使ったカードは相手の手札になる側へ回る）。
// 勝ち: 相手の師匠を取る、または自分の師匠が相手の「神殿」（相手の師匠の初期位置）に着く。
// カードの動きは座席 0（下側・上向き）から見た (dx, dy)。座席 1 は上下左右を反転して使う。
// 状態: { board: 25 マス（-1 空き / 0 生徒0 / 1 師匠0 / 2 生徒1 / 3 師匠1）, hands: [[a,b],[c,d]], side, turn, winner, last }
// 手: { c: カード id, fx, fy, tx, ty }。動かせる手が無いときは { c, pass: true }（カードだけ入れ替える）
export const N = 5;

export const CARDS = [
  { id: 'tiger', name: '虎', moves: [[0, -2], [0, 1]] },
  { id: 'dragon', name: '竜', moves: [[-2, -1], [2, -1], [-1, 1], [1, 1]] },
  { id: 'frog', name: '蛙', moves: [[-2, 0], [-1, -1], [1, 1]] },
  { id: 'rabbit', name: '兎', moves: [[2, 0], [1, -1], [-1, 1]] },
  { id: 'crab', name: '蟹', moves: [[-2, 0], [2, 0], [0, -1]] },
  { id: 'elephant', name: '象', moves: [[-1, 0], [1, 0], [-1, -1], [1, -1]] },
  { id: 'goose', name: '雁', moves: [[-1, -1], [-1, 0], [1, 0], [1, 1]] },
  { id: 'rooster', name: '鶏', moves: [[1, -1], [1, 0], [-1, 0], [-1, 1]] },
  { id: 'monkey', name: '猿', moves: [[-1, -1], [1, -1], [-1, 1], [1, 1]] },
  { id: 'mantis', name: '蟷螂', moves: [[-1, -1], [1, -1], [0, 1]] },
  { id: 'horse', name: '馬', moves: [[0, -1], [-1, 0], [0, 1]] },
  { id: 'ox', name: '牛', moves: [[0, -1], [1, 0], [0, 1]] },
  { id: 'crane', name: '鶴', moves: [[0, -1], [-1, 1], [1, 1]] },
  { id: 'boar', name: '猪', moves: [[0, -1], [-1, 0], [1, 0]] },
  { id: 'eel', name: '鰻', moves: [[-1, -1], [-1, 1], [1, 0]] },
  { id: 'cobra', name: '蛇', moves: [[-1, 0], [1, -1], [1, 1]] },
];
const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const cardOf = (id) => CARD[id];

const idx = (x, y) => y * N + x;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
export const seatOfPiece = (v) => (v < 0 ? -1 : v >> 1);
export const isMaster = (v) => v >= 0 && (v & 1) === 1;
export const temple = (seat) => ({ x: 2, y: seat === 0 ? 0 : N - 1 }); // 座席 seat の師匠が目指す神殿

// seed から決まる乱数（オンラインでは、両者が同じ seed で同じ配札になる）
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newState(first = 0, seed = 1) {
  const r = rng(seed);
  const ids = CARDS.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const board = Array(N * N).fill(-1);
  for (let x = 0; x < N; x++) {
    board[idx(x, N - 1)] = x === 2 ? 1 : 0;
    board[idx(x, 0)] = x === 2 ? 3 : 2;
  }
  return { board, hands: [[ids[0], ids[1]], [ids[2], ids[3]]], side: ids[4], turn: first === 1 ? 1 : 0, winner: -1, last: null };
}

export const turn = (s) => s.turn;
export const winner = (s) => s.winner;
export const score = () => null;

// カード card の、座席 seat から見た動き（座席 1 は反転）
export function offsets(card, seat) {
  return CARD[card].moves.map(([dx, dy]) => (seat === 0 ? [dx, dy] : [-dx, -dy]));
}

export function legalMoves(s, seat = s.turn) {
  const out = [];
  for (const c of s.hands[seat]) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = s.board[idx(x, y)];
        if (v < 0 || seatOfPiece(v) !== seat) continue;
        for (const [dx, dy] of offsets(c, seat)) {
          const tx = x + dx;
          const ty = y + dy;
          if (!inBoard(tx, ty)) continue;
          const t = s.board[idx(tx, ty)];
          if (t >= 0 && seatOfPiece(t) === seat) continue;
          out.push({ c, fx: x, fy: y, tx, ty });
        }
      }
    }
  }
  if (!out.length) for (const c of s.hands[seat]) out.push({ c, pass: true });
  return out;
}

export function apply(s, seat, a) {
  if (s.winner !== -1 || seat !== s.turn || !a) return null;
  if (!s.hands[seat].includes(a.c)) return null;
  const hands = s.hands.map((h) => [...h]);
  const k = hands[seat].indexOf(a.c);
  hands[seat][k] = s.side; // 使ったカードは横へ、横のカードが手札へ
  const next = { board: s.board.slice(), hands, side: a.c, turn: 1 - seat, winner: -1, last: { who: seat, c: a.c, pass: !!a.pass } };
  if (a.pass) {
    if (legalMoves(s, seat).some((m) => !m.pass)) return null; // 動ける手があるのにパスはできない
    return next;
  }
  if (![a.fx, a.fy, a.tx, a.ty].every(Number.isInteger) || !inBoard(a.fx, a.fy) || !inBoard(a.tx, a.ty)) return null;
  const piece = s.board[idx(a.fx, a.fy)];
  if (piece < 0 || seatOfPiece(piece) !== seat) return null;
  if (!offsets(a.c, seat).some(([dx, dy]) => a.fx + dx === a.tx && a.fy + dy === a.ty)) return null;
  const target = s.board[idx(a.tx, a.ty)];
  if (target >= 0 && seatOfPiece(target) === seat) return null;
  next.board[idx(a.fx, a.fy)] = -1;
  next.board[idx(a.tx, a.ty)] = piece;
  next.last = { who: seat, c: a.c, fx: a.fx, fy: a.fy, tx: a.tx, ty: a.ty, captured: target };
  if (target >= 0 && isMaster(target)) next.winner = seat;
  else if (isMaster(piece) && a.tx === temple(seat).x && a.ty === temple(seat).y) next.winner = seat;
  return next;
}

// ---- CPU ----
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function evaluate(s, me) {
  if (s.winner === me) return 10000;
  if (s.winner === 1 - me) return -10000;
  if (s.winner === 2) return 0;
  let v = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = s.board[idx(x, y)];
      if (p < 0) continue;
      const who = seatOfPiece(p);
      const sign = who === me ? 1 : -1;
      if (isMaster(p)) {
        const t = temple(who);
        v += sign * (6 - (Math.abs(x - t.x) + Math.abs(y - t.y)) * 1.5); // 神殿に近い師匠
        v += sign * (2 - Math.abs(x - 2)) * 0.5;
      } else {
        v += sign * (30 + (2 - Math.abs(x - 2)) * 1.5);
      }
    }
  }
  // 動きの選択肢の多さ
  v += (legalMoves(s, me).length - legalMoves(s, 1 - me).length) * 0.4;
  return v;
}

function search(s, depth, alpha, beta, me) {
  if (s.winner !== -1 || depth === 0) return evaluate(s, me);
  const moves = legalMoves(s, s.turn);
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
  // どの強さでも、勝てる手があれば指す
  for (const m of all) if (apply(s, seat, m).winner === seat) return m;
  if (level === 'easy') return pick(all);
  const depth = level === 'hard' ? 4 : 2;
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
