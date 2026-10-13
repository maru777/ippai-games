// 糸通し: タップで糸を上昇させ、流れてくる針の穴を通る。先へ進むほど穴が小さくなる。
import { C, rect } from '../core/draw.js';

const TX = 64; // 糸の先端の x
const NW = 10; // 針の幅
const SPACING = 118;
const TRAIL_LEN = 80;

export default function create(env) {
  const { W, H, input, sound } = env;

  let y, vy, needles, passed, created, lastCenter, trail, t;

  const gapFor = (n) => Math.max(34, 90 - n * 3.5);

  function addNeedle(x) {
    const gap = gapFor(created);
    const lo = gap / 2 + 24;
    const hi = H - gap / 2 - 24;
    let c = lastCenter + (Math.random() - 0.5) * 190;
    c = Math.max(lo, Math.min(hi, c));
    needles.push({ x, c, gap, passed: false });
    lastCenter = c;
    created++;
  }

  function reset() {
    y = H / 2;
    vy = 0;
    needles = [];
    passed = 0;
    created = 0;
    lastCenter = H / 2;
    trail = [];
    t = 0;
    for (let i = 0; i < 3; i++) addNeedle(W + 20 + i * SPACING);
  }

  function update(dt) {
    t += dt;
    const speed = Math.min(85 + passed * 2.5, 150);

    if (input.pressed) {
      vy = -210;
      sound.beep(780, 0.04);
    }
    vy = Math.min(300, vy + 620 * dt);
    y += vy * dt;

    for (const n of needles) n.x -= speed * dt;
    for (const p of trail) p.x -= speed * dt;
    trail.push({ x: TX, y });
    while (trail.length && trail[0].x < TX - TRAIL_LEN) trail.shift();

    while (needles[needles.length - 1].x < W + 20) {
      addNeedle(needles[needles.length - 1].x + SPACING);
    }
    needles = needles.filter((n) => n.x > -NW - 4);

    if (y < 3 || y > H - 3) {
      env.end();
      return;
    }
    for (const n of needles) {
      if (TX + 3 > n.x && TX - 3 < n.x + NW) {
        if (y - 3 < n.c - n.gap / 2 || y + 3 > n.c + n.gap / 2) {
          env.end();
          return;
        }
      }
      if (!n.passed && n.x + NW < TX - 3) {
        n.passed = true;
        passed++;
        sound.beep(1100, 0.05, 'square', 0.05);
      }
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    for (const n of needles) {
      const top = n.c - n.gap / 2;
      const bot = n.c + n.gap / 2;
      rect(g, n.x, 0, NW, top, C.dark);
      rect(g, n.x, bot, NW, H - bot, C.dark);
      // 針の穴の縁
      rect(g, n.x - 2, top - 3, NW + 4, 3, C.dark);
      rect(g, n.x - 2, bot, NW + 4, 3, C.dark);
      rect(g, n.x + 2, 0, 2, top - 3, C.mid);
      rect(g, n.x + 2, bot + 3, 2, H - bot - 3, C.mid);
    }
    // 糸（軌跡）
    if (trail.length > 1) {
      g.strokeStyle = C.mid;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(trail[0].x, trail[0].y);
      for (const p of trail) g.lineTo(p.x, p.y);
      g.stroke();
    }
    rect(g, TX - 3, y - 3, 6, 6, C.dark);
  }

  return { reset, update, draw, get score() { return passed; } };
}
