// あいぽれーしょん: 7×7 の盤でコマを 1 つ動かし、空きマスを 1 つ消す。相手を動けなくしたら勝ち。
// CPU 戦・1 台で 2 人・オンライン 2 人対戦。ルールと CPU は isolation-rules.js、共通の画面は duel-shell.js。
import { T, alpha, ntext, panel, drawPawn } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './isolation-rules.js';

const CELL = 30;
const X0 = 15;
const Y0 = 64;
const cx = (x) => X0 + (x + 0.5) * CELL;
const cy = (y) => Y0 + (y + 0.5) * CELL;
const MOVE_T = 0.22;
const CRUMBLE_T = 0.35;

function makeSpec(env) {
  const { sound } = env;
  let fx = { move: null, crumble: null };
  let preview = null; // 行き先を選んで仮置きしたコマの位置（確定したとき、同じ動きをもう一度アニメーションしないため）

  const pressInner = (c, x, y) => {
    const gx = Math.floor((x - X0) / CELL);
    const gy = Math.floor((y - Y0) / CELL);
    if (gx < 0 || gy < 0 || gx >= R.N || gy >= R.N) return null;
    const me = c.s.pawns[c.acting];
    if (c.ui.to && gx === c.ui.to.x && gy === c.ui.to.y) {
      c.ui.to = null; // 仮置きしたコマをタップで、行き先を選び直す
      return null;
    }
    if (!c.ui.to) {
      if (gx === me.x && gy === me.y) return null;
      const dest = R.steps(c.s, c.acting).find((m) => m.x === gx && m.y === gy);
      if (dest) c.ui.to = dest;
      return null;
    }
    const a = { x: c.ui.to.x, y: c.ui.to.y, rx: gx, ry: gy };
    return R.apply(c.s, c.acting, a) ? a : null;
  };

  return {
    id: 'isolation',
    en: 'ISOLATION',
    jp: 'あいぽれーしょん',
    rules: ['コマを 1 マス動かして、空きマスを 1 つ消す', '相手が動けなくなったら勝ち'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ to: null }),
    reset() {
      fx = { move: null, crumble: null };
      preview = null;
    },
    onPress(c, x, y) {
      const a = pressInner(c, x, y);
      preview = c.ui.to ? { x: c.ui.to.x, y: c.ui.to.y } : null;
      return a;
    },
    onApplied(c, prev, next) {
      const l = next.last;
      // 自分で行き先を選んでコマを仮置きしていたなら、動きのアニメーションは付けない（二度動いて見えるため）
      const shown = preview && preview.x === l.x && preview.y === l.y;
      preview = null;
      fx.move = shown ? null : { from: prev.pawns[l.who], to: next.pawns[l.who], who: l.who, t: 0 };
      fx.crumble = { x: l.rx, y: l.ry, t: 0 };
      sound.beep(430, 0.05, 'triangle', 0.07);
    },
    tick(c, dt) {
      if (fx.move) {
        fx.move.t += dt;
        if (fx.move.t > MOVE_T) fx.move = null;
      }
      if (fx.crumble) {
        fx.crumble.t += dt;
        if (fx.crumble.t > CRUMBLE_T) {
          sound.noise?.(0.08, 0.04, 900);
          fx.crumble = null;
        }
      }
    },
    drawBoard(g, c) {
      const { s, clock } = c;
      const span = CELL * R.N;
      panel(g, { x: X0 - 5, y: Y0 - 5, w: span + 10, h: span + 10 }, {
        fill: 'rgba(6, 10, 32, 0.92)', stroke: alpha(T.gold, 0.5), glow: T.gold, blur: 6, radius: 8, lw: 1.2,
      });
      const picking = c.canAct && !c.ui.to;
      const steps = c.canAct ? R.steps(s, c.acting) : [];
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          const gone = s.gone[y * R.N + x];
          const crumbling = fx.crumble && fx.crumble.x === x && fx.crumble.y === y;
          const px = X0 + x * CELL + 2;
          const py = Y0 + y * CELL + 2;
          if (gone && !crumbling) {
            g.fillStyle = 'rgba(0, 0, 0, 0.35)';
            g.fillRect(px + 8, py + 8, CELL - 20, CELL - 20);
            continue;
          }
          const k = crumbling ? 1 - fx.crumble.t / CRUMBLE_T : 1;
          g.save();
          g.translate(cx(x), cy(y));
          g.scale(k, k);
          g.rotate((1 - k) * 0.6);
          g.fillStyle = 'rgba(70, 90, 190, 0.22)';
          g.strokeStyle = 'rgba(120, 150, 255, 0.4)';
          g.lineWidth = 0.8;
          g.fillRect(-(CELL - 4) / 2, -(CELL - 4) / 2, CELL - 4, CELL - 4);
          g.strokeRect(-(CELL - 4) / 2, -(CELL - 4) / 2, CELL - 4, CELL - 4);
          g.restore();
        }
      }
      // 行き先の候補・消せるマス
      if (picking) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
        for (const m of steps) {
          g.fillStyle = alpha(SEAT_COLOR[c.acting], 0.18 + 0.2 * pulse);
          g.fillRect(X0 + m.x * CELL + 2, Y0 + m.y * CELL + 2, CELL - 4, CELL - 4);
        }
      } else if (c.canAct && c.ui.to) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
        for (const m of steps) {
          g.strokeStyle = alpha(SEAT_COLOR[c.acting], 0.3);
          g.lineWidth = 1;
          g.strokeRect(X0 + m.x * CELL + 3.5, Y0 + m.y * CELL + 3.5, CELL - 7, CELL - 7);
        }
        for (let y = 0; y < R.N; y++) {
          for (let x = 0; x < R.N; x++) {
            if (s.gone[y * R.N + x]) continue;
            if (s.pawns[1 - c.acting].x === x && s.pawns[1 - c.acting].y === y) continue;
            if (c.ui.to.x === x && c.ui.to.y === y) continue;
            g.fillStyle = alpha(T.bad, 0.12 + 0.12 * pulse);
            g.fillRect(X0 + x * CELL + 2, Y0 + y * CELL + 2, CELL - 4, CELL - 4);
          }
        }
      }
      // コマ
      for (const who of [0, 1]) {
        let p = s.pawns[who];
        if (fx.move && fx.move.who === who) {
          const k = Math.min(1, fx.move.t / MOVE_T);
          p = { x: fx.move.from.x + (fx.move.to.x - fx.move.from.x) * k, y: fx.move.from.y + (fx.move.to.y - fx.move.from.y) * k };
        } else if (who === c.acting && c.ui.to) {
          p = c.ui.to; // 選んだ行き先に仮置き
        }
        drawPawn(g, cx(p.x), cy(p.y), SEAT_COLOR[who], clock, s.winner === -1 && s.turn === who);
      }
      if (c.canAct) ntext(g, c.ui.to ? '消すマスをタップ（元の場所も消せる・仮置きのコマで選び直し）' : '動かす先をタップ', 8, 293, 10, T.dim);
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
