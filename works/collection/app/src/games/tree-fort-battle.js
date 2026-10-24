// ツリー砦の戦闘ロジック（描画なし）。能力値（tree-fort-data.js の computeStats）と装備した武器（loadout）を渡すと、
// 主砲が自動で撃ち、武器（tree-fort-weapons.js）が加わって、波ごとに敵が押し寄せる。step(dt) で進め、b の状態を描画側が読む。
import { createWeapons } from './tree-fort-weapons.js';

export const ARENA = { W: 240, H: 320, cx: 120, cy: 172, towerR: 11 };

const TYPES = {
  grunt: { hp: 6, spd: 24, dmg: 4, r: 5, pts: 1 },
  runner: { hp: 3.5, spd: 46, dmg: 3, r: 4, pts: 1 },
  tank: { hp: 30, spd: 15, dmg: 12, r: 8, pts: 4 },
};
const BULLET_SPEED = 280;
const SLOW_RADIUS = 75;

// loadout: 装備した武器 [{ id, level }]
export function createBattle(stats, rng = Math.random, loadout = []) {
  const { cx, cy, towerR } = ARENA;
  const b = {
    stats,
    t: 0,
    wave: 0,
    phase: 'rest', // rest（次の波まで）/ spawn（出現中）/ clear（倒し切るのを待つ）
    restT: 1.2,
    queue: [],
    waveTotal: 0, // この波の敵の総数（進み具合の表示用）
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
    cd: { bullet: 0.2, tap: 0 },
    w: null, // 武器の状態（弾・雲・地雷など。描画側が読む）
  };

  const addFx = (o) => {
    o.id = ++b.fxId;
    o.t = 0;
    b.fx.push(o);
  };
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const alive = () => b.enemies.filter((e) => !e.dead);
  let W = null;

  // 状態異常: burn（燃焼）/ poison（毒）/ slow（鈍足）/ freeze（凍結）
  function applyStatus(e, kind, dur, power) {
    if (e.dead) return;
    if (kind === 'burn' || kind === 'poison') {
      const cur = e[kind];
      if (!cur || cur.t <= 0 || power >= cur.dps) e[kind] = { t: Math.max(dur, cur ? cur.t : 0), dps: power };
      else cur.t = Math.max(cur.t, dur);
    } else if (kind === 'slow') {
      e.slow = { t: Math.max(dur, e.slow ? e.slow.t : 0), mul: Math.min(power, e.slow && e.slow.t > 0 ? e.slow.mul : 1) };
    } else if (kind === 'freeze' && !(e.thaw > 0)) {
      e.freeze = Math.max(e.freeze || 0, dur);
    }
  }

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
    b.waveTotal = b.queue.length;
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
      dmg: def.dmg * (1 + b.wave * 0.04), r: def.r, pts: def.pts, hit: 0, bladeCd: 0, dead: false, dotAcc: 0,
      burn: null, poison: null, slow: null, freeze: 0, thaw: 0,
    });
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    b.kills++;
    b.earnedF += e.pts * (1 + stats.pointMul);
    b.tower.hp = Math.min(b.tower.max, b.tower.hp + stats.leech);
    addFx({ kind: 'pop', life: 0.45, x: e.x, y: e.y, r: e.r, type: e.type, kill: true });
    if (W) W.onKill(e);
  }

  // o: { tag（属性）, dot（継続ダメージ）, noCrit, synergy（組み合わせ効果による追加ダメージ）}
  function hurt(e, amount, o = {}) {
    if (e.dead) return;
    let a = W ? W.modify(e, amount, o) : amount;
    const crit = !o.noCrit && !o.dot && rng() < stats.crit;
    if (crit) a *= 2;
    if (!o.dot) addFx({ kind: 'dmg', life: 0.75, x: e.x + (rng() - 0.5) * 8, y: e.y - e.r, amount: a, crit, tag: o.tag });
    e.hp -= a;
    e.hit = 0.1;
    if (W) W.onHit(e, a, o); // 倒れる一撃でも、組み合わせ効果（蒸気爆発など）は起きる
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

  W = createWeapons({ b, stats, rng, ARENA, dist, alive, nearestTo, hurt, addFx, applyStatus }, loadout);

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

  // 状態異常を進める（継続ダメージは少しまとめてから与える）
  function tickStatus(e, dt) {
    e.hit = Math.max(0, e.hit - dt);
    e.bladeCd = Math.max(0, e.bladeCd - dt);
    let dps = 0;
    if (e.burn && e.burn.t > 0) {
      e.burn.t -= dt;
      dps += e.burn.dps;
    }
    if (e.poison && e.poison.t > 0) {
      e.poison.t -= dt;
      dps += e.poison.dps;
    }
    if (e.slow && e.slow.t > 0) e.slow.t -= dt;
    if (e.freeze > 0) {
      e.freeze -= dt;
      if (e.freeze <= 0) e.thaw = 1.5; // 凍結の連続は少し効きにくくする
    } else if (e.thaw > 0) e.thaw -= dt;
    e.dotAcc += dps * dt;
    if (e.dotAcc >= 0.8) {
      const amt = e.dotAcc;
      e.dotAcc = 0;
      hurt(e, amt, { tag: 'burn', dot: true, noCrit: true });
    }
  }

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
      tickStatus(e, dt);
      if (e.dead) continue;
      const d = dist(e.x, e.y, cx, cy);
      const aura = d < SLOW_RADIUS ? 1 - stats.slow : 1;
      const fz = e.freeze > 0 ? 0 : 1;
      const sl = e.slow && e.slow.t > 0 ? e.slow.mul : 1;
      const mv = (e.spd * aura * fz * sl * dt) / Math.max(d, 0.001);
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

    // 主砲
    b.cd.bullet -= dt;
    if (b.cd.bullet <= 0) {
      if (fireBullets()) b.cd.bullet += 1 / stats.rate;
      else b.cd.bullet = 0;
    }
    // 装備した武器
    W.update(dt);

    // 主砲の弾の移動と命中
    for (const s of b.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      for (const e of b.enemies) {
        if (e.dead || s.seen.has(e) || s.hits <= 0) continue;
        if (dist(s.x, s.y, e.x, e.y) <= e.r + 2) {
          hurt(e, s.dmg, { tag: 'physical' });
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
    hurt(e, stats.dmg * 1.6, { tag: 'physical' });
    b.cd.tap = 0.4;
    addFx({ kind: 'bolt', life: 0.22, pts: [{ x: cx, y: cy }, { x: e.x, y: e.y }], manual: true });
    return true;
  }

  // この波で、あと何体か（まだ出てきていない敵 + いま画面にいる敵）
  const remaining = () => b.queue.length + b.enemies.filter((e) => !e.dead).length;

  return { b, step, tap, remaining, earned: () => Math.floor(b.earnedF) };
}

// 画面なしで 1 回の挑戦を最後まで進め、到達した波数とポイントを返す（バランス確認用）
export function simulate(stats, rng = Math.random, loadout = [], maxSec = 1800) {
  const sim = createBattle(stats, rng, loadout);
  const dt = 1 / 30;
  for (let t = 0; t < maxSec && !sim.b.over; t += dt) sim.step(dt);
  return { wave: sim.b.wave, points: sim.earned(), seconds: sim.b.t, over: sim.b.over, syn: [...sim.b.w.syn] };
}
