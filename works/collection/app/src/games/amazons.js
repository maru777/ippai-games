// あまぽん: 6×6 の盤でクイーンを動かし、動かした先から矢を撃ってマスをふさぐ。相手を動けなくしたら勝ち。
// CPU 戦・1 台で 2 人・オンライン 2 人対戦。ルールと CPU は amazons-rules.js、共通の画面は duel-shell.js。
import { T, alpha, ntext, panel, drawPawn } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './amazons-rules.js';

const CELL = 36;
const X0 = 12;
const Y0 = 64;
const cx = (x) => X0 + (x + 0.5) * CELL;
const cy = (y) => Y0 + (y + 0.5) * CELL;
const idx = (x, y) => y * R.N + x;
const MOVE_T = 0.25;
const ARROW_T = 0.3;

// 矢のマークを描く（燃えるバツ印）
function arrowMark(g, x, y, k = 1, glow = 6) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.PI / 4);
  g.scale(k, k);
  g.shadowColor = T.gold;
  g.shadowBlur = glow;
  g.strokeStyle = alpha(T.gold, 0.9);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-8, 0);
  g.lineTo(8, 0);
  g.moveTo(0, -8);
  g.lineTo(0, 8);
  g.stroke();
  g.restore();
}

function makeSpec(env) {
  const { sound } = env;
  let fx = { move: null, arrow: null };
  let preview = null; // 行き先を選んで仮置きしたクイーンの位置

  const after = (s, a) => {
    // 動かしたあとの盤（動かす前のマスは空き）
    const cells = s.cells.slice();
    cells[idx(a.fx, a.fy)] = -1;
    cells[idx(a.tx, a.ty)] = s.turn;
    return cells;
  };

  const spec = {
    id: 'amazons',
    en: 'AMAZONS',
    jp: 'あまぽん',
    rules: ['クイーンを動かして、矢を撃ってマスをふさぐ', '相手が動けなくなったら勝ち'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ from: null, to: null }),
    reset() {
      fx = { move: null, arrow: null };
      preview = null;
    },
    onPress(c, x, y) {
      const gx = Math.floor((x - X0) / CELL);
      const gy = Math.floor((y - Y0) / CELL);
      if (gx < 0 || gy < 0 || gx >= R.N || gy >= R.N) return null;
      const { s, ui } = c;
      const mine = s.cells[idx(gx, gy)] === c.acting;
      if (mine && R.reach(s.cells, gx, gy).length) {
        // 別のクイーンを選び直す（行き先を決めたあとでも）
        const isTo = ui.to && ui.to.x === gx && ui.to.y === gy;
        const isFrom = ui.to && ui.from && ui.from.x === gx && ui.from.y === gy; // 動かす前のマスは矢の的にできる
        if (!isTo && !isFrom) {
          ui.from = { x: gx, y: gy };
          ui.to = null;
          return null;
        }
      }
      if (!ui.from) return null;
      if (!ui.to) {
        if (R.reach(s.cells, ui.from.x, ui.from.y).some((m) => m.x === gx && m.y === gy)) ui.to = { x: gx, y: gy };
        else if (gx === ui.from.x && gy === ui.from.y) ui.from = null;
        return null;
      }
      if (gx === ui.to.x && gy === ui.to.y) {
        ui.to = null; // 行き先を選び直す
        return null;
      }
      const a = { fx: ui.from.x, fy: ui.from.y, tx: ui.to.x, ty: ui.to.y, ax: gx, ay: gy };
      return R.apply(s, c.acting, a) ? a : null;
    },
    onApplied(c, prev, next) {
      const l = next.last;
      const shown = preview && preview.x === l.tx && preview.y === l.ty; // 仮置きで見せたなら、動きは付けない
      preview = null;
      fx.move = shown ? null : { from: { x: l.fx, y: l.fy }, to: { x: l.tx, y: l.ty }, who: l.who, t: 0 };
      fx.arrow = { from: { x: l.tx, y: l.ty }, to: { x: l.ax, y: l.ay }, t: shown ? 0 : -MOVE_T };
      sound.beep(380, 0.06, 'triangle', 0.06);
    },
    tick(c, dt) {
      if (fx.move) {
        fx.move.t += dt;
        if (fx.move.t > MOVE_T) fx.move = null;
      }
      if (fx.arrow) {
        fx.arrow.t += dt;
        if (fx.arrow.t > ARROW_T) {
          sound.beep(220, 0.08, 'sawtooth', 0.06);
          fx.arrow = null;
        }
      }
    },
    drawBoard(g, c) {
      const { s, clock, ui } = c;
      const span = CELL * R.N;
      panel(g, { x: X0 - 5, y: Y0 - 5, w: span + 10, h: span + 10 }, {
        fill: 'rgba(6, 10, 32, 0.92)', stroke: alpha(T.gold, 0.5), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          g.fillStyle = (x + y) % 2 ? 'rgba(90, 110, 220, 0.16)' : 'rgba(70, 90, 190, 0.07)';
          g.fillRect(X0 + x * CELL, Y0 + y * CELL, CELL, CELL);
        }
      }
      const col = SEAT_COLOR[c.acting];
      const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      // 操作の候補
      if (c.canAct) {
        if (!ui.from) {
          for (const q of R.queensOf(s.cells, c.acting)) {
            if (!R.reach(s.cells, q.x, q.y).length) continue;
            g.strokeStyle = alpha(col, 0.35 + 0.4 * pulse);
            g.lineWidth = 1.4;
            g.strokeRect(X0 + q.x * CELL + 2.5, Y0 + q.y * CELL + 2.5, CELL - 5, CELL - 5);
          }
        } else if (!ui.to) {
          for (const m of R.reach(s.cells, ui.from.x, ui.from.y)) {
            g.fillStyle = alpha(col, 0.25 + 0.2 * pulse);
            g.beginPath();
            g.arc(cx(m.x), cy(m.y), 4.5, 0, Math.PI * 2);
            g.fill();
          }
        } else {
          const cells = after(s, { fx: ui.from.x, fy: ui.from.y, tx: ui.to.x, ty: ui.to.y });
          for (const m of R.reach(cells, ui.to.x, ui.to.y)) {
            g.fillStyle = alpha(T.gold, 0.18 + 0.18 * pulse);
            g.fillRect(X0 + m.x * CELL + 3, Y0 + m.y * CELL + 3, CELL - 6, CELL - 6);
          }
        }
      }
      // 矢
      for (let i = 0; i < R.N * R.N; i++) {
        if (s.cells[i] !== 2) continue;
        const x = i % R.N;
        const y = Math.floor(i / R.N);
        if (fx.arrow && fx.arrow.to.x === x && fx.arrow.to.y === y) continue;
        arrowMark(g, cx(x), cy(y), 1, 4);
      }
      // クイーン
      for (let i = 0; i < R.N * R.N; i++) {
        const v = s.cells[i];
        if (v !== 0 && v !== 1) continue;
        let x = i % R.N;
        let y = Math.floor(i / R.N);
        if (fx.move && fx.move.to.x === x && fx.move.to.y === y) {
          const k = Math.min(1, fx.move.t / MOVE_T);
          x = fx.move.from.x + (fx.move.to.x - fx.move.from.x) * k;
          y = fx.move.from.y + (fx.move.to.y - fx.move.from.y) * k;
        } else if (ui.from && ui.from.x === x && ui.from.y === y && ui.to) {
          x = ui.to.x; // 選んだ行き先に仮置き
          y = ui.to.y;
        }
        const sel = ui.from && ui.from.x === i % R.N && ui.from.y === Math.floor(i / R.N);
        drawPawn(g, cx(x), cy(y), SEAT_COLOR[v], clock, s.winner === -1 && (sel || (s.turn === v && !ui.from)));
      }
      // 飛んでいる矢
      if (fx.arrow && fx.arrow.t > 0) {
        const k = fx.arrow.t / ARROW_T;
        const ax = cx(fx.arrow.from.x) + (cx(fx.arrow.to.x) - cx(fx.arrow.from.x)) * k;
        const ay = cy(fx.arrow.from.y) + (cy(fx.arrow.to.y) - cy(fx.arrow.from.y)) * k;
        arrowMark(g, ax, ay, 0.7 + 0.3 * k, 10);
      } else if (fx.arrow) {
        arrowMark(g, cx(fx.arrow.from.x), cy(fx.arrow.from.y), 0.5, 4);
      }
      if (c.canAct) {
        const msg = !ui.from ? '動かすクイーンをタップ' : !ui.to ? '行き先をタップ' : '矢を撃つマスをタップ（行き先をタップで戻る）';
        ntext(g, msg, 8, 293, 10, T.dim);
      }
    },
  };
  // 行き先を選んで仮置きしたコマは、確定したとき同じ動きをもう一度アニメーションしない（二度動いて見えるため）
  const inner = spec.onPress;
  spec.onPress = (c, x, y) => {
    const a = inner(c, x, y);
    preview = c.ui.to ? { x: c.ui.to.x, y: c.ui.to.y } : null;
    return a;
  };
  return spec;
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
