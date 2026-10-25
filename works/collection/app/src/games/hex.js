// ぽっくす: 六角のマスのひし形の盤で、自分の 2 辺を石でつなげたら勝ち。後手は最初の 1 手のあと「入れ替え」を選べる。
// シアン = 上と下の辺、マゼンタ = 左と右の辺。CPU 戦・1 台で 2 人・オンライン 2 人対戦。
// ルールと CPU は hex-rules.js、共通の画面は duel-shell.js。操作: マスをタップして選び、もう一度タップか「おく」で置く。
import { T, alpha, ntext, nbutton } from './wall-race-theme.js';
import { createDuel, SEAT_COLOR } from './duel-shell.js';
import * as R from './hex-rules.js';

const N = R.N;
const W = 17.5; // 六角の横幅（隣の中心までの距離）
const H = W * 0.866;
const X0 = 8;
const Y0 = 104;
const RAD = W * 0.56;
const BTN_SWAP = { x: 4, y: 258, w: 150, h: 24 };

const cx = (x, y) => X0 + (x + y * 0.5) * W + W / 2;
const cy = (y) => Y0 + y * H;

function hexPath(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}

function makeSpec() {
  let fx = { put: null };

  const cellAt = (px, py) => {
    let best = null;
    let bd = RAD * 1.05;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(px - cx(x, y), py - cy(y));
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    }
    return best;
  };

  return {
    id: 'hex',
    en: 'HEX',
    jp: 'ぽっくす',
    rules: ['自分の 2 辺を石でつなげたら勝ち', '後手は最初の 1 手のあと入れ替えられる'],
    newState: R.newState,
    turn: R.turn,
    winner: R.winner,
    apply: R.apply,
    ai: R.ai,
    legalMoves: R.legalMoves,
    score: R.score,
    newUi: () => ({ sel: null }),
    reset() {
      fx = { put: null };
    },
    confirm: {
      label: 'おく',
      enabled: (c) => !!c.ui.sel && c.s.cells[c.ui.sel.y * N + c.ui.sel.x] === -1,
      action: (c) => ({ x: c.ui.sel.x, y: c.ui.sel.y }),
    },
    onPress(c, x, y) {
      const { s, ui } = c;
      if (R.canSwap(s) && x >= BTN_SWAP.x && x < BTN_SWAP.x + BTN_SWAP.w && y >= BTN_SWAP.y && y < BTN_SWAP.y + BTN_SWAP.h) return { swap: true };
      const cell = cellAt(x, y);
      if (!cell || s.cells[cell.y * N + cell.x] !== -1) return null;
      if (ui.sel && ui.sel.x === cell.x && ui.sel.y === cell.y) return { x: cell.x, y: cell.y };
      ui.sel = cell;
      return null;
    },
    onApplied(c, prev, next) {
      fx.put = next.last.swap ? null : { x: next.last.x, y: next.last.y, t: 0 };
    },
    tick(c, dt) {
      if (fx.put) {
        fx.put.t += dt;
        if (fx.put.t > 0.3) fx.put = null;
      }
    },
    drawBoard(g, c) {
      const { s, clock, ui } = c;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      const col = SEAT_COLOR[c.acting];
      // 辺の色（上下 = 座席 0、左右 = 座席 1）
      const tl = { x: cx(0, 0) - W / 2, y: cy(0) - RAD - 3 };
      const tr = { x: cx(N - 1, 0) + W / 2, y: tl.y };
      const bl = { x: cx(0, N - 1) - W / 2, y: cy(N - 1) + RAD + 3 };
      const br = { x: cx(N - 1, N - 1) + W / 2, y: bl.y };
      g.save();
      g.lineWidth = 3;
      for (const [a, b, who] of [[tl, tr, 0], [bl, br, 0], [tl, bl, 1], [tr, br, 1]]) {
        g.shadowColor = SEAT_COLOR[who];
        g.shadowBlur = 8;
        g.strokeStyle = alpha(SEAT_COLOR[who], 0.85);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.restore();
      const win = s.winner !== -1 && s.winner !== 2 ? new Set(R.connected(s.cells, s.winner) || []) : null;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = s.cells[y * N + x];
          const px = cx(x, y);
          const py = cy(y);
          hexPath(g, px, py, RAD);
          g.fillStyle = v === -1 ? 'rgba(80, 100, 210, 0.1)' : alpha(SEAT_COLOR[v], 0.18);
          g.fill();
          g.lineWidth = 0.8;
          g.strokeStyle = 'rgba(120, 150, 255, 0.35)';
          g.stroke();
          if (v !== -1) {
            let k = 1;
            if (fx.put && fx.put.x === x && fx.put.y === y) k = 0.4 + 0.6 * Math.min(1, fx.put.t / 0.3);
            g.save();
            g.shadowColor = SEAT_COLOR[v];
            g.shadowBlur = win && win.has(y * N + x) ? 14 : 7;
            const grad = g.createRadialGradient(px - 2, py - 2, 1, px, py, RAD * 0.75);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, SEAT_COLOR[v]);
            grad.addColorStop(1, alpha(SEAT_COLOR[v], 0.6));
            g.fillStyle = grad;
            g.beginPath();
            g.arc(px, py, RAD * 0.72 * k, 0, Math.PI * 2);
            g.fill();
            g.restore();
            if (s.last && s.last.x === x && s.last.y === y && !win) {
              g.strokeStyle = alpha(T.white, 0.8);
              g.lineWidth = 1;
              g.beginPath();
              g.arc(px, py, RAD * 0.85, 0, Math.PI * 2);
              g.stroke();
            }
          }
        }
      }
      if (c.canAct && ui.sel && s.cells[ui.sel.y * N + ui.sel.x] === -1) {
        g.save();
        g.shadowColor = col;
        g.shadowBlur = 10;
        g.globalAlpha = 0.5 + 0.4 * pulse;
        g.fillStyle = col;
        g.beginPath();
        g.arc(cx(ui.sel.x, ui.sel.y), cy(ui.sel.y), RAD * 0.62, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // 色の説明
      ntext(g, 'シアン: 上⇔下', 8, 52, 9, SEAT_COLOR[0], 'left');
      ntext(g, 'マゼンタ: 左⇔右', 232, 52, 9, SEAT_COLOR[1], 'right');
      if (c.canAct && R.canSwap(s)) {
        nbutton(g, BTN_SWAP, '入れ替える（この石を自分のものに）', { color: T.gold, size: 10 });
      } else if (c.canAct) {
        ntext(g, ui.sel ? 'もう一度タップか「おく」で置く' : '置くマスをタップ', 8, 270, 10, T.dim);
      }
    },
  };
}

export default function create(env) {
  return createDuel(env, makeSpec);
}
