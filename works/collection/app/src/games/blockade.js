// ぶろっけーぽん: コマ 2 つを進めて、相手の出発マス 2 つに両方とも着いたら勝ち。壁で進路をふさげる。
// CPU 戦・1 台で 2 人・オンライン 2 人対戦。ルールと CPU は blockade-rules.js、共通の画面は duel-shell.js。
// 操作: 「いどう」でコマをタップ → 行き先（最大 2 マス）をタップ。「かべ」で交点をタップし、「回転」で向きを変えて「置く」。
import { T, alpha, ntext, panel, nbutton, drawPawn, rr } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './blockade-rules.js';

const N = R.N;
const CELL = 20;
const GAP = 4;
const PITCH = CELL + GAP;
const X0 = 14;
const Y0 = 62;
const BTN_MOVE = { x: 4, y: 288, w: 42, h: 26 };
const BTN_WALL = { x: 50, y: 288, w: 54, h: 26 };
const BTN_ROT = { x: 108, y: 288, w: 34, h: 26 };
const BTN_PUT = { x: 146, y: 288, w: 28, h: 26 };
const MOVE_T = 0.2;

function makeSpec(env) {
  const { sound } = env;
  let fx = { move: null, wall: null };

  // 2 人で 1 台のときは座席 0 が下。オンラインの座席 1 は、盤を 180 度回して自分が下に見えるようにする
  const flip = (c) => !c.local2 && c.seat === 1;
  const vx = (c, x) => (flip(c) ? N - 1 - x : x);
  const vy = (c, y) => (flip(c) ? N - 1 - y : y);
  const vwx = (c, x) => (flip(c) ? N - 2 - x : x);
  const cellXY = (c, x, y) => ({ x: X0 + vx(c, x) * PITCH + CELL / 2, y: Y0 + vy(c, y) * PITCH + CELL / 2 });
  const wallRect = (c, w) => {
    const a = X0 + vwx(c, w.x) * PITCH;
    const b = Y0 + vwx(c, w.y) * PITCH;
    return w.o === 'h'
      ? { x: a, y: b + PITCH - GAP, w: PITCH * 2 - GAP, h: GAP }
      : { x: a + PITCH - GAP, y: b, w: GAP, h: PITCH * 2 - GAP };
  };
  const cellAt = (c, px, py) => {
    const col = Math.floor((px - X0 + GAP / 2) / PITCH);
    const row = Math.floor((py - Y0 + GAP / 2) / PITCH);
    if (col < 0 || row < 0 || col >= N || row >= N) return null;
    return { x: flip(c) ? N - 1 - col : col, y: flip(c) ? N - 1 - row : row };
  };
  const crossAt = (c, px, py) => {
    const ix = Math.max(0, Math.min(N - 2, Math.round((px - X0 + GAP / 2) / PITCH) - 1));
    const iy = Math.max(0, Math.min(N - 2, Math.round((py - Y0 + GAP / 2) / PITCH) - 1));
    return { x: flip(c) ? N - 2 - ix : ix, y: flip(c) ? N - 2 - iy : iy };
  };

  return {
    id: 'blockade',
    en: 'BLOCKADE',
    jp: 'ぶろっけーぽん',
    rules: ['コマ 2 つを、相手の出発マス 2 つへ', '1 手 = コマを最大 2 マス進める か 壁を置く'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ tool: 'move', sel: null, wall: null, o: 'h' }),
    reset() {
      fx = { move: null, wall: null };
    },
    onPress(c, x, y) {
      const { ui, s } = c;
      const legal = R.legalMoves(s, c.acting);
      if (legal.length === 1 && legal[0].k === 'pass') return { k: 'pass' }; // 動かせないときは、タップでパス
      if (y >= BTN_MOVE.y) {
        const hit = (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
        if (hit(BTN_MOVE)) {
          ui.tool = 'move';
        } else if (hit(BTN_WALL) && s.left[c.acting] > 0) {
          ui.tool = 'wall';
          ui.sel = null;
        } else if (hit(BTN_ROT) && ui.tool === 'wall') {
          ui.o = ui.o === 'h' ? 'v' : 'h';
          if (ui.wall) ui.wall.o = ui.o;
        } else if (hit(BTN_PUT) && ui.tool === 'wall' && ui.wall) {
          const a = { k: 'wall', x: ui.wall.x, y: ui.wall.y, o: ui.wall.o };
          return R.canPlaceWall(s, c.acting, a) ? a : null;
        }
        return null;
      }
      if (y < Y0 - 8 || y > Y0 + N * PITCH + 4) return null;
      if (ui.tool === 'wall') {
        ui.wall = { ...crossAt(c, x, y), o: ui.o };
        return null;
      }
      const cell = cellAt(c, x, y);
      if (!cell) return null;
      const team = s.pawns[c.acting];
      const own = team.findIndex((p) => p.x === cell.x && p.y === cell.y);
      if (own >= 0) {
        ui.sel = ui.sel === own ? null : own;
        return null;
      }
      if (ui.sel === null) return null;
      const a = { k: 'move', p: ui.sel, x: cell.x, y: cell.y };
      return R.apply(s, c.acting, a) ? a : null;
    },
    onApplied(c, prev, next) {
      const l = next.last;
      if (l.k === 'move') fx.move = { who: l.who, p: l.p, from: l.from, to: { x: l.x, y: l.y }, t: 0 };
      else fx.wall = { index: next.walls.length - 1, who: l.who, t: 0 };
      sound.beep(l.k === 'move' ? 420 : 300, 0.05, l.k === 'move' ? 'sine' : 'square', 0.06);
    },
    tick(c, dt) {
      if (fx.move) {
        fx.move.t += dt;
        if (fx.move.t > MOVE_T) fx.move = null;
      }
      if (fx.wall) {
        fx.wall.t += dt;
        if (fx.wall.t > 0.6) fx.wall = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock, ui } = c;
      const span = N * PITCH - GAP;
      const mine = c.canAct;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
      const col = SEAT_COLOR[c.acting];
      panel(g, { x: X0 - 6, y: Y0 - 6, w: span + 12, h: span + 12 }, {
        fill: 'rgba(6, 10, 32, 0.9)', stroke: alpha(mine ? col : T.dim, mine ? 0.5 + 0.4 * pulse : 0.4), glow: mine ? col : T.dim, blur: mine ? 6 : 2, radius: 8, lw: 1.4,
      });
      // マス（両者のゴール＝出発マスに色）
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const p = cellXY(c, x, y);
          let tint = 'rgba(90, 120, 255, 0.08)';
          for (const who of [0, 1]) if (R.STARTS[who].some((q) => q.x === x && q.y === y)) tint = alpha(SEAT_COLOR[1 - who], 0.2);
          rr(g, p.x - CELL / 2, p.y - CELL / 2, CELL, CELL, 3);
          g.fillStyle = tint;
          g.fill();
          g.lineWidth = 0.8;
          g.strokeStyle = 'rgba(110, 140, 255, 0.25)';
          g.stroke();
        }
      }
      // 動ける先
      if (mine && ui.tool === 'move' && ui.sel !== null) {
        for (const m of R.reachable(s, c.acting, ui.sel)) {
          const p = cellXY(c, m.x, m.y);
          g.save();
          g.shadowColor = col;
          g.shadowBlur = 8;
          g.strokeStyle = alpha(col, 0.45 + 0.45 * pulse);
          g.lineWidth = 1.3;
          g.beginPath();
          g.arc(p.x, p.y, 4 + pulse * 1.3, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
      }
      // 壁
      s.walls.forEach((w, i) => {
        const r = wallRect(c, w);
        const fw = fx.wall && fx.wall.index === i ? fx.wall : null;
        const k = fw ? Math.min(1, fw.t / 0.2) : 1;
        // 壁の色は置いた側ではなく中立（誰が置いたかは問わない）
        g.save();
        g.globalAlpha = 0.35 + 0.65 * k;
        g.shadowColor = T.gold;
        g.shadowBlur = 8;
        rr(g, r.x, r.y - (1 - k) * 10, r.w, r.h, 1.5);
        g.fillStyle = T.gold;
        g.fill();
        g.restore();
      });
      // 置く場所の候補
      if (mine && ui.tool === 'wall' && ui.wall) {
        const ok = R.canPlaceWall(s, c.acting, ui.wall);
        const r = wallRect(c, ui.wall);
        g.save();
        g.globalAlpha = 0.55 + 0.35 * pulse;
        g.shadowColor = ok ? col : T.bad;
        g.shadowBlur = 10;
        rr(g, r.x, r.y, r.w, r.h, 1.5);
        g.fillStyle = ok ? col : T.bad;
        g.fill();
        g.restore();
      }
      // コマ
      for (const who of [0, 1]) {
        s.pawns[who].forEach((pw, i) => {
          let pos = pw;
          if (fx.move && fx.move.who === who && fx.move.p === i) {
            const k = Math.min(1, fx.move.t / MOVE_T);
            pos = { x: fx.move.from.x + (fx.move.to.x - fx.move.from.x) * k, y: fx.move.from.y + (fx.move.to.y - fx.move.from.y) * k };
          }
          const a = { x: X0 + vx(c, pos.x) * PITCH + CELL / 2, y: Y0 + vy(c, pos.y) * PITCH + CELL / 2 };
          drawPawn(g, a.x, a.y, SEAT_COLOR[who], clock, s.winner === -1 && who === c.acting && ui.sel === i);
        });
      }
      if (c.canAct && R.legalMoves(s, c.acting)[0].k === 'pass') ntext(g, '動かせません。タップでパス', 8, 276, 10, T.gold);
      // 操作ボタン
      const on = c.canAct;
      nbutton(g, BTN_MOVE, 'いどう', { on, color: T.me, size: 9, active: on && ui.tool === 'move' });
      nbutton(g, BTN_WALL, `かべ ${s.left[c.acting]}`, { on: on && s.left[c.acting] > 0, color: T.gold, size: 9, active: on && ui.tool === 'wall' });
      nbutton(g, BTN_ROT, ui.o === 'h' ? '━' : '┃', { on: on && ui.tool === 'wall', color: T.gold, size: 11 });
      nbutton(g, BTN_PUT, '置く', { on: on && ui.tool === 'wall' && !!ui.wall && R.canPlaceWall(s, c.acting, ui.wall), color: T.gold, size: 9 });
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
