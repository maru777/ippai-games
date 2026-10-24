// ツリー砦の戦闘ロジック（描画なし）。能力値（tree-fort-data.js の computeStats）を渡すと、
// 主砲が自動で撃ち、武器（tree-fort-weapons.js）が加わって、波ごとに敵が押し寄せる。step(dt) で進め、b の状態を描画側が読む。
//   ステージ制: stage 1〜10 は「10 波 + 最後にボス」。stage 0 は終わりのない挑戦（無限）。
//   ローグライト: opts.leveling が true なら、敵を倒して経験値がたまり、レベルアップごとに選択肢（b.options）が出る。
//                 選ぶまで戦闘は止まる（pick(i) / reroll()）。武器と強化は、その挑戦の間だけ。
import { createWeapons } from './tree-fort-weapons.js';
import { makeOptions, applyOption, xpNeed, autoPick } from './tree-fort-run.js';

export const ARENA = { W: 240, H: 320, cx: 120, cy: 172, towerR: 11 };
export const STAGE_WAVES = 10;
export const STAGE_COUNT = 10;
export const GSTEP = 3.4; // ステージが 1 つ進むごとの難しさ（無限モードの波に換算）
const GW = 0.9; // ステージ内の 1 波あたりの難しさ

// 敵の種類。from = この難しさから登場、w = 出やすさ、armor/shield/phase などが特徴
export const TYPES = {
  grunt: { hp: 6, spd: 24, dmg: 4, r: 5, pts: 1, from: 0, w: 40 },
  runner: { hp: 3.5, spd: 46, dmg: 3, r: 4, pts: 1, from: 3, w: 20 },
  swarm: { hp: 2.2, spd: 34, dmg: 1.5, r: 3, pts: 0.5, from: 4, w: 10, group: 5 },
  tank: { hp: 30, spd: 15, dmg: 12, r: 8, pts: 4, from: 5, w: 12 },
  splitter: { hp: 12, spd: 20, dmg: 5, r: 6.5, pts: 2, from: 7, w: 9 },
  armor: { hp: 22, spd: 17, dmg: 9, r: 7, pts: 3, from: 9, w: 8, armor: 2.5 },
  shooter: { hp: 10, spd: 22, dmg: 3.5, r: 5.5, pts: 3, from: 11, w: 7, range: 80, shoot: 2.4 },
  healer: { hp: 14, spd: 19, dmg: 4, r: 6, pts: 3, from: 13, w: 5, heal: 0.07 },
  shield: { hp: 16, spd: 20, dmg: 6, r: 6.5, pts: 3, from: 15, w: 6, shield: 0.9 },
  phantom: { hp: 12, spd: 30, dmg: 6, r: 5.5, pts: 3, from: 18, w: 5, phase: true },
  boss: { hp: 320, spd: 11, dmg: 40, r: 15, pts: 40, from: 999, w: 0 },
};
export const ENEMY_NAME = {
  grunt: 'ザコ', runner: '疾走', swarm: '小群', tank: '重装', splitter: '分裂体', armor: '装甲兵', shooter: '射手', healer: '癒し手', shield: '障壁兵', phantom: '幽霊', boss: 'ボス',
};

const BULLET_SPEED = 280;
const SLOW_RADIUS = 75;

// opts: { loadout: [{ id, level }], stage: 0〜10, leveling: bool, slots: 武器の最大数, discovered: Set（見つけた武器） }
// 配列を渡したときは、loadout だけを指定したものとして扱う（テスト用の古い呼び方）。
export function createBattle(stats0, rng = Math.random, opts = {}) {
  const o = Array.isArray(opts) ? { loadout: opts } : opts;
  const stats = { ...stats0, weapons: { ...stats0.weapons } }; // 挑戦中に強化されるので、複製して使う
  const loadout = (o.loadout || []).map((w) => ({ ...w }));
  const { cx, cy, towerR } = ARENA;
  const b = {
    stats,
    stage: o.stage || 0,
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
    eshots: [], // 敵（射手）の弾
    fx: [], // 描画・効果音用の一時演出 { id, kind, t, life, ... }（id は増える一方）
    fxId: 0,
    earnedF: 0,
    kills: 0,
    over: false,
    cleared: false, // ステージをクリアした
    cd: { bullet: 0.2, tap: 0 },
    w: null, // 武器の状態（弾・雲・地雷など。描画側が読む）
    // ローグライト
    leveling: !!o.leveling,
    level: 1,
    xp: 0,
    xpNeed: xpNeed(1, stats.xpMul),
    pending: 0, // 選択待ちのレベルアップ数
    options: null, // いま出ている選択肢（あれば戦闘は止まる）
    rerolls: Math.floor(stats.rerolls),
    discovered: o.discovered || new Set(),
    found: [], // この挑戦で新しく見つけた武器
    loadout,
    boss: null,
  };

  const addFx = (x) => {
    x.id = ++b.fxId;
    x.t = 0;
    b.fx.push(x);
  };
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const alive = () => b.enemies.filter((e) => !e.dead && !e.phased); // 狙える敵（幽霊の透明な間は除く）
  let W = null;

  // 難しさ（無限モードの「波」に換算した値）
  const eff = () => (b.stage > 0 ? (b.stage - 1) * GSTEP + b.wave * GW + 0.1 : b.wave);

  // 状態異常: burn（燃焼）/ poison（毒）/ slow（鈍足）/ freeze（凍結）
  function applyStatus(e, kind, dur, power) {
    if (e.dead) return;
    if (kind === 'burn' || kind === 'poison') {
      const cur = e[kind];
      if (!cur || cur.t <= 0 || power >= cur.dps) e[kind] = { t: Math.max(dur, cur ? cur.t : 0), dps: power };
      else cur.t = Math.max(cur.t, dur);
    } else if (kind === 'slow') {
      e.slow = { t: Math.max(dur, e.slow ? e.slow.t : 0), mul: Math.min(power, e.slow && e.slow.t > 0 ? e.slow.mul : 1) };
    } else if (kind === 'freeze' && !(e.thaw > 0) && e.type !== 'boss') {
      e.freeze = Math.max(e.freeze || 0, dur);
    }
  }

  // ---- 敵の出現 ----
  function pickType(g) {
    const list = Object.entries(TYPES).filter(([, t]) => t.w > 0 && g >= t.from);
    const total = list.reduce((a, [, t]) => a + t.w, 0);
    let r = rng() * total;
    for (const [k, t] of list) {
      r -= t.w;
      if (r <= 0) return k;
    }
    return list[0][0];
  }

  function startWave() {
    b.wave++;
    const g = eff();
    const n = Math.min(60, 5 + 2 * Math.floor(g));
    b.queue = [];
    const bossWave = b.stage > 0 && b.wave >= STAGE_WAVES;
    if (bossWave) b.queue.push('boss');
    const units = bossWave ? Math.max(6, Math.floor(n * 0.5)) : n;
    while (b.queue.length < units + (bossWave ? 1 : 0)) {
      const type = pickType(g);
      const grp = TYPES[type].group || 1;
      for (let i = 0; i < grp; i++) b.queue.push(type);
    }
    b.waveTotal = b.queue.length;
    b.spawnInterval = Math.max(0.28, 0.9 - 0.02 * g);
    b.spawnT = 0;
    b.phase = 'spawn';
    addFx({ kind: 'wave', life: 1.6, wave: b.wave, boss: bossWave, stage: b.stage });
  }

  function makeEnemy(type, x, y, g) {
    const def = TYPES[type];
    const hpMul = 1.15 ** (g - 1);
    const e = {
      type, x, y, hp: def.hp * hpMul, max: def.hp * hpMul, spd: def.spd * (1 + Math.min(0.5, g * 0.01)),
      dmg: def.dmg * (1 + g * 0.04), r: def.r, pts: def.pts, hit: 0, bladeCd: 0, dead: false, dotAcc: 0,
      burn: null, poison: null, slow: null, freeze: 0, thaw: 0, armor: def.armor || 0,
      shootT: def.shoot ? def.shoot * (0.5 + rng()) : 0, phaseT: rng() * 3.4, phased: false, shield: 0, shieldMax: 0, shieldT: 0,
      summonT: type === 'boss' ? 4 : 0,
    };
    if (def.shield) {
      e.shieldMax = e.max * def.shield;
      e.shield = e.shieldMax;
    }
    return e;
  }

  function spawn(type) {
    const a = rng() * Math.PI * 2;
    const R = 175;
    const e = makeEnemy(type, cx + Math.cos(a) * R, cy + Math.sin(a) * R, eff());
    b.enemies.push(e);
    if (type === 'boss') {
      b.boss = e;
      addFx({ kind: 'bossIn', life: 1.6 });
    }
  }

  // ---- 経験値とレベルアップ ----
  const runCtx = () => ({
    rng, stats, loadout, slots: o.slots || 3, discovered: b.discovered, g: eff(), tower: b.tower, count: Math.floor(stats.choices),
  });
  function offer() {
    if (b.pending > 0 && !b.options) b.options = makeOptions(runCtx());
  }
  function gainXp(v) {
    if (!b.leveling) return;
    b.xp += v * stats.xpMul;
    while (b.xp >= b.xpNeed) {
      b.xp -= b.xpNeed;
      b.level++;
      b.xpNeed = xpNeed(b.level, stats.xpMul);
      b.pending++;
      addFx({ kind: 'levelup', life: 1.2, level: b.level });
    }
    offer();
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true;
    b.kills++;
    b.earnedF += e.pts * (1 + stats.pointMul);
    b.tower.hp = Math.min(b.tower.max, b.tower.hp + stats.leech);
    addFx({ kind: 'pop', life: 0.45, x: e.x, y: e.y, r: e.r, type: e.type, kill: true });
    if (W) W.onKill(e);
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const a = rng() * Math.PI * 2;
        b.enemies.push(makeEnemy('swarm', e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6, eff()));
      }
      addFx({ kind: 'split', life: 0.4, x: e.x, y: e.y });
    }
    if (e.type === 'boss') addFx({ kind: 'bossDown', life: 1.4, x: e.x, y: e.y });
    gainXp(e.pts);
  }

  // op: { tag（属性）, dot（継続ダメージ）, noCrit, synergy（組み合わせ効果による追加ダメージ）}
  function hurt(e, amount, op = {}) {
    if (e.dead || e.phased) return;
    let a = W ? W.modify(e, amount, op) : amount;
    const crit = !op.noCrit && !op.dot && rng() < stats.crit;
    if (crit) a *= 2;
    if (e.armor) a = Math.max(a * 0.2, a - e.armor); // 装甲: 小さなダメージを大きく減らす
    if (e.shield > 0) {
      const ab = Math.min(e.shield, a);
      e.shield -= ab;
      e.shieldT = 0;
      a -= ab;
    }
    if (!op.dot) addFx({ kind: 'dmg', life: 0.75, x: e.x + (rng() - 0.5) * 8, y: e.y - e.r, amount: a, crit, tag: op.tag });
    e.hp -= a;
    e.hit = 0.1;
    if (W) W.onHit(e, a, op); // 倒れる一撃でも、組み合わせ効果（蒸気爆発など）は起きる
    if (e.hp <= 0) kill(e);
  }

  const nearestTo = (x, y, maxD, skip) => {
    let best = null;
    let bd = maxD;
    for (const e of b.enemies) {
      if (e.dead || e.phased || (skip && skip.includes(e))) continue;
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
      .filter((q) => q.d <= stats.range + q.e.r)
      .sort((p, q) => p.d - q.d)
      .slice(0, stats.targets);
    if (!inRange.length) return false;
    for (const { e } of inRange) {
      const a = Math.atan2(e.y - cy, e.x - cx);
      addFx({ kind: 'muzzle', life: 0.12, a });
      b.shots.push({
        x: cx, y: cy, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
        life: (stats.range * 1.4) / BULLET_SPEED, hits: 1 + stats.pierce, dmg: stats.dmg, seen: new Set(),
        lance: stats.pierce > 0, passes: 0, // 貫通弾（見た目を槍にする）と、貫いた回数
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
    // 敵の特徴
    if (TYPES[e.type].phase) {
      e.phaseT += dt;
      e.phased = e.phaseT % 3.4 < 1.1; // 幽霊: 周期的に透明になり、攻撃がすり抜ける
    }
    if (e.shieldMax) {
      e.shieldT += dt;
      if (e.shieldT > 3 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.15 * dt);
    }
  }

  function step(dt) {
    if (b.over || b.options) return; // レベルアップの選択中は止まる
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
    if (b.phase === 'clear' && b.enemies.every((e) => e.dead)) {
      const bonus = (stats.waveBonus + b.wave) * (1 + stats.pointMul);
      b.earnedF += bonus;
      addFx({ kind: 'clear', life: 1.5, bonus: Math.round(bonus) });
      if (b.stage > 0 && b.wave >= STAGE_WAVES) {
        const sb = 40 * b.stage * (1 + stats.pointMul);
        b.earnedF += sb;
        b.cleared = true;
        b.over = true;
        addFx({ kind: 'stageClear', life: 2, bonus: Math.round(sb) });
        return;
      }
      b.phase = 'rest';
      b.restT = 1.4;
    }

    // 敵の移動・特徴・接触
    for (const e of b.enemies) {
      if (e.dead) continue;
      tickStatus(e, dt);
      if (e.dead) continue;
      const def = TYPES[e.type];
      const d = dist(e.x, e.y, cx, cy);
      // 癒し手: 近くの味方を回復する
      if (def.heal) {
        for (const n of b.enemies) if (n !== e && !n.dead && dist(n.x, n.y, e.x, e.y) <= 46) n.hp = Math.min(n.max, n.hp + n.max * def.heal * dt);
      }
      // ボス: 一定間隔で手下を呼ぶ
      if (e.type === 'boss') {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 5;
          for (let i = 0; i < 3; i++) {
            const a = rng() * Math.PI * 2;
            b.enemies.push(makeEnemy('grunt', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, eff()));
          }
          addFx({ kind: 'summon', life: 0.6, x: e.x, y: e.y });
        }
      }
      // 射手: 射程に入ったら止まって、砦を撃つ
      let moving = true;
      if (def.range && d <= def.range) {
        moving = false;
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = def.shoot;
          const a = Math.atan2(cy - e.y, cx - e.x);
          b.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, dmg: e.dmg, life: 3 });
          addFx({ kind: 'eshoot', life: 0.2, x: e.x, y: e.y });
        }
      }
      if (moving) {
        const aura = d < SLOW_RADIUS ? 1 - stats.slow : 1;
        const fz = e.freeze > 0 ? 0 : 1;
        const sl = e.slow && e.slow.t > 0 ? e.slow.mul : 1;
        const mv = (e.spd * aura * fz * sl * dt) / Math.max(d, 0.001);
        e.x += (cx - e.x) * mv;
        e.y += (cy - e.y) * mv;
      }
      if (d <= towerR + e.r) {
        const dmg = e.dmg * (1 - stats.reduce);
        b.tower.hp -= dmg;
        b.tower.flash = 0.15;
        addFx({ kind: 'towerHit', life: 0.4, x: e.x, y: e.y, dmg });
        if (e.type !== 'boss') {
          e.dead = true;
          addFx({ kind: 'pop', life: 0.45, x: e.x, y: e.y, r: e.r, type: e.type, kill: false });
        } else {
          // ボスは触れても倒れず、体当たりのあと少し押し戻される
          e.x -= (cx - e.x) * 0.9;
          e.y -= (cy - e.y) * 0.9;
        }
      }
    }

    // 敵の弾
    for (const s of b.eshots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (dist(s.x, s.y, cx, cy) <= towerR + 2) {
        const dmg = s.dmg * (1 - stats.reduce);
        b.tower.hp -= dmg;
        b.tower.flash = 0.15;
        addFx({ kind: 'towerHit', life: 0.4, x: s.x, y: s.y, dmg });
        s.life = 0;
      }
    }
    b.eshots = b.eshots.filter((s) => s.life > 0);

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
        if (e.dead || e.phased || s.seen.has(e) || s.hits <= 0) continue;
        if (dist(s.x, s.y, e.x, e.y) <= e.r + 2) {
          hurt(e, s.dmg, { tag: 'physical' });
          s.seen.add(e);
          s.hits--;
          if (s.lance && s.hits > 0) {
            s.passes++;
            addFx({ kind: 'pierce', life: 0.4, x: e.x, y: e.y, a: Math.atan2(s.vy, s.vx), n: s.passes });
          }
        }
      }
    }
    b.shots = b.shots.filter((s) => s.life > 0 && s.hits > 0);
    b.enemies = b.enemies.filter((e) => !e.dead);
    if (b.boss && b.boss.dead) b.boss = null;

    for (const f of b.fx) f.t += dt;
    b.fx = b.fx.filter((f) => f.t < f.life);
  }

  // 画面をタップしたときの手動攻撃（タップ位置に近い敵 1 体に追加ダメージ）
  function tap(x, y) {
    if (b.over || b.options || b.cd.tap > 0) return false;
    const e = nearestTo(x, y, 40);
    if (!e) return false;
    hurt(e, stats.dmg * 1.6, { tag: 'physical' });
    b.cd.tap = 0.4;
    addFx({ kind: 'bolt', life: 0.22, pts: [{ x: cx, y: cy }, { x: e.x, y: e.y }], manual: true });
    return true;
  }

  // レベルアップの選択（i 番目）と、選び直し
  function pick(i) {
    const opt = b.options && b.options[i];
    if (!opt) return null;
    applyOption({ stats, loadout, discovered: b.discovered, tower: b.tower, refresh: () => W.refresh(), found: b.found }, opt);
    if (opt.kind === 'weapon-new') addFx({ kind: 'gotWeapon', life: 1.2, wid: opt.id, name: opt.name, unknown: !!opt.unknown });
    b.pending--;
    b.options = null;
    offer();
    return opt;
  }
  function reroll() {
    if (!b.options || b.rerolls <= 0) return false;
    b.rerolls--;
    b.options = makeOptions(runCtx());
    return true;
  }

  // この波で、あと何体か（まだ出てきていない敵 + いま画面にいる敵）
  const remaining = () => b.queue.length + b.enemies.filter((e) => !e.dead).length;

  if (b.leveling && stats.startPicks > 0) {
    b.pending = Math.floor(stats.startPicks);
    offer();
  }

  return { b, step, tap, pick, reroll, remaining, earned: () => Math.floor(b.earnedF) };
}

// 画面なしで 1 回の挑戦を最後まで進める（バランス確認用）。レベルアップは autoPick が代わりに選ぶ。
export function simulate(stats, rng = Math.random, opts = [], maxSec = 1800) {
  const o = Array.isArray(opts) ? { loadout: opts } : opts;
  const sim = createBattle(stats, rng, o);
  const dt = 1 / 30;
  for (let t = 0; t < maxSec && !sim.b.over; t += dt) {
    while (sim.b.options) sim.pick(autoPick(sim.b.options));
    sim.step(dt);
  }
  return {
    wave: sim.b.wave, points: sim.earned(), seconds: sim.b.t, over: sim.b.over, cleared: sim.b.cleared, level: sim.b.level,
    syn: [...sim.b.w.syn], loadout: sim.b.loadout.map((w) => `${w.id}${w.level}`),
  };
}
