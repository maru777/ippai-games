// ドット囲み: 点と点を線でつなぎ、四角の 4 辺目を引いた人がその箱をもらってもう 1 本引ける。箱が多い方の勝ち。
// 線の近くをタップで選び（金色）、もう一度タップか「ひく」で確定。CPU 戦・1 台で 2 人・オンライン 2 人対戦。
import { T, alpha, ntext, panel } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as D from './dots-rules.js';

const GAP = 48;
const X0 = 24;
const Y0 = 70;

const px = (j) => X0 + j * GAP;
const py = (i) => Y0 + i * GAP;

// 辺 idx の両端の点（画面座標）
function endpoints(idx) {
  const e = D.edgeOf(idx);
  return e.t === 'h'
    ? [px(e.j), py(e.i), px(e.j + 1), py(e.i)]
    : [px(e.j), py(e.i), px(e.j), py(e.i + 1)];
}

const mid = (idx) => {
  const [x1, y1, x2, y2] = endpoints(idx);
  return [(x1 + x2) / 2, (y1 + y2) / 2];
};

function makeSpec(env) {
  const { sound } = env;
  let fx = { boxes: new Map(), last: null };

  return {
    id: 'dots',
    en: 'DOTS BOX',
    jp: 'ドット囲み',
    rules: ['線を引いて四角を作る', '4 辺目を引くと箱をもらって続けて引ける'],
    newState: D.newState,
    turn: D.turn,
    winner: D.winner,
    apply: D.apply,
    ai: D.ai,
    legalMoves: D.legalMoves,
    score: D.score,
    newUi: () => ({ cand: null }),
    reset() {
      fx = { boxes: new Map(), last: null };
    },
    confirm: {
      label: 'ひく',
      enabled: (c) => c.ui.cand !== null && c.s.e[c.ui.cand] === -1,
      action: (c) => D.edgeOf(c.ui.cand),
    },
    onPress(c, x, y) {
      if (y < 40 || y > Y0 + GAP * 4 + 24) return null;
      let best = -1;
      let bd = 26;
      for (let k = 0; k < D.EDGES; k++) {
        if (c.s.e[k] !== -1) continue;
        const [mx, my] = mid(k);
        const d = Math.hypot(mx - x, my - y);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (best < 0) return null;
      if (c.ui.cand === best) return D.edgeOf(best);
      c.ui.cand = best;
      return null;
    },
    onApplied(c, prev, next, action, who) {
      fx.last = { idx: next.last, who, t: 0 };
      for (const b of next.taken) fx.boxes.set(b, { t: 0 });
      sound.beep(next.taken.length ? 880 : 420, 0.07, 'sine', 0.07);
    },
    tick(c, dt) {
      for (const [b, f] of fx.boxes) {
        f.t += dt;
        if (f.t > 0.5) fx.boxes.delete(b);
      }
      if (fx.last) {
        fx.last.t += dt;
        if (fx.last.t > 0.6) fx.last = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock } = c;
      const span = GAP * 4;
      panel(g, { x: X0 - 14, y: Y0 - 14, w: span + 28, h: span + 28 }, {
        fill: 'rgba(6, 10, 32, 0.8)', stroke: alpha(T.gold, 0.55), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      // 取られた箱
      for (let b = 0; b < D.B * D.B; b++) {
        const who = s.box[b];
        if (who < 0) continue;
        const r = Math.floor(b / D.B);
        const cc = b % D.B;
        const f = fx.boxes.get(b);
        const k = f ? 0.55 + 0.45 * Math.min(1, f.t / 0.25) : 1;
        const cx = px(cc) + GAP / 2;
        const cy = py(r) + GAP / 2;
        const half = (GAP / 2 - 5) * k;
        g.save();
        g.shadowColor = SEAT_COLOR[who];
        g.shadowBlur = f ? 14 : 6;
        g.fillStyle = alpha(SEAT_COLOR[who], f ? 0.4 : 0.22);
        g.fillRect(cx - half, cy - half, half * 2, half * 2);
        g.restore();
      }
      // 線（未 → 薄く / 引いた線 → 引いた人の色）
      const cand = c.canAct ? c.ui.cand : null;
      for (let k = 0; k < D.EDGES; k++) {
        const [x1, y1, x2, y2] = endpoints(k);
        g.save();
        if (s.e[k] === -1) {
          g.strokeStyle = 'rgba(110, 140, 255, 0.22)';
          g.lineWidth = 1;
          g.setLineDash([2, 4]);
        } else {
          g.strokeStyle = SEAT_COLOR[s.e[k]];
          g.lineWidth = 3;
          g.shadowColor = SEAT_COLOR[s.e[k]];
          g.shadowBlur = 8;
          g.lineCap = 'round';
        }
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.restore();
      }
      // 直前の線の光
      if (fx.last) {
        const [x1, y1, x2, y2] = endpoints(fx.last.idx);
        g.save();
        g.strokeStyle = alpha(T.white, 1 - fx.last.t / 0.6);
        g.lineWidth = 2;
        g.shadowColor = T.white;
        g.shadowBlur = 10;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.restore();
      }
      // 選択中の線
      if (cand !== null && s.e[cand] === -1) {
        const [x1, y1, x2, y2] = endpoints(cand);
        g.save();
        g.strokeStyle = alpha(T.gold, 0.6 + 0.4 * Math.sin(clock * 8));
        g.lineWidth = 4;
        g.shadowColor = T.gold;
        g.shadowBlur = 12;
        g.setLineDash([5, 3]);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        g.restore();
      }
      // 点
      for (let i = 0; i < D.D; i++) {
        for (let j = 0; j < D.D; j++) {
          g.save();
          g.fillStyle = T.white;
          g.shadowColor = T.white;
          g.shadowBlur = 6;
          g.beginPath();
          g.arc(px(j), py(i), 3.2, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      if (c.canAct) ntext(g, '線の近くをタップ → もう一度で引く', 8, 278, 9, T.dim);
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
