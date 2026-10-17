// かべレースのネオン調の見た目（描画ヘルパーのみ。ゲームの状態は持たない）。
// 高解像度（hiRes）の canvas に論理座標 240×320 で描く前提。
export const T = {
  bg0: '#04061a',
  bg1: '#0c1238',
  me: '#2ef2ff', // 自分: シアン
  op: '#ff3df2', // 相手: マゼンタ
  gold: '#ffd84a',
  white: '#eaf6ff',
  dim: '#6f7fc0',
  bad: '#ff5470',
  line: '#2a3a7a',
};

const FONT = '"MS Gothic", "Osaka-Mono", "Noto Sans Mono CJK JP", monospace';

// '#rrggbb' に透明度を付けて rgba() 文字列にする
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function ntext(g, str, x, y, size, color = T.white, align = 'left', blur = 0) {
  g.save();
  g.font = `bold ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'top';
  g.fillStyle = color;
  if (blur) {
    g.shadowColor = color;
    g.shadowBlur = blur;
  }
  g.fillText(str, x, y);
  g.restore();
}

export function measure(g, str, size) {
  g.save();
  g.font = `bold ${size}px ${FONT}`;
  const w = g.measureText(str).width;
  g.restore();
  return w;
}

// 背景: 濃紺のグラデーションと、ゆっくり流れる格子
export function drawBg(g, W, H, t) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, T.bg0);
  grad.addColorStop(1, T.bg1);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.save();
  g.strokeStyle = 'rgba(90, 130, 255, 0.10)';
  g.lineWidth = 0.6;
  const step = 24;
  const off = (t * 6) % step;
  g.beginPath();
  for (let x = 0; x <= W; x += step) {
    g.moveTo(x, 0);
    g.lineTo(x, H);
  }
  for (let y = -step + off; y <= H; y += step) {
    g.moveTo(0, y);
    g.lineTo(W, y);
  }
  g.stroke();
  g.restore();
  // 四隅を暗くする
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

export function panel(g, r, o = {}) {
  const { fill = 'rgba(8, 14, 40, 0.85)', stroke = T.line, glow = null, blur = 8, radius = 5, lw = 1 } = o;
  g.save();
  if (glow) {
    g.shadowColor = glow;
    g.shadowBlur = blur;
  }
  rr(g, r.x, r.y, r.w, r.h, radius);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.stroke();
  g.restore();
}

// ボタン。on=false で無効（暗い）、active=true で塗りつぶし
export function nbutton(g, r, label, o = {}) {
  const { on = true, active = false, color = T.me, size = 12 } = o;
  const c = on ? color : T.dim;
  g.save();
  if (on) {
    g.shadowColor = color;
    g.shadowBlur = active ? 12 : 6;
  }
  rr(g, r.x, r.y, r.w, r.h, 5);
  g.fillStyle = active ? color : alpha(c, on ? 0.12 : 0.05);
  g.fill();
  g.lineWidth = 1.2;
  g.strokeStyle = alpha(c, on ? 0.95 : 0.4);
  g.stroke();
  g.restore();
  ntext(g, label, r.x + r.w / 2, r.y + r.h / 2 - size / 2 - 1, size, active ? T.bg0 : on ? T.white : alpha(T.dim, 0.7), 'center');
}

// 残り数を小さな縦棒で表示する
export function pips(g, x, y, n, max, color, align = 'left') {
  const w = 6;
  const gap = 2;
  const total = max * (w + gap) - gap;
  const x0 = align === 'right' ? x - total : x;
  g.save();
  for (let i = 0; i < max; i++) {
    const lit = i < n;
    if (lit) {
      g.shadowColor = color;
      g.shadowBlur = 5;
    } else {
      g.shadowBlur = 0;
    }
    g.fillStyle = lit ? color : alpha(color, 0.15);
    g.fillRect(x0 + i * (w + gap), y, w, 8);
  }
  g.restore();
}

// コマ。残像（trail）・手番の回転リング付き
export function drawPawn(g, cx, cy, color, t, active, trail = []) {
  for (const p of trail) {
    g.fillStyle = alpha(color, 0.28 * (p.life / p.max));
    g.beginPath();
    g.arc(p.x, p.y, 5.5 * (0.5 + 0.5 * (p.life / p.max)), 0, Math.PI * 2);
    g.fill();
  }
  g.save();
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.fillStyle = alpha(color, 0.28);
  g.beginPath();
  g.arc(cx, cy, 8, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = color;
  g.stroke();
  g.shadowBlur = 8;
  g.fillStyle = T.white;
  g.beginPath();
  g.arc(cx, cy, 3.2, 0, Math.PI * 2);
  g.fill();
  if (active) {
    g.shadowBlur = 0;
    g.lineWidth = 1.2;
    g.strokeStyle = alpha(color, 0.9);
    g.setLineDash([3, 4]);
    g.lineDashOffset = -t * 18;
    g.beginPath();
    g.arc(cx, cy, 11.5, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// 光る粒（勝利の紙吹雪・壁を置いた火花）
export class Particles {
  constructor() {
    this.list = [];
  }

  burst(x, y, colors, n, speed = 70, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - up,
        life: 0.6 + Math.random() * 0.7,
        max: 1.3,
        size: 1.5 + Math.random() * 2,
        color: colors[i % colors.length],
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.vy += 120 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(g) {
    g.save();
    for (const p of this.list) {
      g.globalAlpha = Math.min(1, p.life / 0.4);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.restore();
  }
}
