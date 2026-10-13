// 坂道ダッシュ: 山と谷を下って加速、上って減速。タップでジャンプして崖を飛び越える。
// 押し続けると高く跳べる。崖に落ちる／障害物に当たると終了。
import { C, rect } from '../core/draw.js';

const PX = 60; // 自転車の画面 x
const AWARDS = [
  [0, '自転車見習い賞'],
  [150, '坂道ライダー賞'],
  [400, '崖っぷち名人賞'],
  [800, '山岳ヒルクライム賞'],
  [1400, '伝説のチャリ乗り賞'],
];

// 地形の高さ（x は世界座標）
const hgt = (x) => 215 + 30 * Math.sin(x / 110) + 14 * Math.sin(x / 47 + 2) + 10 * Math.sin(x / 260);

export default function create(env) {
  const { W, H, input, sound } = env;

  let dist, y, vy, v, onGround, coyote, ang, t;
  let cliffs, obstacles, coins, coinCount, nextCliff, nextObs;

  function reset() {
    dist = 0;
    v = 150;
    y = hgt(0);
    vy = 0;
    onGround = true;
    coyote = 0;
    ang = 0;
    t = 0;
    cliffs = [];
    obstacles = [];
    coins = [];
    coinCount = 0;
    nextCliff = 520;
    nextObs = 330;
  }

  const inGap = (x) => cliffs.some((c) => x >= c.x0 && x < c.x1);

  // 画面右端のさらに先まで、崖・障害物・コインを生成しておく
  function ensure() {
    const limit = dist + W + 120;
    while (nextCliff < limit) {
      const width = Math.min(120, 55 + nextCliff / 90);
      cliffs.push({ x0: nextCliff, x1: nextCliff + width });
      const mx = nextCliff + width / 2;
      for (let i = -1; i <= 1; i++) {
        coins.push({ x: mx + i * 26, y: hgt(mx) - 58 + Math.abs(i) * 8, got: false });
      }
      nextCliff += width + 320 + Math.random() * 340;
    }
    while (nextObs < limit) {
      const x = nextObs;
      const safe = !cliffs.some((c) => x > c.x0 - 70 && x < c.x1 + 70);
      if (safe && x > 400) {
        obstacles.push({ x, w: 10 + Math.floor(Math.random() * 8), h: 10 + Math.floor(Math.random() * 10) });
      }
      nextObs += 260 + Math.random() * 300;
    }
    cliffs = cliffs.filter((c) => c.x1 > dist - 200);
    obstacles = obstacles.filter((o) => o.x > dist - 100);
    coins = coins.filter((c) => !c.got && c.x > dist - 100);
  }

  function update(dt) {
    t += dt;
    const slope = (hgt(dist + 4) - hgt(dist - 4)) / 8; // 正 = 下り
    if (onGround) {
      v += (slope * 500 + 25 - v * 0.12) * dt;
      v = Math.max(60, Math.min(340, v));
    }
    dist += v * dt;
    ensure();

    coyote = onGround ? 0.1 : coyote - dt;
    if (input.pressed && (onGround || coyote > 0)) {
      vy = slope * v - 300;
      onGround = false;
      coyote = 0;
      sound.beep(660, 0.06);
    }

    const gap = inGap(dist);
    const gy = gap ? Infinity : hgt(dist);
    if (onGround) {
      if (gap) {
        onGround = false;
        vy = slope * v;
      } else {
        y = gy;
      }
    }
    if (!onGround) {
      vy += (input.down && vy < 0 ? 600 : 900) * dt;
      y += vy * dt;
      if (y >= gy) {
        if (y - gy > vy * dt + 8) {
          env.end(); // 崖の壁に激突
          return;
        }
        y = gy;
        vy = 0;
        onGround = true;
      }
      if (y > H + 40) {
        env.end();
        return;
      }
    }

    // 車体の傾き（地上は坂に合わせ、空中は進行方向へ）
    const target = onGround ? Math.atan(slope) : Math.atan2(vy, Math.max(v, 60)) * 0.6;
    ang += (target - ang) * Math.min(1, dt * 12);

    for (const o of obstacles) {
      if (Math.abs(o.x + o.w / 2 - dist) < o.w / 2 + 7 && y > hgt(o.x) - o.h + 3) {
        env.end();
        return;
      }
    }
    for (const c of coins) {
      if (Math.abs(c.x - dist) < 14 && Math.abs(c.y - (y - 14)) < 18) {
        c.got = true;
        coinCount++;
        sound.beep(1320, 0.05, 'square', 0.05);
      }
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, H, C.bg);
    // 遠景の山
    const off = dist * 0.3;
    for (let sx = 0; sx < W; sx += 4) {
      const wx = off + sx;
      const top = 150 + 25 * Math.sin(wx / 70) + 15 * Math.sin(wx / 29);
      rect(g, sx, top, 4, H - top, C.light);
    }
    // 地形（崖の部分は描かない）
    const left = dist - PX;
    for (let sx = 0; sx < W; sx += 2) {
      const wx = left + sx;
      if (inGap(wx)) continue;
      const top = hgt(wx);
      rect(g, sx, top, 2, H - top, C.mid);
      rect(g, sx, top, 2, 3, C.dark);
    }
    // 障害物
    for (const o of obstacles) {
      const sx = o.x - left;
      if (sx < -30 || sx > W + 30) continue;
      rect(g, sx, hgt(o.x) - o.h, o.w, o.h, C.dark);
    }
    // コイン
    for (const c of coins) {
      const sx = c.x - left;
      rect(g, sx - 3, c.y - 3, 6, 6, C.dark);
      rect(g, sx - 1, c.y - 1, 2, 2, C.bg);
    }
    // 自転車と乗り手（回転して描く）
    g.save();
    g.translate(Math.round(PX), Math.round(y));
    g.rotate(ang);
    g.strokeStyle = C.dark;
    g.lineWidth = 2;
    for (const wx of [-9, 9]) {
      g.beginPath();
      g.arc(wx, -6, 5, 0, Math.PI * 2);
      g.stroke();
      const a = t * 18;
      g.beginPath();
      g.moveTo(wx + Math.cos(a) * 4, -6 + Math.sin(a) * 4);
      g.lineTo(wx - Math.cos(a) * 4, -6 - Math.sin(a) * 4);
      g.stroke();
    }
    g.fillStyle = C.dark;
    g.fillRect(-9, -13, 18, 2); // フレーム
    g.fillRect(-4, -26, 7, 13); // 体
    g.fillRect(-3, -33, 6, 6); // 頭
    g.fillRect(3, -22, 8, 2); // 腕
    g.restore();
  }

  return {
    reset,
    update,
    draw,
    get score() { return Math.floor(dist / 10) + coinCount * 10; },
    get award() {
      let a = AWARDS[0][1];
      for (const [min, name] of AWARDS) if (this.score >= min) a = name;
      return a;
    },
  };
}
