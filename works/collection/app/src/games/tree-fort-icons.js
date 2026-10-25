// ツリー砦: 武器・ステータス・遺物・契約の線画アイコン（24×24 の座標で定義）。
// 図柄の追加は ICON に 1 件足す。p = SVG のパス、c = 円 [cx, cy, r]、e = 楕円 [cx, cy, rx, ry, 回転(rad)]。
// closed: true の図形は、色を薄く塗って面を出す（線だけだと小さい画面で読みにくいので）。
import { rgba } from './tree-fort-skins.js';

const P = (d, closed = false) => ({ p: d, closed });
const C = (cx, cy, r, closed = false) => ({ c: [cx, cy, r], closed });

export const ICON = {
  // 武器
  bomb: [C(11, 14, 7, true), P('M15.5 8.5 L19 5'), P('M19 2.5v2M21.5 5h-2')],
  lightning: [P('M13.5 2 L5 13.5 H11 L9.5 22 L19 10 H13 Z', true)],
  blade: [C(12, 12, 5), P('M12 1.5 L14.5 6 H9.5Z', true), P('M12 22.5 L9.5 18 H14.5Z', true), P('M1.5 12 L6 9.5 V14.5Z', true), P('M22.5 12 L18 14.5 V9.5Z', true)],
  flame: [P('M12 2 C13.5 7 19 9 19 15 A7 7 0 0 1 5 15 C5 11 8 10 9 6 C10 8 11 9 12 9 C13 7 12 5 12 2Z', true)],
  frost: [P('M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6'), P('M9.5 4.5 L12 7 L14.5 4.5M9.5 19.5 L12 17 L14.5 19.5')],
  poison: [P('M12 3 C16 9 19 12 19 15.5 A7 7 0 0 1 5 15.5 C5 12 8 9 12 3Z', true), P('M9.5 16 a2.5 2.5 0 0 0 2.5 2.5')],
  missile: [P('M12 2 C16 6 16.5 12 15 17 H9 C7.5 12 8 6 12 2Z', true), P('M9 13 L5 19 H9Z', true), P('M15 13 L19 19 H15Z', true), P('M12 18v4')],
  laser: [P('M2.5 8.5 H8 V15.5 H2.5Z', true), P('M8 12 H21.5'), P('M19 9.5 L21.5 12 L19 14.5')],
  mine: [C(12, 12, 5.5, true), P('M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8')],
  gravity: [{ e: [12, 12, 10, 4.5, -0.436], closed: false }, C(12, 12, 3, true)],
  meteor: [C(16, 9, 5, true), P('M12.5 12.5 L3 21M10 8 L3 12M16 15 L12 21')],
  drone: [{ e: [12, 13, 5, 3, 0], closed: true }, P('M3 8h7M14 8h7M7 8l2 3M17 8l-2 3M12 16v4')],
  // ステータス
  dmg: [P('M18.5 2.5 H21.5 V5.5 L11 16 L8 13 Z', true), P('M5.5 14.5 L9.5 18.5M7.5 16.5 L4 20')],
  rate: [P('M4 6 L10 12 L4 18M11 6 L17 12 L11 18'), P('M19 6 L22 12 L19 18')],
  range: [C(12, 12, 9), C(12, 12, 5), C(12, 12, 1.8, true)],
  hp: [P('M12 2.5 L20 5.5 V12 C20 17 16 20 12 21.5 C8 20 4 17 4 12 V5.5Z', true)],
  crit: [P('M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8Z', true)],
  regen: [P('M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z', true)],
  pierce: [P('M2.5 12 H17'), P('M21.5 12 L15.5 7.5 V16.5Z', true), P('M8 5v14M12 7v10')],
  target: [C(5.5, 12, 3, true), C(18, 5.5, 3, true), C(18, 18.5, 3, true), P('M8.5 12 L15.5 6.5M8.5 12 L15.5 17.5')],
  heal: [P('M12 21 C5 15.5 2.5 12 2.5 8.5 A4.8 4.8 0 0 1 12 6.5 A4.8 4.8 0 0 1 21.5 8.5 C21.5 12 19 15.5 12 21Z', true)],
  // 遺物・契約・未知
  relic: [P('M6 4 H18 L22 10 L12 21 L2 10 Z', true), P('M2 10 H22M9 4 L7.5 10 L12 21 L16.5 10 L15 4')],
  contract: [P('M5 3 H19 V19 L16 21 L12 19 L8 21 L5 19 Z', true), P('M8.5 8 H15.5M8.5 12 H15.5')],
  unknown: [P('M8.5 9 A3.5 3.5 0 1 1 12.8 12.4 C12.2 12.9 12 13.5 12 15'), C(12, 19, 1, true)],
};

const cache = {};
const path2d = (d) => (cache[d] || (cache[d] = new Path2D(d)));

// (cx, cy) を中心に、size × size で描く。色 color の線。lw は 24 座標での線の太さ。
export function drawIcon(g, key, cx, cy, size, color, lw = 1.7) {
  const shapes = ICON[key] || ICON.unknown;
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 24, size / 24);
  g.strokeStyle = color;
  g.fillStyle = rgba(color, 0.22);
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of shapes) {
    if (s.p) {
      if (typeof Path2D === 'undefined') continue; // 描画なしの検証（node）では図形を作れない
      const d = path2d(s.p);
      if (s.closed) g.fill(d);
      g.stroke(d);
    } else {
      g.beginPath();
      if (s.c) g.arc(s.c[0], s.c[1], s.c[2], 0, Math.PI * 2);
      else g.ellipse(s.e[0], s.e[1], s.e[2], s.e[3], s.e[4], 0, Math.PI * 2);
      if (s.closed) g.fill();
      g.stroke();
    }
  }
  g.restore();
}
