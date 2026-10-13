// マダム飛行: 長押しで上昇。横スクロールで流れる壁にぶつかると押し戻され、
// 後ろから迫る壁に挟まれると終了。アメを取ると後ろの壁を押し返せる。
import { C, rect } from '../core/draw.js';

const HW = 7;
const HH = 12;
const OW = 20;

export default function create(env) {
  const { W, H, input, sound } = env;

  let px, y, vy, wallX, obs, items, dist, got, nextX, t;

  function addObstacle(x) {
    const gap = Math.max(82, 126 - dist / 70);
    const c = gap / 2 + 18 + Math.random() * (H - gap - 36);
    obs.push({ x, top: c - gap / 2, bot: c + gap / 2 });
    if (Math.random() < 0.45) {
      items.push({ x: x + 85, y: 34 + Math.random() * (H - 68) });
    }
  }

  function reset() {
    px = 110;
    y = H / 2;
    vy = 0;
    wallX = -14;
    obs = [];
    items = [];
    dist = 0;
    got = 0;
    t = 0;
    nextX = W + 20;
    while (nextX < W + 260) {
      addObstacle(nextX);
      nextX += 170;
    }
  }

  function update(dt) {
    t += dt;
    const speed = Math.min(95 + dist / 40, 190);
    dist += speed * dt;

    vy += (input.down ? -620 : 480) * dt;
    vy = Math.max(-200, Math.min(230, vy));
    y += vy * dt;
    if (y < HH) { y = HH; vy = 0; }
    if (y > H - HH) { y = H - HH; vy = 0; }

    for (const o of obs) o.x -= speed * dt;
    for (const it of items) it.x -= speed * dt;
    nextX -= speed * dt;
    while (nextX < W + 20) {
      addObstacle(nextX);
      nextX += 150 + Math.random() * 70;
    }
    obs = obs.filter((o) => o.x > -OW - 10);
    items = items.filter((it) => it.x > -20);

    // 前進（壁に押し戻されなければ少しずつ前へ）
    px = Math.min(px + 30 * dt, 120);
    for (const o of obs) {
      if (px + HW > o.x && px - HW < o.x + OW && (y - HH < o.top || y + HH > o.bot)) {
        px = Math.min(px, o.x - HW);
      }
    }

    // 後ろから迫る壁
    wallX += (5 + dist / 500) * dt;
    if (px - HW <= wallX) {
      env.end();
      return;
    }

    for (const it of items) {
      if (Math.abs(it.x - px) < HW + 6 && Math.abs(it.y - y) < HH + 6) {
        it.x = -100;
        got++;
        wallX = Math.max(-14, wallX - 45);
        sound.beep(1200, 0.06, 'square', 0.05);
      }
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    for (const o of obs) {
      rect(g, o.x, 0, OW, o.top, C.mid);
      rect(g, o.x, o.bot, OW, H - o.bot, C.mid);
      rect(g, o.x - 2, o.top - 4, OW + 4, 4, C.dark);
      rect(g, o.x - 2, o.bot, OW + 4, 4, C.dark);
    }
    for (const it of items) {
      rect(g, it.x - 4, it.y - 4, 8, 8, C.dark);
      rect(g, it.x - 1, it.y - 1, 2, 2, C.bg);
    }
    // 迫る壁（ギザギザ）
    if (wallX > 0) {
      rect(g, 0, 0, wallX, H, C.dark);
      for (let yy = 0; yy < H; yy += 12) rect(g, wallX, yy, 6, 6, C.dark);
    }
    // おばちゃん（パーマ頭、ワンピース、手足）
    const x = Math.round(px);
    const yy = Math.round(y);
    rect(g, x - 7, yy - 12, 14, 7, C.dark); // パーマ
    rect(g, x - 5, yy - 6, 10, 6, C.bg);
    rect(g, x - 5, yy - 6, 10, 1, C.dark);
    rect(g, x - 1, yy - 4, 1, 1, C.dark);
    rect(g, x - 4, yy, 8, 8, C.mid); // ワンピース
    rect(g, x - 5, yy + 8, 10, 2, C.mid);
    const flap = input.down ? -5 : 2;
    rect(g, x - 9, yy + flap, 5, 2, C.dark); // 腕
    rect(g, x + 4, yy + flap, 5, 2, C.dark);
    rect(g, x - 3, yy + 10, 2, 3, C.dark); // 脚
    rect(g, x + 1, yy + 10, 2, 3, C.dark);
  }

  return {
    reset,
    update,
    draw,
    get score() { return Math.floor(dist / 10) + got * 5; },
  };
}
