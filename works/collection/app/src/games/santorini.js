// ぽんとりーに: 作業員を動かして積み木を積み、3 段目に登ったら勝ち。ドームで相手の道をふさげる。
// CPU 戦・1 台で 2 人・オンライン 2 人対戦。ルールと CPU は santorini-rules.js、共通の画面は duel-shell.js。
import { T, alpha, ntext, panel, drawPawn } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './santorini-rules.js';

const CELL = 42;
const X0 = 15;
const Y0 = 66;
const cx = (x) => X0 + (x + 0.5) * CELL;
const cy = (y) => Y0 + (y + 0.5) * CELL;
const idx = (x, y) => y * R.N + x;
const MOVE_T = 0.22;
const NEIGHBORS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const LEVEL_COL = ['#1a2250', '#3a56b8', '#7c8cf0', '#cfd6ff'];

// 積み木: level 段ぶんを、小さくなる四角で重ねて描く
function tower(g, x, y, level, k = 1) {
  for (let l = 1; l <= Math.min(level, 3); l++) {
    const size = (CELL - 8) * (1 - (l - 1) * 0.2) * (l === level ? k : 1);
    g.fillStyle = LEVEL_COL[l];
    g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    g.lineWidth = 0.8;
    g.fillRect(x - size / 2, y - size / 2 - (l - 1) * 2, size, size);
    g.strokeRect(x - size / 2, y - size / 2 - (l - 1) * 2, size, size);
  }
}

function dome(g, x, y, k = 1) {
  g.save();
  g.shadowColor = T.gold;
  g.shadowBlur = 8;
  g.fillStyle = alpha(T.gold, 0.85);
  g.beginPath();
  g.arc(x, y - 2, (CELL / 2 - 7) * k, Math.PI, 0);
  g.lineTo(x + (CELL / 2 - 7) * k, y + 6);
  g.lineTo(x - (CELL / 2 - 7) * k, y + 6);
  g.closePath();
  g.fill();
  g.restore();
}

function makeSpec(env) {
  const { sound } = env;
  let fx = { move: null, build: null };
  let preview = null; // 行き先を選んで仮置きした作業員の位置

  const spec = {
    id: 'santorini',
    en: 'SANTORINI',
    jp: 'ぽんとりーに',
    rules: ['作業員を動かして、積み木を 1 段積む', '3 段目に登ったら勝ち（ドームは登れない）'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ w: null, to: null }),
    reset() {
      fx = { move: null, build: null };
      preview = null;
    },
    onPress(c, x, y) {
      const gx = Math.floor((x - X0) / CELL);
      const gy = Math.floor((y - Y0) / CELL);
      if (gx < 0 || gy < 0 || gx >= R.N || gy >= R.N) return null;
      const { s, ui } = c;
      const team = s.workers[c.acting];
      const own = team.findIndex((p) => p.x === gx && p.y === gy);
      if (own >= 0 && !(ui.to && ui.w === own)) {
        // 作業員を選ぶ（選び直しも可）。動けない作業員は選べない
        if (R.steps(s, c.acting, own).length) {
          ui.w = ui.w === own && !ui.to ? null : own;
          ui.to = null;
        }
        return null;
      }
      if (ui.w === null) return null;
      if (!ui.to) {
        const dest = R.steps(s, c.acting, ui.w).find((m) => m.x === gx && m.y === gy);
        if (!dest) return null;
        if (s.h[idx(gx, gy)] === 3) return { w: ui.w, x: gx, y: gy }; // 3 段目へ登れば勝ち（積まない）
        ui.to = dest;
        return null;
      }
      if (gx === ui.to.x && gy === ui.to.y) {
        ui.to = null; // 仮置きした作業員をタップで、行き先を選び直す
        return null;
      }
      const a = { w: ui.w, x: ui.to.x, y: ui.to.y, bx: gx, by: gy };
      return R.apply(s, c.acting, a) ? a : null;
    },
    onApplied(c, prev, next) {
      const l = next.last;
      const shown = preview && preview.x === l.x && preview.y === l.y; // 仮置きで見せたなら、動きは付けない
      preview = null;
      fx.move = shown ? null : { who: l.who, w: l.w, from: l.from, to: { x: l.x, y: l.y }, t: 0 };
      if (l.bx >= 0) fx.build = { x: l.bx, y: l.by, t: shown ? 0 : -MOVE_T };
      sound.beep(l.bx >= 0 ? 360 : 880, 0.07, 'triangle', 0.07);
    },
    tick(c, dt) {
      if (fx.move) {
        fx.move.t += dt;
        if (fx.move.t > MOVE_T) fx.move = null;
      }
      if (fx.build) {
        fx.build.t += dt;
        if (fx.build.t > 0.25) fx.build = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock, ui } = c;
      const span = CELL * R.N;
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
      // 候補（マスの上に出す印は、積み木より前面に描くため、いったん集める）
      const marks = [];
      if (c.canAct) {
        if (ui.w === null) {
          s.workers[c.acting].forEach((p, i) => {
            if (!R.steps(s, c.acting, i).length) return;
            g.strokeStyle = alpha(col, 0.35 + 0.4 * pulse);
            g.lineWidth = 1.4;
            g.strokeRect(X0 + p.x * CELL + 2.5, Y0 + p.y * CELL + 2.5, CELL - 5, CELL - 5);
          });
        } else if (!ui.to) {
          // 動かす先: 行ける所は色と印（▲登る / ▼下る / ＝同じ高さ）、行けない所は赤い × と理由
          const p = s.workers[c.acting][ui.w];
          const here = s.h[idx(p.x, p.y)];
          const ok = new Set(R.steps(s, c.acting, ui.w).map((m) => idx(m.x, m.y)));
          for (const [dx, dy] of NEIGHBORS) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            if (nx < 0 || ny < 0 || nx >= R.N || ny >= R.N) continue;
            const lv = s.h[idx(nx, ny)];
            if (ok.has(idx(nx, ny))) {
              g.fillStyle = alpha(lv === 3 ? T.gold : col, 0.2 + 0.2 * pulse);
              g.fillRect(X0 + nx * CELL + 3, Y0 + ny * CELL + 3, CELL - 6, CELL - 6);
              marks.push({ x: nx, y: ny, t: lv === 3 ? '勝ち！' : lv > here ? '▲登る' : lv < here ? '▼下る' : '同じ高さ', color: lv === 3 ? T.gold : col });
            } else {
              const occupied = s.workers.some((team) => team.some((q) => q.x === nx && q.y === ny));
              g.fillStyle = 'rgba(255, 70, 90, 0.10)';
              g.fillRect(X0 + nx * CELL + 3, Y0 + ny * CELL + 3, CELL - 6, CELL - 6);
              marks.push({ x: nx, y: ny, t: occupied ? '×人がいる' : lv >= 4 ? '×ドーム' : '×高すぎ', color: T.bad });
            }
          }
        } else {
          // 積み木を積む先: 積むと何段になるか（3 段のマスはドーム）を出す
          for (const b of R.builds(s, c.acting, ui.w, ui.to.x, ui.to.y)) {
            g.fillStyle = alpha(T.gold, 0.16 + 0.16 * pulse);
            g.fillRect(X0 + b.x * CELL + 3, Y0 + b.y * CELL + 3, CELL - 6, CELL - 6);
            const next = s.h[idx(b.x, b.y)] + 1;
            marks.push({ x: b.x, y: b.y, t: next >= 4 ? '→ドーム' : `→${next}段`, color: T.gold });
          }
        }
      }
      // 積み木・ドーム
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          const level = s.h[idx(x, y)];
          if (!level) continue;
          const building = fx.build && fx.build.x === x && fx.build.y === y;
          const k = building ? Math.max(0, Math.min(1, fx.build.t / 0.25)) : 1;
          if (level === 4) {
            tower(g, cx(x), cy(y), 3);
            dome(g, cx(x), cy(y), k);
          } else tower(g, cx(x), cy(y), level, k);
        }
      }
      // 高さの数字（どのマスが何段かが分かるように）と、候補の印
      for (let y = 0; y < R.N; y++) {
        for (let x = 0; x < R.N; x++) {
          const level = s.h[idx(x, y)];
          if (level) ntext(g, level >= 4 ? 'ドーム' : `${level}段`, X0 + (x + 1) * CELL - 3, Y0 + (y + 1) * CELL - 11, 8, level >= 4 ? T.gold : T.white, 'right');
        }
      }
      for (const m of marks) ntext(g, m.t, X0 + (m.x + 0.5) * CELL, Y0 + m.y * CELL + 3, 8.5, m.color, 'center');
      // 作業員（積み木の上に立つので、少し上へ）
      for (const who of [0, 1]) {
        s.workers[who].forEach((p, i) => {
          let pos = p;
          if (fx.move && fx.move.who === who && fx.move.w === i) {
            const k = Math.min(1, fx.move.t / MOVE_T);
            pos = { x: fx.move.from.x + (fx.move.to.x - fx.move.from.x) * k, y: fx.move.from.y + (fx.move.to.y - fx.move.from.y) * k };
          } else if (who === c.acting && ui.w === i && ui.to) pos = ui.to;
          const level = s.h[idx(Math.round(pos.x), Math.round(pos.y))];
          const up = Math.min(level, 3) * 2;
          drawPawn(g, cx(pos.x), cy(pos.y) - up, SEAT_COLOR[who], clock, s.winner === -1 && who === c.acting && ui.w === i);
        });
      }
      if (c.canAct) {
        const msg = ui.w === null ? '動かす作業員をタップ' : !ui.to ? '行き先をタップ（1段上まで・3段で勝ち）' : '積むマスをタップ（元の場所にも積める）';
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
