// リバーシ: 8×8 の盤で石を挟んで裏返し、最後に多い方が勝ち。CPU 戦・1 台で 2 人・オンライン 2 人対戦。
// ルールと CPU は reversi-rules.js、共通の画面は duel-shell.js。
import { T, alpha, ntext, panel } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR, SEAT_NAME } from './duel-shell.js';
import * as R from './reversi-rules.js';

const CELL = 27;
const X0 = 12;
const Y0 = 66;
const FLIP_TIME = 0.34;

// 光る石。sx で横幅を縮めて、裏返る動きに使う。
function disc(g, cx, cy, r, color, sx = 1, glow = 8) {
  g.save();
  g.translate(cx, cy);
  g.scale(Math.max(0.02, sx), 1);
  g.shadowColor = color;
  g.shadowBlur = glow;
  const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, alpha(color, 0.55));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function makeSpec(env) {
  const { sound } = env;
  let fx = { flips: new Map(), placed: null, pass: null };

  return {
    id: 'reversi',
    en: 'REVERSI',
    jp: 'リバーシ',
    rules: ['石を挟んで裏返す', '最後に多い方の勝ち'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({}),
    reset() {
      fx = { flips: new Map(), placed: null, pass: null };
    },
    onPress(c, x, y) {
      const col = Math.floor((x - X0) / CELL);
      const row = Math.floor((y - Y0) / CELL);
      if (col < 0 || col > 7 || row < 0 || row > 7) return null;
      return R.legalMoves(c.s, c.acting).some((m) => m.x === col && m.y === row) ? { x: col, y: row } : null;
    },
    onApplied(c, prev, next, action) {
      for (const i of next.flips) fx.flips.set(i, { t: 0, from: prev.board[i] });
      fx.placed = { idx: action.y * 8 + action.x, t: 0 };
      fx.pass = next.passed !== -1 ? { who: next.passed, t: 2.4 } : null;
      sound.beep(next.flips.length >= 4 ? 700 : 520, 0.05, 'sine', 0.06);
    },
    tick(c, dt) {
      for (const [i, f] of fx.flips) {
        f.t += dt;
        if (f.t > FLIP_TIME) fx.flips.delete(i);
      }
      if (fx.placed) {
        fx.placed.t += dt;
        if (fx.placed.t > 0.25) fx.placed = null;
      }
      if (fx.pass) {
        fx.pass.t -= dt;
        if (fx.pass.t <= 0) fx.pass = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock } = c;
      const span = CELL * 8;
      panel(g, { x: X0 - 5, y: Y0 - 5, w: span + 10, h: span + 10 }, {
        fill: 'rgba(6, 10, 32, 0.92)', stroke: alpha(T.gold, 0.55), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      g.save();
      g.strokeStyle = 'rgba(110, 140, 255, 0.28)';
      g.lineWidth = 0.8;
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        g.moveTo(X0 + i * CELL, Y0);
        g.lineTo(X0 + i * CELL, Y0 + span);
        g.moveTo(X0, Y0 + i * CELL);
        g.lineTo(X0 + span, Y0 + i * CELL);
      }
      g.stroke();
      g.restore();
      // 置ける場所
      if (c.canAct) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
        const col = SEAT_COLOR[c.acting];
        for (const m of R.legalMoves(s, c.acting)) {
          g.save();
          g.shadowColor = col;
          g.shadowBlur = 6;
          g.strokeStyle = alpha(col, 0.4 + 0.45 * pulse);
          g.lineWidth = 1.3;
          g.beginPath();
          g.arc(X0 + (m.x + 0.5) * CELL, Y0 + (m.y + 0.5) * CELL, 4 + pulse * 1.2, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
      }
      // 石
      for (let i = 0; i < 64; i++) {
        const v = s.board[i];
        if (v < 0) continue;
        const cx = X0 + ((i % 8) + 0.5) * CELL;
        const cy = Y0 + (Math.floor(i / 8) + 0.5) * CELL;
        const f = fx.flips.get(i);
        if (f) {
          const p = Math.min(1, f.t / FLIP_TIME);
          const half = p < 0.5;
          disc(g, cx, cy, 10.5, SEAT_COLOR[half ? f.from : v], half ? 1 - p * 2 : p * 2 - 1, 8);
        } else if (fx.placed && fx.placed.idx === i) {
          const p = fx.placed.t / 0.25;
          disc(g, cx, cy, 10.5 * (0.4 + 0.6 * p), SEAT_COLOR[v], 1, 12);
        } else {
          disc(g, cx, cy, 10.5, SEAT_COLOR[v], 1, 7);
        }
      }
      // 直前の手
      if (s.last) {
        g.save();
        g.strokeStyle = T.white;
        g.lineWidth = 1;
        g.globalAlpha = 0.7;
        g.strokeRect(X0 + s.last.x * CELL + 2.5, Y0 + s.last.y * CELL + 2.5, CELL - 5, CELL - 5);
        g.restore();
      }
      if (fx.pass) {
        ntext(g, `${c.local2 ? SEAT_NAME[fx.pass.who] : fx.pass.who === c.seat ? 'あなた' : 'あいて'}はパス（置ける所がない）`, 8, 293, 10, T.gold, 'left', 4);
      } else if (c.canAct) {
        ntext(g, '光っている所をタップ', 8, 293, 10, T.dim);
      }
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
