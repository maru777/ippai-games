// 4 色パレット（ガラケー液晶風）
export const C = {
  bg: '#9bbc0f',
  light: '#8bac0f',
  mid: '#306230',
  dark: '#0f380f',
};

const FONT = '"MS Gothic", "Osaka-Mono", "Noto Sans Mono CJK JP", monospace';

export function text(g, str, x, y, size = 12, color = C.dark, align = 'left') {
  g.font = `bold ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'top';
  g.fillStyle = color;
  g.fillText(str, Math.round(x), Math.round(y));
}

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(g, x, y, w, h, color = C.dark) {
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
}

export function inside(px, py, r) {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}
