// 四目並べ（落とし込み）: 7×6 の盤に交互に石を落とし、縦・横・斜めに 4 つ並べたら勝ち。
// 列をタップで選び（光る）、もう一度タップか「おとす」で落とす。CPU 戦・1 台で 2 人・オンライン 2 人対戦。
import { T, alpha, ntext, panel } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as F from './four-rules.js';

const CELL = 30;
const X0 = 15;
const Y0 = 76;
const R = 12;

function disc(g, cx, cy, color, glow = 8) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = glow;
  const grad = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, alpha(color, 0.55));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const cellX = (c) => X0 + (c + 0.5) * CELL;
const cellY = (r) => Y0 + (r + 0.5) * CELL;

function makeSpec(env) {
  const { sound } = env;
  let fx = { drop: null };

  return {
    id: 'four',
    en: 'DROP 4',
    jp: '四目並べ',
    rules: ['石を落として 4 つ並べる', '縦・横・斜めのどれでも勝ち'],
    newState: F.newState,
    turn: F.turn,
    winner: F.winner,
    apply: F.apply,
    ai: F.ai,
    legalMoves: F.legalMoves,
    score: F.score,
    newUi: () => ({ col: -1 }),
    reset() {
      fx = { drop: null };
    },
    confirm: {
      label: 'おとす',
      enabled: (c) => c.ui.col >= 0 && c.s.cells[c.ui.col] === -1,
      action: (c) => ({ c: c.ui.col }),
    },
    onPress(c, x, y) {
      if (x < X0 || x >= X0 + CELL * F.COLS || y < 36 || y > Y0 + CELL * F.ROWS + 8) return null;
      const col = Math.floor((x - X0) / CELL);
      if (c.s.cells[col] !== -1) return null;
      if (c.ui.col === col) return { c: col };
      c.ui.col = col;
      return null;
    },
    onApplied(c, prev, next, action, who) {
      const r = next.last.r;
      fx.drop = { r, c: action.c, who, t: 0, dur: 0.18 + r * 0.045 };
    },
    tick(c, dt) {
      if (fx.drop) {
        fx.drop.t += dt;
        if (fx.drop.t >= fx.drop.dur) {
          sound.beep(280, 0.07, 'triangle', 0.08);
          fx.drop = null;
        }
      }
    },
    drawBoard(g, c) {
      const { s, clock } = c;
      const w = CELL * F.COLS;
      const h = CELL * F.ROWS;
      const sel = c.ui.col;
      // 選んだ列
      if (c.canAct && sel >= 0) {
        const col = SEAT_COLOR[c.acting];
        g.save();
        g.fillStyle = alpha(col, 0.1 + 0.05 * Math.sin(clock * 6));
        g.fillRect(X0 + sel * CELL, 38, CELL, Y0 + h - 38);
        g.restore();
        g.save();
        g.globalAlpha = 0.55 + 0.25 * Math.sin(clock * 6);
        disc(g, cellX(sel), Y0 - 18, col, 10);
        g.restore();
      }
      panel(g, { x: X0 - 4, y: Y0 - 4, w: w + 8, h: h + 8 }, {
        fill: 'rgba(6, 10, 32, 0.55)', stroke: alpha(T.gold, 0.55), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      // 穴と石
      for (let r = 0; r < F.ROWS; r++) {
        for (let cc = 0; cc < F.COLS; cc++) {
          const i = r * F.COLS + cc;
          const x = cellX(cc);
          const y = cellY(r);
          g.save();
          g.strokeStyle = 'rgba(110, 140, 255, 0.28)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, R + 1.5, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          const v = s.cells[i];
          if (v < 0) continue;
          if (fx.drop && fx.drop.r === r && fx.drop.c === cc) continue; // 落下中は別に描く
          disc(g, x, y, SEAT_COLOR[v], 7);
        }
      }
      // 落下中の石
      if (fx.drop) {
        const u = Math.min(1, fx.drop.t / fx.drop.dur);
        const y = (Y0 - 18) + (cellY(fx.drop.r) - (Y0 - 18)) * u * u;
        disc(g, cellX(fx.drop.c), y, SEAT_COLOR[fx.drop.who], 9);
      }
      // 勝ちの 4 つ
      if (s.line) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 7);
        g.save();
        g.shadowColor = T.white;
        g.shadowBlur = 10;
        g.strokeStyle = alpha(T.white, 0.5 + 0.5 * pulse);
        g.lineWidth = 2;
        for (const i of s.line) {
          g.beginPath();
          g.arc(cellX(i % F.COLS), cellY(Math.floor(i / F.COLS)), R + 3, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
      }
      if (c.canAct) ntext(g, '列をタップ → もう一度で落とす', 8, 266, 10, T.dim);
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
