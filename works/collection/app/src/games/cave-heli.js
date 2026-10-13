// 洞窟ヘリ: 押している間上昇、離すと下降。壁や柱に当たらず進む。
import { C, rect } from '../core/draw.js';

export default function create(env) {
  const { W, H, input, sound } = env;
  const COL = 6; // 洞窟 1 列の幅(px)
  const N = Math.ceil(W / COL) + 2;
  const HX = 56; // ヘリの x
  const HW = 14;
  const HH = 8;

  let cols, scrollX, dist, y, vy, centre, slope, pillarLeft, nextPillar, t;

  function gapAt(d) {
    return Math.max(78, 170 - d / 45);
  }

  function nextCol(flat) {
    const gap = gapAt(dist);
    if (!flat) {
      slope += (Math.random() - 0.5) * 1.2;
      slope = Math.max(-2.2, Math.min(2.2, slope));
      centre += slope;
      const lo = gap / 2 + 10;
      const hi = H - gap / 2 - 10;
      if (centre < lo) { centre = lo; slope = Math.abs(slope) * 0.5; }
      if (centre > hi) { centre = hi; slope = -Math.abs(slope) * 0.5; }
    }
    const col = { top: centre - gap / 2, bot: centre + gap / 2, blk: null };
    if (!flat) {
      if (pillarLeft > 0) {
        col.blk = { y: centre - 12, h: 24 };
        pillarLeft--;
      } else if (--nextPillar <= 0) {
        pillarLeft = 3;
        nextPillar = 22 + Math.floor(Math.random() * 14);
      }
    }
    return col;
  }

  function reset() {
    dist = 0;
    scrollX = 0;
    centre = H / 2;
    slope = 0;
    pillarLeft = 0;
    nextPillar = 30;
    y = H / 2;
    vy = 0;
    t = 0;
    cols = [];
    for (let i = 0; i < N; i++) cols.push(nextCol(true));
  }

  function hit() {
    if (y - HH / 2 < 0 || y + HH / 2 > H) return true;
    const i0 = Math.floor((HX - HW / 2 + scrollX) / COL);
    const i1 = Math.floor((HX + HW / 2 + scrollX) / COL);
    for (let i = i0; i <= i1; i++) {
      const c = cols[i];
      if (!c) continue;
      if (y - HH / 2 < c.top || y + HH / 2 > c.bot) return true;
      if (c.blk && y + HH / 2 > c.blk.y && y - HH / 2 < c.blk.y + c.blk.h) return true;
    }
    return false;
  }

  function update(dt) {
    t += dt;
    const speed = Math.min(90 + dist / 30, 210);
    dist += speed * dt;
    scrollX += speed * dt;
    while (scrollX >= COL) {
      scrollX -= COL;
      cols.shift();
      cols.push(nextCol(false));
    }
    const up = input.down;
    vy += (up ? -650 : 520) * dt;
    vy = Math.max(-210, Math.min(240, vy));
    y += vy * dt;
    if (hit()) {
      env.end();
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const x = i * COL - scrollX;
      rect(g, x, 0, COL, c.top, C.mid);
      rect(g, x, c.bot, COL, H - c.bot, C.mid);
      rect(g, x, c.top - 2, COL, 2, C.dark);
      rect(g, x, c.bot, COL, 2, C.dark);
      if (c.blk) rect(g, x, c.blk.y, COL, c.blk.h, C.dark);
    }
    // ヘリ（本体・尾・ローター）
    const hy = Math.round(y);
    rect(g, HX - 7, hy - 4, 12, 8, C.dark);
    rect(g, HX - 13, hy - 2, 7, 2, C.dark);
    rect(g, HX - 14, hy - 5, 2, 5, C.dark);
    rect(g, HX + 3, hy - 2, 3, 3, C.bg);
    const blade = Math.floor(t * 30) % 2 ? 9 : 5;
    rect(g, HX - 1 - blade, hy - 7, blade * 2, 1, C.dark);
    rect(g, HX - 1, hy - 6, 2, 2, C.dark);
  }

  return { reset, update, draw, get score() { return Math.floor(dist / 10); } };
}
