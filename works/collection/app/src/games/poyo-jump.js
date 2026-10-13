// ポヨジャンプ: 自動で跳ね続けるボールを左右に動かし、足場を渡って上へ登る。
// 操作: 画面をドラッグ（押している位置へ寄る）／PC は矢印キー。画面端は反対側へつながる。
import { C, rect } from '../core/draw.js';

const R = 6;
const PW = 38;
const PH = 6;
const START_Y = 260;

export default function create(env) {
  const { W, H, input, sound } = env;

  let x, y, vy, cam, plats, topY, climbed;

  function genUntil(limit) {
    while (topY > limit) {
      const h = (START_Y - topY) / 10;
      topY -= 52 + Math.random() * (22 + Math.min(34, h / 40));
      const moving = Math.random() < Math.min(0.35, h / 2500);
      plats.push({
        x: Math.random() * (W - PW),
        y: topY,
        moving,
        dir: Math.random() < 0.5 ? -1 : 1,
      });
    }
  }

  function reset() {
    x = W / 2;
    y = START_Y - R;
    vy = -470;
    cam = 0;
    climbed = 0;
    plats = [{ x: W / 2 - PW / 2, y: START_Y, moving: false, dir: 1 }];
    topY = START_Y;
    genUntil(cam - 60);
  }

  function update(dt) {
    // 横移動
    if (input.pointerDown) {
      const d = Math.max(-260 * dt, Math.min(260 * dt, input.x - x));
      x += d;
    }
    if (input.left) x -= 200 * dt;
    if (input.right) x += 200 * dt;
    if (x < 0) x += W;
    if (x > W) x -= W;

    for (const p of plats) {
      if (!p.moving) continue;
      p.x += p.dir * 45 * dt;
      if (p.x < 0) { p.x = 0; p.dir = 1; }
      if (p.x > W - PW) { p.x = W - PW; p.dir = -1; }
    }

    const prevY = y;
    vy += 900 * dt;
    y += vy * dt;

    if (vy > 0) {
      for (const p of plats) {
        if (prevY + R <= p.y + 1 && y + R >= p.y && x + R > p.x && x - R < p.x + PW) {
          vy = -470;
          y = p.y - R;
          sound.beep(520, 0.05, 'square', 0.05);
          break;
        }
      }
    }

    if (y < cam + H * 0.4) cam = y - H * 0.4;
    climbed = Math.max(climbed, START_Y - R - y);
    genUntil(cam - 60);
    plats = plats.filter((p) => p.y < cam + H + 40);

    if (y > cam + H + 20) env.end();
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    // 高さの目印（100 ごと）
    const base = Math.floor(cam / 100) * 100;
    for (let wy = base; wy < cam + H + 100; wy += 100) {
      rect(g, 0, wy - cam, W, 1, C.light);
    }
    for (const p of plats) {
      const sy = p.y - cam;
      rect(g, p.x, sy, PW, PH, p.moving ? C.mid : C.dark);
      if (p.moving) rect(g, p.x + 2, sy + 2, PW - 4, 2, C.bg);
    }
    const sy = Math.round(y - cam);
    const sx = Math.round(x);
    rect(g, sx - R, sy - R, R * 2, R * 2, C.dark);
    rect(g, sx - R + 1, sy - R - 1, R * 2 - 2, 1, C.dark);
    rect(g, sx - 3, sy - 2, 2, 3, C.bg);
    rect(g, sx + 1, sy - 2, 2, 3, C.bg);
  }

  return { reset, update, draw, get score() { return Math.floor(climbed / 10); } };
}
