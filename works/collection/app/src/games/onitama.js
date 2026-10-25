// おにぽま: カードで決まる動きでコマを動かし、相手の師匠を取るか、神殿に着いたら勝ち。
// CPU 戦・1 台で 2 人・オンライン 2 人対戦。ルールと CPU は onitama-rules.js、共通の画面は duel-shell.js。
// 操作: 手札のカードをタップ → 動かすコマをタップ → 行き先をタップ。
import { T, alpha, ntext, panel, rr } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './onitama-rules.js';

const CELL = 34;
const X0 = 15;
const Y0 = 66; // 盤は 5×34 = 170 で、y=66〜236
const cx = (x) => X0 + (x + 0.5) * CELL;
const cy = (y) => Y0 + (y + 0.5) * CELL;
// カード: 自分の手札は盤の下、相手の手札は盤の上、横のカードは右
const CW = 64;
const CH = 44;
const handRect = (i) => ({ x: 15 + i * (CW + 8), y: 244, w: CW, h: CH });
const oppRect = (i) => ({ x: 15 + i * (CW + 8), y: 28, w: CW - 6, h: 31 });
const SIDE = { x: 186, y: 244, w: 46, h: 40 };
const MOVE_T = 0.22;
const idx = (x, y) => y * R.N + x;

// カードの絵: 5×5 の小さな図で動きを示す（中央が今いるマス）
function cardFace(g, r, card, seat, color, faded = false) {
  const c = R.cardOf(card);
  panel(g, r, { fill: 'rgba(8, 12, 40, 0.92)', stroke: alpha(color, faded ? 0.3 : 0.85), glow: color, blur: faded ? 0 : 5, radius: 5, lw: 1.2 });
  const m = Math.min(r.w, r.h) / 6.5;
  const ox = r.x + r.w - 2.6 * m - 3;
  const oy = r.y + r.h / 2;
  const offs = R.offsets(card, seat);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const on = offs.some(([a, b]) => a === dx && b === dy);
      g.fillStyle = on ? color : dx === 0 && dy === 0 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(120, 140, 255, 0.16)';
      g.fillRect(ox + dx * m - m / 2 + 0.5, oy + dy * m - m / 2 + 0.5, m - 1, m - 1);
    }
  }
  ntext(g, c.name, r.x + 5, r.y + r.h / 2 - 8, 13, faded ? T.dim : T.white, 'left');
}

function makeSpec(env) {
  const { sound } = env;
  let fx = { move: null, flash: null };

  // 2 人で 1 台のときは座席 0 が下。オンラインの座席 1 は 180 度回して、自分が下に見えるようにする
  const flip = (c) => !c.local2 && c.seat === 1;
  const vx = (c, x) => (flip(c) ? R.N - 1 - x : x);
  const vy = (c, y) => (flip(c) ? R.N - 1 - y : y);
  const bottom = (c) => (flip(c) ? 1 : 0); // 下側に見える座席
  const cellAt = (c, px, py) => {
    const col = Math.floor((px - X0) / CELL);
    const row = Math.floor((py - Y0) / CELL);
    if (col < 0 || row < 0 || col >= R.N || row >= R.N) return null;
    return { x: flip(c) ? R.N - 1 - col : col, y: flip(c) ? R.N - 1 - row : row };
  };
  const px = (c, x) => cx(vx(c, x));
  const py = (c, y) => cy(vy(c, y));

  function drawPiece(g, x, y, seat, master, color, active) {
    g.save();
    g.shadowColor = color;
    g.shadowBlur = active ? 12 : 6;
    g.fillStyle = alpha(color, 0.3);
    g.strokeStyle = color;
    g.lineWidth = master ? 2.2 : 1.6;
    g.beginPath();
    if (master) {
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const r = 12;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
    } else g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    if (master) ntext(g, '師', x, y - 6, 11, T.white, 'center');
  }

  return {
    id: 'onitama',
    en: 'ONITAMA',
    jp: 'おにぽま',
    rules: ['カードの動きでコマを動かす', '相手の師匠を取るか、神殿に着いたら勝ち'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ card: null, from: null }),
    reset() {
      fx = { move: null, flash: null };
    },
    onPress(c, x, y) {
      const { s, ui } = c;
      const hand = s.hands[c.acting];
      for (let i = 0; i < 2; i++) {
        const r = handRect(i);
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
          if (ui.card === hand[i]) {
            ui.card = null;
            ui.from = null;
          } else {
            ui.card = hand[i];
            ui.from = null;
          }
          // 動かせる手がまったくないときは、カードを選ぶだけでパス（カードの入れ替え）
          const all = R.legalMoves(s, c.acting);
          if (all.length && all[0].pass) return { c: hand[i], pass: true };
          return null;
        }
      }
      const cell = cellAt(c, x, y);
      if (!cell || !ui.card) return null;
      const v = s.board[idx(cell.x, cell.y)];
      if (v >= 0 && R.seatOfPiece(v) === c.acting) {
        ui.from = cell;
        return null;
      }
      if (!ui.from) return null;
      const a = { c: ui.card, fx: ui.from.x, fy: ui.from.y, tx: cell.x, ty: cell.y };
      return R.apply(s, c.acting, a) ? a : null;
    },
    onApplied(c, prev, next) {
      const l = next.last;
      if (l.pass) return;
      fx.move = { from: { x: l.fx, y: l.fy }, to: { x: l.tx, y: l.ty }, piece: prev.board[idx(l.fx, l.fy)], t: 0 };
      if (l.captured >= 0) fx.flash = { x: l.tx, y: l.ty, t: 0 };
      sound.beep(l.captured >= 0 ? 260 : 400, 0.07, l.captured >= 0 ? 'sawtooth' : 'triangle', 0.07);
    },
    tick(c, dt) {
      if (fx.move) {
        fx.move.t += dt;
        if (fx.move.t > MOVE_T) fx.move = null;
      }
      if (fx.flash) {
        fx.flash.t += dt;
        if (fx.flash.t > 0.5) fx.flash = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock, ui } = c;
      const span = CELL * R.N;
      const me = bottom(c); // 下に見える座席
      const col = SEAT_COLOR[c.acting];
      const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      panel(g, { x: X0 - 5, y: Y0 - 5, w: span + 10, h: span + 10 }, {
        fill: 'rgba(6, 10, 32, 0.92)', stroke: alpha(T.gold, 0.5), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          g.fillStyle = (x + y) % 2 ? 'rgba(90, 110, 220, 0.14)' : 'rgba(70, 90, 190, 0.06)';
          g.fillRect(X0 + x * CELL, Y0 + y * CELL, CELL, CELL);
        }
      }
      // 神殿
      for (const who of [0, 1]) {
        const t = R.temple(who);
        const gx = X0 + vx(c, t.x) * CELL;
        const gy = Y0 + vy(c, t.y) * CELL;
        g.strokeStyle = alpha(SEAT_COLOR[who], 0.7);
        g.lineWidth = 1.4;
        g.strokeRect(gx + 3.5, gy + 3.5, CELL - 7, CELL - 7);
        g.strokeRect(gx + 7.5, gy + 7.5, CELL - 15, CELL - 15);
      }
      // 動かす手の候補
      if (c.canAct && ui.card) {
        const mine = R.offsets(ui.card, c.acting);
        if (!ui.from) {
          for (let y = 0; y < R.N; y++) {
            for (let x = 0; x < R.N; x++) {
              const v = s.board[idx(x, y)];
              if (v < 0 || R.seatOfPiece(v) !== c.acting) continue;
              const ok = mine.some(([dx, dy]) => {
                const tx = x + dx;
                const ty = y + dy;
                if (tx < 0 || ty < 0 || tx >= R.N || ty >= R.N) return false;
                const t = s.board[idx(tx, ty)];
                return t < 0 || R.seatOfPiece(t) !== c.acting;
              });
              if (!ok) continue;
              g.strokeStyle = alpha(col, 0.3 + 0.35 * pulse);
              g.lineWidth = 1.3;
              g.strokeRect(X0 + vx(c, x) * CELL + 2.5, Y0 + vy(c, y) * CELL + 2.5, CELL - 5, CELL - 5);
            }
          }
        } else {
          for (const [dx, dy] of mine) {
            const tx = ui.from.x + dx;
            const ty = ui.from.y + dy;
            if (tx < 0 || ty < 0 || tx >= R.N || ty >= R.N) continue;
            const t = s.board[idx(tx, ty)];
            if (t >= 0 && R.seatOfPiece(t) === c.acting) continue;
            g.fillStyle = alpha(t >= 0 ? T.bad : col, 0.22 + 0.2 * pulse);
            g.fillRect(X0 + vx(c, tx) * CELL + 3, Y0 + vy(c, ty) * CELL + 3, CELL - 6, CELL - 6);
          }
          g.strokeStyle = alpha(T.white, 0.8);
          g.lineWidth = 1.4;
          g.strokeRect(X0 + vx(c, ui.from.x) * CELL + 2.5, Y0 + vy(c, ui.from.y) * CELL + 2.5, CELL - 5, CELL - 5);
        }
      }
      // コマ
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          const v = s.board[idx(x, y)];
          if (v < 0) continue;
          let ax = px(c, x);
          let ay = py(c, y);
          if (fx.move && fx.move.to.x === x && fx.move.to.y === y) {
            const k = Math.min(1, fx.move.t / MOVE_T);
            ax = px(c, fx.move.from.x + (fx.move.to.x - fx.move.from.x) * k);
            ay = py(c, fx.move.from.y + (fx.move.to.y - fx.move.from.y) * k);
          }
          drawPiece(g, ax, ay, R.seatOfPiece(v), R.isMaster(v), SEAT_COLOR[R.seatOfPiece(v)], ui.from && ui.from.x === x && ui.from.y === y);
        }
      }
      if (fx.flash) {
        g.strokeStyle = alpha(T.bad, 1 - fx.flash.t / 0.5);
        g.lineWidth = 2;
        g.beginPath();
        g.arc(px(c, fx.flash.x), py(c, fx.flash.y), 6 + fx.flash.t * 40, 0, Math.PI * 2);
        g.stroke();
      }
      // カード: 相手の手札（上）・自分の手札（下）・横のカード
      const topSeat = 1 - me;
      s.hands[topSeat].forEach((card, i) => cardFace(g, oppRect(i), card, topSeat, SEAT_COLOR[topSeat], true));
      s.hands[me].forEach((card, i) => {
        const r = handRect(i);
        const sel = c.canAct && ui.card === card && me === c.acting;
        cardFace(g, r, card, me, SEAT_COLOR[me], false);
        if (sel) {
          g.strokeStyle = alpha(T.white, 0.6 + 0.4 * pulse);
          g.lineWidth = 2;
          rr(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 5);
          g.stroke();
        }
      });
      // 横のカードは、次に手札へ入る側（直前に使った側の向き）で見せる
      ntext(g, '横', SIDE.x + SIDE.w / 2, SIDE.y - 12, 9, T.dim, 'center');
      cardFace(g, { x: SIDE.x, y: SIDE.y, w: SIDE.w + 4, h: SIDE.h }, s.side, s.turn, T.gold, true);
      if (c.canAct) ntext(g, !ui.card ? 'カードをタップ' : !ui.from ? '動かすコマをタップ' : '行き先をタップ', 8, 293, 10, T.dim);
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
