// ツリー砦の戦闘ロジック（描画なし）。能力値（tree-fort-data.js の computeStats）を渡すと、
// 砦が自動で攻撃し、波ごとに敵が押し寄せる。step(dt) で進め、b の状態を描画側が読む。
export const ARENA = { W: 240, H: 320, cx: 120, cy: 172, towerR: 11 };

const TYPES = {
  grunt: { hp: 6, spd: 24, dmg: 4, r: 5, pts: 1 },
  runner: { hp: 3.5, spd: 46, dmg: 3, r: 4, pts: 1 },
  tank: { hp: 30, spd: 15, dmg: 12, r: 8, pts: 4 },
};
const BULLET_SPEED = 280;
const SLOW_RADIUS = 75;
const BLADE_R = 26;

export function createBattle(stats, rng = Math.random) {
  const { cx, cy, towerR } = ARENA;
  const b = {
    stats,
    t: 0,
    wave: 0,
    phase: 'rest', // rest（次の波まで）/ spawn（出現中）/ clear（倒し切るのを待つ）
    restT: 1.2,
    queue: [],
    spawnT: 0,
    spawnInterval: 0.9,
    tower: { hp: stats.hp, max: stats.hp, flash: 0 },
    enemies: [],
    shots: [],
    fx: [], // 描画・効果音用の一時演出 { id, kind, t, life, ... }（id は増える一方）
    fxId: 0,
    earnedF: 0,
    kills: 0,
    over: false,
    cd: { bullet: 0.2, bomb: 1.2, lightning: 0.8, tap: 0 },
    bladeAngle: 0,
    blades: [],
  };

  const addFx = (o) => {
    o.id = ++b.fxId;
    o.t = 0;
    b.fx.push(o);
  };
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const alive = () => b.enemies.filter((e) => !e.dead);

  function startWave() {
    b.wave++;
    const w = b.wave;
    const n = Math.min(60, 5 + 2 * w);
    b.queue = [];
    for (let i = 0; i < n; i++) {
      const r = rng();
      let type = 'grunt';
      if (w >= 5 && r < 0.14) type = 'tank';
      else if (w >= 3 && r < 0.38) type = 'runner';
      b.queue.push(type);
    }
    b.spawnInterval = Math.max(0.28, 0.9 - 0.02 * w);
    b.spawnT = 0;
    b.phase = 'spawn';
    addFx({ kind: 'wave', life: 1.6, wave: w });
  }

  function spawn(type) {
    const def = TYPES[type];
    const a = rng() * Math.PI * 2;
    const R = 175;
    const hpMul = 1.15 ** (b.wave - 1);
    b.enemies.push({
      type, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R,
      hp: def.hp * hpMul, max: def.hp * hpMul, spd: def.spd * (1 + Math.min(0.5, b.wave * 0.01)),
      dmg: def.dmg * (1 + b.wave * 0.04), r: def.r, pts: def.pts, hit: 0, bladeCd: 0, dead: false,
    });
  }

  function kill(e) {
    e.dead = true;
    b.kills++;
    b.earnedF += e.pts * (1 + stats.pointMul);
    b.tower.hp = Math.min(b.tower.max, b.tower.hp + stats.leech);
    addFx({ kind: 'pop', life: 0.45, x: e.x, y: e.y, r: e.r, type: e.type, kill: true });
  }

  function hurt(e, amount) {
    if (e.dead) return;
    let a = amount;
    const crit = rng() < stats.crit;
    if (crit) a *= 2;
    addFx({ kind: 'dmg', life: 0.75, x: e.x + (rng() - 0.5) * 8, y: e.y - e.r, amount: a, crit });
    e.hp -= a;
    e.hit = 0.1;
    if (e.hp <= 0) kill(e);
  }

  const nearestTo = (x, y, maxD, skip) => {
    let best = null;
    let bd = maxD;
    for (const e of b.enemies) {
      if (e.dead || (skip && skip.includes(e))) continue;
      const d = dist(e.x, e.y, x, y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  };

  function fireBullets() {
    const inRange = alive()
      .map((e) => ({ e, d: dist(e.x, e.y, cx, cy) }))
      .filter((o) => o.d <= stats.range + o.e.r)
      .sort((p, q) => p.d - q.d)
      .slice(0, stats.targets);
    if (!inRange.length) return false;
    for (const { e } of inRange) {
      const a = Math.atan2(e.y - cy, e.x - cx);
      addFx({ kind: 'muzzle', life: 0.12, a });
      b.shots.push({
        x: cx, y: cy, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
        life: (stats.range * 1.4) / BULLET_SPEED, hits: 1 + stats.pierce, dmg: stats.dmg, seen: new Set(),
      });
    }
    return true;
  }

  function fireBomb() {
    const cand = alive().filter((e) => dist(e.x, e.y, cx, cy) <= stats.range * 1.15 + e.r);
    if (!cand.length) return false;
    let best = cand[0];
    let bn = -1;
    for (const e of cand) {
      const n = cand.filter((o) => dist(o.x, o.y, e.x, e.y) <= 30).length;
      if (n > bn) {
        bn = n;
        best = e;
      }
    }
    const x = best.x;
    const y = best.y;
    for (const e of alive()) if (dist(e.x, e.y, x, y) <= 30 + e.r) hurt(e, stats.dmg * 2.2);
    addFx({ kind: 'boom', life: 0.5, x, y, r: 30 });
    return true;
  }

  function fireLightning() {
    let cur = nearestTo(cx, cy, stats.range * 1.1);
    if (!cur) return false;
    const hit = [cur];
    const pts = [{ x: cx, y: cy }, { x: cur.x, y: cur.y }];
    hurt(cur, stats.dmg * 1.5);
    for (let i = 1; i <= 3; i++) {
      const nx = nearestTo(cur.x, cur.y, 48, hit);
      if (!nx) break;
      hurt(nx, stats.dmg * 1.5 * 0.75 ** i);
      hit.push(nx);
      pts.push({ x: nx.x, y: nx.y });
      cur = nx;
    }
    addFx({ kind: 'bolt', life: 0.3, pts });
    return true;
  }

  const speedUp = () => 1 + (stats.rate - 1) * 0.5;

  function step(dt) {
    if (b.over) return;
    b.t += dt;
    b.tower.flash = Math.max(0, b.tower.flash - dt);
    b.cd.tap -= dt;

    // 波の進行
    if (b.phase === 'rest') {
      b.restT -= dt;
      if (b.restT <= 0) startWave();
    } else if (b.phase === 'spawn') {
      b.spawnT -= dt;
      while (b.spawnT <= 0 && b.queue.length) {
        spawn(b.queue.shift());
        b.spawnT += b.spawnInterval;
      }
      if (!b.queue.length) b.phase = 'clear';
    }
    if (b.phase === 'clear' && alive().length === 0) {
      const bonus = (stats.waveBonus + b.wave) * (1 + stats.pointMul);
      b.earnedF += bonus;
      addFx({ kind: 'clear', life: 1.5, bonus: Math.round(bonus) });
      b.phase = 'rest';
      b.restT = 1.4;
    }

    // 敵の移動と接触
    for (const e of b.enemies) {
      if (e.dead) continue;
      e.hit = Math.max(0, e.hit - dt);
      e.bladeCd = Math.max(0, e.bladeCd - dt);
      const d = dist(e.x, e.y, cx, cy);
      const k = d < SLOW_RADIUS ? 1 - stats.slow : 1;
      const mv = (e.spd * k * dt) / Math.max(d, 0.001);
      e.x += (cx - e.x) * mv;
      e.y += (cy - e.y) * mv;
      if (d <= towerR + e.r) {
        b.tower.hp -= e.dmg * (1 - stats.reduce);
        b.tower.flash = 0.15;
        e.dead = true;
        addFx({ kind: 'towerHit', life: 0.4, x: e.x, y: e.y, dmg: e.dmg * (1 - stats.reduce) });
        addFx({ kind: 'pop', life: 0.45, x: e.x, y: e.y, r: e.r, type: e.type, kill: false });
      }
    }

    b.tower.hp = Math.min(b.tower.max, b.tower.hp + stats.regen * dt);
    if (b.tower.hp <= 0) {
      b.tower.hp = 0;
      b.over = true;
      return;
    }

    // 自動攻撃
    b.cd.bullet -= dt;
    if (b.cd.bullet <= 0) {
      if (fireBullets()) b.cd.bullet += 1 / stats.rate;
      else b.cd.bullet = 0;
    }
    if (stats.weapons.bomb) {
      b.cd.bomb -= dt;
      if (b.cd.bomb <= 0) {
        if (fireBomb()) b.cd.bomb += 2.6 / speedUp();
        else b.cd.bomb = 0;
      }
    }
    if (stats.weapons.lightning) {
      b.cd.lightning -= dt;
      if (b.cd.lightning <= 0) {
        if (fireLightning()) b.cd.lightning += 1.7 / speedUp();
        else b.cd.lightning = 0;
      }
    }
    if (stats.weapons.blade) {
      b.bladeAngle += 3.2 * dt;
      b.blades = [0, 1].map((k) => {
        const a = b.bladeAngle + k * Math.PI;
        return { x: cx + Math.cos(a) * BLADE_R, y: cy + Math.sin(a) * BLADE_R };
      });
      for (const e of b.enemies) {
        if (e.dead || e.bladeCd > 0) continue;
        if (b.blades.some((bl) => dist(bl.x, bl.y, e.x, e.y) <= 6 + e.r)) {
          hurt(e, stats.dmg * 0.9);
          e.bladeCd = 0.35;
        }
      }
    }

    // 弾の移動と命中
    for (const s of b.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const e of b.enemies) {
        if (e.dead || s.seen.has(e) || s.hits <= 0) continue;
        if (dist(s.x, s.y, e.x, e.y) <= e.r + 2) {
          hurt(e, s.dmg);
          s.seen.add(e);
          s.hits--;
        }
      }
    }
    b.shots = b.shots.filter((s) => s.life > 0 && s.hits > 0);
    b.enemies = b.enemies.filter((e) => !e.dead);

    for (const f of b.fx) f.t += dt;
    b.fx = b.fx.filter((f) => f.t < f.life);
  }

  // 画面をタップしたときの手動攻撃（タップ位置に近い敵 1 体に追加ダメージ）
  function tap(x, y) {
    if (b.over || b.cd.tap > 0) return false;
    const e = nearestTo(x, y, 40);
    if (!e) return false;
    hurt(e, stats.dmg * 1.6);
    b.cd.tap = 0.4;
    addFx({ kind: 'bolt', life: 0.22, pts: [{ x: cx, y: cy }, { x: e.x, y: e.y }], manual: true });
    return true;
  }

  return { b, step, tap, earned: () => Math.floor(b.earnedF) };
}

// 画面なしで 1 回の挑戦を最後まで進め、到達した波数とポイントを返す（バランス確認用）
export function simulate(stats, rng = Math.random, maxSec = 1800) {
  const sim = createBattle(stats, rng);
  const dt = 1 / 30;
  for (let t = 0; t < maxSec && !sim.b.over; t += dt) sim.step(dt);
  return { wave: sim.b.wave, points: sim.earned(), seconds: sim.b.t, over: sim.b.over };
}
