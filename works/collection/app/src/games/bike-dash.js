// 自転車ダッシュ: タップでジャンプ（押し続けると高く）。障害物を飛び越えて距離を稼ぐ。
import { C, rect } from '../core/draw.js';

const GROUND = 252;
const PX = 50; // 自転車の x
const TYPES = [
  { name: 'cone', w: 10, h: 14 },
  { name: 'dog', w: 22, h: 14 },
  { name: 'person', w: 12, h: 28 },
  { name: 'wall', w: 16, h: 22 },
];

export default function create(env) {
  const { W, H, input, sound } = env;

  let dist, y, vy, onGround, obstacles, coins, spawnAt, coinCount, t;

  const speed = () => Math.min(120 + dist / 45, 270);

  function reset() {
    dist = 0;
    y = GROUND;
    vy = 0;
    onGround = true;
    obstacles = [];
    coins = [];
    spawnAt = 260; // 次に障害物を出す dist
    coinCount = 0;
    t = 0;
  }

  function spawn() {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const x = W + 20;
    obstacles.push({ ...type, x });
    // 飛び越える位置の上にコイン
    if (Math.random() < 0.7) {
      coins.push({ x: x + type.w / 2, y: GROUND - type.h - 26 - Math.random() * 18, got: false });
    }
    // 次の間隔: 現在速度で着地後に反応できる距離を確保
    const sp = speed();
    spawnAt = dist + sp * 0.95 + 60 + Math.random() * 110;
  }

  function update(dt) {
    t += dt;
    const sp = speed();
    dist += sp * dt;

    if (input.pressed && onGround) {
      vy = -340;
      onGround = false;
      sound.beep(660, 0.06);
    }
    // 押し続けている間は重力を弱めて高く跳ぶ
    const g = input.down && vy < 0 ? 620 : 1100;
    vy += g * dt;
    y += vy * dt;
    if (y >= GROUND) {
      y = GROUND;
      vy = 0;
      onGround = true;
    }

    if (dist >= spawnAt) spawn();
    for (const o of obstacles) o.x -= sp * dt;
    for (const c of coins) c.x -= sp * dt;
    obstacles = obstacles.filter((o) => o.x + o.w > -10);
    coins = coins.filter((c) => c.x > -10 && !c.got);

    // 当たり判定（少し小さめに取る）
    const bx0 = PX - 9;
    const bx1 = PX + 9;
    const by0 = y - 22;
    const by1 = y;
    for (const o of obstacles) {
      const ox0 = o.x + 2;
      const ox1 = o.x + o.w - 2;
      const oy0 = GROUND - o.h + 2;
      if (bx1 > ox0 && bx0 < ox1 && by1 > oy0) {
        env.end();
        return;
      }
    }
    for (const c of coins) {
      if (Math.abs(c.x - PX) < 11 && c.y > by0 - 4 && c.y < by1 + 4) {
        c.got = true;
        coinCount++;
        sound.beep(1320, 0.05, 'square', 0.05);
      }
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    // 遠景（ビル）
    const off = dist * 0.25;
    for (let i = -1; i < 12; i++) {
      const gx = Math.floor((off + i * 28) / 28);
      const h = 30 + ((gx * 37) % 5) * 12;
      rect(g, i * 28 - (off % 28), GROUND - h, 22, h, C.light);
    }
    // 地面
    rect(g, 0, GROUND, W, H - GROUND, C.mid);
    rect(g, 0, GROUND, W, 2, C.dark);
    const m = Math.floor(dist) % 24;
    for (let x = -m; x < W; x += 24) rect(g, x, GROUND + 12, 12, 2, C.dark);

    // 障害物
    for (const o of obstacles) {
      rect(g, o.x, GROUND - o.h, o.w, o.h, C.dark);
      if (o.name === 'person') rect(g, o.x + 3, GROUND - o.h - 6, 6, 6, C.dark);
      if (o.name === 'dog') rect(g, o.x + o.w - 6, GROUND - o.h - 4, 6, 4, C.dark);
    }
    // コイン
    for (const c of coins) {
      rect(g, c.x - 3, c.y - 3, 6, 6, C.dark);
      rect(g, c.x - 1, c.y - 1, 2, 2, C.bg);
    }
    // 自転車と乗り手
    const by = Math.round(y);
    const spin = Math.floor(t * 20) % 2;
    for (const wx of [PX - 10, PX + 8]) {
      rect(g, wx - 5, by - 10, 10, 10, C.dark);
      rect(g, wx - 3, by - 8, 6, 6, C.bg);
      rect(g, wx - (spin ? 1 : 0), by - 6 + (spin ? 0 : 0), 1, 3, C.dark);
      if (spin) rect(g, wx - 3, by - 5, 6, 1, C.dark);
    }
    rect(g, PX - 10, by - 12, 18, 2, C.dark); // フレーム
    rect(g, PX - 4, by - 24, 7, 12, C.dark); // 体
    rect(g, PX - 3, by - 31, 6, 6, C.dark); // 頭
    rect(g, PX + 3, by - 20, 8, 2, C.dark); // 腕
  }

  return {
    reset,
    update,
    draw,
    get score() { return Math.floor(dist / 10) + coinCount * 10; },
  };
}
