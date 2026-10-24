// ツリー砦の武器: データ（12 種・各 Lv1〜5・組み合わせ効果）と、戦闘中の動き。
// 武器の追加は WEAPONS に 1 件足し、下の upd に動きを書く。組み合わせ効果は SYNERGIES に足す。
// 戦闘本体（tree-fort-battle.js）は api（敵・ダメージ・演出の道具）を渡して createWeapons を呼ぶだけ。
export const SLOT_BASE = 3;
export const SLOT_MAX = 6;
export const SLOT_COST = { 4: 120, 5: 300, 6: 600 };
export const MAX_LEVEL = 5;

// cost[i] = Lv(i+1) にするための費用。levels[i] = Lv(i+1) の効果の説明。
export const WEAPONS = [
  {
    id: 'bomb', name: '爆弾', tags: ['fire'], color: '#ff9a3c', desc: '敵の群れに爆発を撃ち込む',
    cost: [100, 70, 120, 200, 320],
    levels: ['爆発（範囲 小）', '威力 +、範囲 +', '2 連続で爆発', '威力・範囲 ++', '子爆弾が飛び散る'],
  },
  {
    id: 'lightning', name: '雷撃', tags: ['lightning'], color: '#7fd6ff', desc: '敵から敵へ連鎖する雷',
    cost: [100, 70, 120, 200, 320],
    levels: ['3 体に連鎖', '威力 +', '連鎖 +1', '威力 ++', 'さらに 3 か所へ落雷'],
  },
  {
    id: 'blade', name: '回転刃', tags: ['physical'], color: '#e8f0ff', desc: '砦の周りを回って近づく敵を斬る',
    cost: [90, 60, 110, 180, 300],
    levels: ['刃 2 枚', '威力・速度 +', '刃 3 枚', '威力 ++', '刃 4 枚＋衝撃波'],
  },
  {
    id: 'flame', name: '火炎放射', tags: ['fire'], color: '#ff6a2a', desc: '近距離の扇形に炎を吹き、敵を燃やす',
    cost: [120, 80, 130, 210, 340],
    levels: ['扇形の炎＋燃焼', '威力 +', '範囲が広がる', '燃焼ダメージ ++', '倒すと周囲に燃え移る'],
  },
  {
    id: 'frost', name: '氷結弾', tags: ['ice'], color: '#9fe8ff', desc: '命中した敵を遅くし、凍らせる',
    cost: [120, 80, 130, 210, 340],
    levels: ['鈍足＋凍結(小)', '凍結しやすい', '周囲も鈍足に', '凍結しやすい ++', '凍結が長く、周囲も凍る'],
  },
  {
    id: 'poison', name: '毒霧', tags: ['poison'], color: '#8dff6a', desc: '地面に残る毒の雲で、継続ダメージ',
    cost: [130, 80, 140, 220, 360],
    levels: ['毒の雲を 1 つ', '雲が広く・長く', '雲を 2 つ', '毒ダメージ ++', '雲が敵を追いかける'],
  },
  {
    id: 'missile', name: 'ミサイル', tags: ['fire', 'physical'], color: '#ffd84a', desc: '追尾するミサイルを一斉に撃つ',
    cost: [140, 90, 150, 240, 380],
    levels: ['2 発', '威力 +', '4 発', '威力 ++', '6 発＋大きな爆発'],
  },
  {
    id: 'laser', name: 'レーザー', tags: ['light'], color: '#fff2a0', desc: '一直線に貫く光線',
    cost: [150, 100, 160, 260, 400],
    levels: ['光線 1 本', '威力 +', '光線 2 本', '威力 ++', '長く照射（威力 1.5 倍）'],
  },
  {
    id: 'mine', name: '地雷', tags: ['physical'], color: '#c9a36a', desc: '敵の通り道に仕掛け、踏むと爆発',
    cost: [130, 80, 140, 220, 360],
    levels: ['地雷を仕掛ける', '威力・範囲 +', '一度に 2 個', '威力 ++', '連鎖して爆発'],
  },
  {
    id: 'gravity', name: '重力井戸', tags: ['gravity'], color: '#b48cff', desc: '敵を中心へ引き寄せ、固めてダメージ',
    cost: [160, 100, 170, 270, 420],
    levels: ['引き寄せる井戸', '範囲 +', '範囲 ++', '引力 ++', '最後に崩壊して大ダメージ'],
  },
  {
    id: 'meteor', name: '流星', tags: ['fire'], color: '#ff8a5a', desc: '空から大きな隕石を降らせる',
    cost: [170, 110, 180, 290, 450],
    levels: ['隕石 1 発', '威力 +', '同時に 2 発', '威力 ++', '同時に 3 発'],
  },
  {
    id: 'drone', name: 'ドローン', tags: ['machine'], color: '#7affc8', desc: '砦に付き添って自動で撃つ小型機',
    cost: [150, 90, 150, 240, 380],
    levels: ['1 機', '2 機', '威力 +', '3 機', '二連射'],
  },
];
export const WEAPON = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// 組み合わせ効果。needs の各項目は武器 id か 'tag:属性'。両方が装備されていると発動する。
export const SYNERGIES = [
  { id: 'steam', name: '蒸気爆発', needs: ['tag:fire', 'frost'], desc: '炎が凍った（鈍足の）敵に当たると、周囲を巻き込む蒸気の爆発' },
  { id: 'shatter', name: '感電粉砕', needs: ['frost', 'lightning'], desc: '凍った敵への雷ダメージが 2 倍' },
  { id: 'toxic', name: '毒ガス引火', needs: ['poison', 'tag:fire'], desc: '毒に侵された敵に炎が当たると、毒ガスが爆発' },
  { id: 'compress', name: '圧縮爆発', needs: ['gravity', 'bomb'], desc: '爆弾の威力 +60%・範囲 +40%' },
  { id: 'vortex', name: '毒の渦', needs: ['gravity', 'poison'], desc: '毒の雲のダメージ +60%、雲が重力井戸に吸い寄せられる' },
  { id: 'lure', name: '誘導地雷', needs: ['mine', 'gravity'], desc: '地雷が敵を引き寄せ、爆発が大きくなる' },
  { id: 'dlink-l', name: 'ドローン雷', needs: ['drone', 'lightning'], desc: 'ドローンが連鎖する雷を撃つ' },
  { id: 'dlink-f', name: 'ドローン氷', needs: ['drone', 'frost'], desc: 'ドローンの弾が敵を遅くする' },
  { id: 'dlink-b', name: 'ドローン光', needs: ['drone', 'laser'], desc: 'ドローンの弾が敵を貫通する' },
  { id: 'prism', name: 'プリズム', needs: ['laser', 'frost'], desc: 'レーザーが屈折して 3 本に分かれる' },
  { id: 'burnland', name: '燃える大地', needs: ['meteor', 'flame'], desc: '隕石の落下点が燃え続ける' },
];
export const SYNERGY = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));

const matches = (need, ids) => (need.startsWith('tag:')
  ? [...ids].some((i) => WEAPON[i] && WEAPON[i].tags.includes(need.slice(4)))
  : ids.has(need));

// 装備している武器 id の集合から、発動している組み合わせ効果の id の集合を返す
export function activeSynergies(ids) {
  const set = ids instanceof Set ? ids : new Set(ids);
  return new Set(SYNERGIES.filter((s) => s.needs.every((n) => matches(n, set))).map((s) => s.id));
}

// Lv(level) にするための費用（level は 1〜5）
export const weaponCost = (id, level) => WEAPON[id].cost[level - 1];

// ---------------------------------------------------------------------------------------------
// 戦闘中の動き。api は battle から渡される道具、loadout は [{ id, level }]。
export function createWeapons(api, loadout) {
  const { b, stats, rng, ARENA, dist, alive, nearestTo, hurt, addFx, applyStatus } = api;
  const { cx, cy } = ARENA;
  let syn = activeSynergies(new Set(loadout.map((w) => w.id)));
  const lvOf = (id) => loadout.find((w) => w.id === id)?.level || 0;
  const D = () => stats.dmg;
  const speedUp = () => 1 + (stats.rate - 1) * 0.5;

  // 見た目用の状態（描画側が読む）
  const w = {
    proj: [], zones: [], beams: [], mines: [], wells: [], meteors: [], drones: [], blades: [], flames: [],
    syn, loadout, later: [],
  };
  b.w = w;
  const cd = {};
  for (const x of loadout) cd[x.id] = 0.6 + rng() * 0.6;
  const later = (t, fn) => w.later.push({ t, fn });
  let lastSynText = -9;
  const synText = (id, x, y) => {
    if (b.t - lastSynText < 0.7) return;
    lastSynText = b.t;
    addFx({ kind: 'syn', life: 1.0, syn: id, name: SYNERGY[id].name, x, y }); // id は addFx が通し番号に使うので syn に入れる
  };

  // 範囲ダメージ（爆発）
  function explode(x, y, r, dmg, tag, o = {}) {
    for (const e of alive()) if (dist(e.x, e.y, x, y) <= r + e.r) hurt(e, dmg, { tag, ...o });
    addFx({ kind: 'boom', life: 0.5, x, y, r, tag });
  }

  // 一番敵が集まっている場所（範囲内の敵の中心から、まわりの敵が多い敵）
  function densest(maxD, rad) {
    const c = alive().filter((e) => dist(e.x, e.y, cx, cy) <= maxD + e.r);
    let best = null;
    let bn = -1;
    for (const e of c) {
      const n = c.filter((o) => dist(o.x, o.y, e.x, e.y) <= rad).length;
      if (n > bn) {
        bn = n;
        best = e;
      }
    }
    return best;
  }

  const inRange = (r) => alive().filter((e) => dist(e.x, e.y, cx, cy) <= r + e.r);
  const nearest = (r) => nearestTo(cx, cy, r);

  // ---- 各武器 ----
  const upd = {
    bomb(dt, L) {
      if ((cd.bomb -= dt) > 0) return;
      const t = densest(stats.range * 1.15, 30);
      if (!t) {
        cd.bomb = 0;
        return;
      }
      const k = syn.has('compress') ? 1.4 : 1;
      const r = (30 + 4 * (L - 1)) * k;
      const dmg = D() * (2.2 + 0.35 * (L - 1)) * (syn.has('compress') ? 1.6 : 1);
      const { x, y } = t;
      explode(x, y, r, dmg, 'fire');
      if (syn.has('compress')) synText('compress', x, y);
      if (L >= 3) later(0.35, () => explode(x, y, r, dmg * 0.6, 'fire'));
      if (L >= 5) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          later(0.2 + i * 0.07, () => explode(x + Math.cos(a) * 26, y + Math.sin(a) * 26, 18, dmg * 0.5, 'fire'));
        }
      }
      cd.bomb += (2.6 - 0.2 * (L - 1)) / speedUp();
    },

    lightning(dt, L) {
      if ((cd.lightning -= dt) > 0) return;
      let cur = nearest(stats.range * 1.1);
      if (!cur) {
        cd.lightning = 0;
        return;
      }
      const hit = [cur];
      const pts = [{ x: cx, y: cy }, { x: cur.x, y: cur.y }];
      const base = D() * (1.5 + 0.2 * (L - 1));
      hurt(cur, base, { tag: 'lightning' });
      const chains = 3 + Math.floor(L / 2);
      for (let i = 1; i <= chains; i++) {
        const nx = nearestTo(cur.x, cur.y, 48, hit);
        if (!nx) break;
        hurt(nx, base * 0.75 ** i, { tag: 'lightning' });
        hit.push(nx);
        pts.push({ x: nx.x, y: nx.y });
        cur = nx;
      }
      addFx({ kind: 'bolt', life: 0.3, pts });
      if (L >= 5) {
        const pool = inRange(stats.range * 1.1).filter((e) => !hit.includes(e));
        for (let i = 0; i < 3 && pool.length; i++) {
          const e = pool.splice(Math.floor(rng() * pool.length), 1)[0];
          hurt(e, D() * 1.2, { tag: 'lightning' });
          addFx({ kind: 'bolt', life: 0.25, pts: [{ x: e.x + 6, y: e.y - 70 }, { x: e.x, y: e.y }] });
        }
      }
      cd.lightning += (1.7 - 0.1 * (L - 1)) / speedUp();
    },

    blade(dt, L) {
      const n = L >= 5 ? 4 : L >= 3 ? 3 : 2;
      const R = 34 + 6 * (L - 1);
      w.angle = (w.angle || 0) + (3.2 + 0.2 * L) * dt;
      w.blades = Array.from({ length: n }, (_, k) => {
        const a = w.angle + (k * Math.PI * 2) / n;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
      });
      const dmg = D() * (0.9 + 0.22 * (L - 1));
      for (const e of alive()) {
        if (e.bladeCd > 0) continue;
        if (w.blades.some((bl) => dist(bl.x, bl.y, e.x, e.y) <= 8 + e.r)) {
          hurt(e, dmg, { tag: 'physical' });
          e.bladeCd = 0.35;
        }
      }
      if (L >= 5) {
        cd.blade = (cd.blade ?? 2.5) - dt;
        if (cd.blade <= 0) {
          cd.blade += 2.5;
          for (const e of alive()) if (dist(e.x, e.y, cx, cy) <= 56 + e.r) hurt(e, D() * 1.8, { tag: 'physical' });
          addFx({ kind: 'ring', life: 0.4, x: cx, y: cy, r: 56, tag: 'physical' });
        }
      }
    },

    flame(dt, L) {
      if ((cd.flame -= dt) > 0) return;
      const range = 46 + 4 * (L - 1);
      const t = nearest(range + 14);
      if (!t) {
        cd.flame = 0;
        return;
      }
      const a = Math.atan2(t.y - cy, t.x - cx);
      const half = 0.5 + (L >= 3 ? 0.15 : 0);
      for (const e of alive()) {
        const d = dist(e.x, e.y, cx, cy);
        if (d > range + e.r) continue;
        let da = Math.atan2(e.y - cy, e.x - cx) - a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > half) continue;
        hurt(e, D() * (0.9 + 0.12 * (L - 1)), { tag: 'fire' });
        applyStatus(e, 'burn', 2.5, D() * 0.5 * (1 + 0.25 * (L - 1)) * (L >= 4 ? 1.3 : 1));
      }
      w.flames.push({ a, range, half, t: 0, life: 0.3 });
      cd.flame += (0.9 - 0.05 * L) / speedUp();
    },

    frost(dt, L) {
      if ((cd.frost -= dt) > 0) return;
      const t = nearest(stats.range);
      if (!t) {
        cd.frost = 0;
        return;
      }
      const a = Math.atan2(t.y - cy, t.x - cx);
      w.proj.push({ kind: 'frost', x: cx, y: cy, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 1.2, L, dmg: D() * 0.8, t: 0 });
      cd.frost += (1.4 - 0.1 * L) / speedUp();
    },

    poison(dt, L) {
      if ((cd.poison -= dt) > 0) return;
      const t = densest(stats.range * 1.1, 34);
      if (!t) {
        cd.poison = 0;
        return;
      }
      const make = (x, y) => w.zones.push({
        kind: 'poison', x, y, r: 30 + 3 * L, life: 4 + 0.5 * L, t: 0, dps: D() * 0.7 * (1 + 0.2 * (L - 1)) * (L >= 4 ? 1.2 : 1), drift: L >= 5,
      });
      make(t.x, t.y);
      if (L >= 3) {
        const o = alive().filter((e) => dist(e.x, e.y, t.x, t.y) > 40)[0];
        if (o) make(o.x, o.y);
      }
      cd.poison += 3.5 / speedUp();
    },

    missile(dt, L) {
      if ((cd.missile -= dt) > 0) return;
      const t = nearest(stats.range * 1.2);
      if (!t) {
        cd.missile = 0;
        return;
      }
      const n = L >= 5 ? 6 : L >= 3 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(t.y - cy, t.x - cx) + (i - (n - 1) / 2) * 0.5;
        later(i * 0.07, () => w.proj.push({
          kind: 'missile', x: cx, y: cy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 3, L, t: 0,
          dmg: D() * (1.6 + 0.25 * (L - 1)), aoe: L >= 5 ? 24 : 14,
        }));
      }
      cd.missile += (3.0 - 0.2 * L) / speedUp();
    },

    laser(dt, L) {
      if ((cd.laser -= dt) > 0) return;
      const t = nearest(stats.range * 1.3);
      if (!t) {
        cd.laser = 0;
        return;
      }
      const a = Math.atan2(t.y - cy, t.x - cx);
      const life = L >= 5 ? 0.7 : 0.3;
      const total = D() * (1.4 + 0.25 * (L - 1)) * (L >= 5 ? 1.5 : 1);
      const angles = syn.has('prism') ? [a, a - 0.24, a + 0.24] : L >= 3 ? [a - 0.18, a + 0.18] : [a];
      const k = syn.has('prism') ? 0.7 : 1;
      if (syn.has('prism')) synText('prism', cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
      for (const ang of angles) w.beams.push({ a: ang, w: 5 + L, t: 0, life, total: total * k, tick: 0, ticks: Math.max(1, Math.round(life / 0.2)) });
      cd.laser += (3.2 - 0.2 * L) / speedUp();
    },

    mine(dt, L) {
      if ((cd.mine -= dt) > 0) return;
      const maxMines = 3 + L;
      if (w.mines.length >= maxMines) {
        cd.mine = 0.4;
        return;
      }
      const t = nearest(stats.range * 1.5);
      const base = t ? Math.atan2(t.y - cy, t.x - cx) : rng() * Math.PI * 2;
      const n = L >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = base + (rng() - 0.5) * 0.9;
        const d = 42 + rng() * 28;
        w.mines.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, arm: 0.5, t: 0, boom: false });
      }
      cd.mine += 2.2 / speedUp();
    },

    gravity(dt, L) {
      if ((cd.gravity -= dt) > 0) return;
      let spot = w.mines.length && syn.has('lure') ? w.mines[0] : densest(stats.range * 1.2, 40);
      if (!spot) {
        cd.gravity = 0;
        return;
      }
      w.wells.push({
        x: spot.x, y: spot.y, r: 44 + 4 * L + (L >= 3 ? 10 : 0), life: 2.2 + 0.3 * L, t: 0, pull: 55 + 5 * L + (L >= 4 ? 15 : 0), L, tickT: 0,
      });
      cd.gravity += (6 - 0.3 * L) / speedUp();
    },

    meteor(dt, L) {
      if ((cd.meteor -= dt) > 0) return;
      const pool = inRange(stats.range * 1.3);
      if (!pool.length) {
        cd.meteor = 0;
        return;
      }
      const n = L >= 5 ? 3 : L >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const e = pool[Math.floor(rng() * pool.length)];
        w.meteors.push({
          x: e.x + (rng() - 0.5) * 14, y: e.y + (rng() - 0.5) * 14, t: -i * 0.18, delay: 0.7,
          r: 34 + 3 * L, dmg: D() * (3.2 + 0.6 * (L - 1)),
        });
      }
      cd.meteor += (3.4 - 0.25 * L) / speedUp();
    },

    drone(dt, L) {
      const n = 1 + Math.floor(L / 2);
      while (w.drones.length < n) w.drones.push({ a: (w.drones.length / n) * Math.PI * 2, cd: rng() * 0.5, x: cx, y: cy });
      w.drones.length = n;
      const dmg = D() * 0.7 * (1 + 0.2 * (L - 1)) * (L >= 3 ? 1.15 : 1);
      w.droneA = (w.droneA || 0) + dt * 1.6;
      w.drones.forEach((d, k) => {
        const a = w.droneA + (k / n) * Math.PI * 2;
        d.x = cx + Math.cos(a) * 32;
        d.y = cy + Math.sin(a) * 32 * 0.8;
        d.cd -= dt;
        if (d.cd > 0) return;
        const t = nearestTo(d.x, d.y, stats.range * 0.95);
        if (!t) {
          d.cd = 0.1;
          return;
        }
        const shots = L >= 5 ? 2 : 1;
        for (let s = 0; s < shots; s++) {
          later(s * 0.1, () => {
            if (t.dead) return;
            if (syn.has('dlink-l')) {
              synText('dlink-l', d.x, d.y);
              const nx = nearestTo(t.x, t.y, 40, [t]);
              const pts = [{ x: d.x, y: d.y }, { x: t.x, y: t.y }];
              hurt(t, dmg * 1.2, { tag: 'lightning' });
              if (nx) {
                hurt(nx, dmg * 0.8, { tag: 'lightning' });
                pts.push({ x: nx.x, y: nx.y });
              }
              addFx({ kind: 'bolt', life: 0.2, pts, manual: true });
              return;
            }
            const a2 = Math.atan2(t.y - d.y, t.x - d.x);
            if (syn.has('dlink-f')) synText('dlink-f', d.x, d.y);
            if (syn.has('dlink-b')) synText('dlink-b', d.x, d.y);
            w.proj.push({
              kind: 'dshot', x: d.x, y: d.y, vx: Math.cos(a2) * 260, vy: Math.sin(a2) * 260, life: 1.0, t: 0, dmg,
              slow: syn.has('dlink-f'), pierce: syn.has('dlink-b') ? 3 : 1, seen: new Set(),
            });
          });
        }
        d.cd = 0.9;
      });
    },
  };

  // ---- 毎フレーム ----
  function update(dt) {
    for (const x of loadout) upd[x.id](dt, x.level);

    // 少し遅れて起きる処理（二段爆発など）
    for (const l of w.later) l.t -= dt;
    const due = w.later.filter((l) => l.t <= 0);
    w.later = w.later.filter((l) => l.t > 0);
    for (const l of due) l.fn();

    // 弾（氷結弾・ミサイル・ドローンの弾）
    for (const p of w.proj) {
      p.t += dt;
      p.life -= dt;
      if (p.kind === 'missile') {
        const e = nearestTo(p.x, p.y, 400);
        if (e) {
          const want = Math.atan2(e.y - p.y, e.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let da = want - cur;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          const na = cur + Math.max(-4 * dt, Math.min(4 * dt, da));
          const sp = Math.min(220, Math.hypot(p.vx, p.vy) + 120 * dt);
          p.vx = Math.cos(na) * sp;
          p.vy = Math.sin(na) * sp;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      for (const e of b.enemies) {
        if (e.dead || p.life <= 0) continue;
        if (p.seen && p.seen.has(e)) continue;
        if (dist(p.x, p.y, e.x, e.y) > e.r + 3) continue;
        if (p.kind === 'missile') {
          explode(p.x, p.y, p.aoe, p.dmg, 'fire');
          p.life = 0;
        } else if (p.kind === 'frost') {
          hurt(e, p.dmg, { tag: 'ice' });
          const mul = 0.6 - 0.03 * (p.L - 1);
          const fr = 0.1 + 0.08 * (p.L - 1);
          const dur = p.L >= 5 ? 2.0 : 1.2;
          const apply = (t, chance) => {
            applyStatus(t, 'slow', 2.2, mul);
            if (rng() < chance) applyStatus(t, 'freeze', dur, 0);
          };
          apply(e, fr);
          if (p.L >= 3) for (const o of alive()) if (o !== e && dist(o.x, o.y, e.x, e.y) <= 26) apply(o, p.L >= 5 ? fr : 0);
          addFx({ kind: 'ring', life: 0.35, x: e.x, y: e.y, r: 20 + p.L * 2, tag: 'ice' });
          p.life = 0;
        } else {
          hurt(e, p.dmg, { tag: 'machine' });
          if (p.slow) applyStatus(e, 'slow', 1.8, 0.65);
          p.seen.add(e);
          if (--p.pierce <= 0) p.life = 0;
        }
      }
    }
    w.proj = w.proj.filter((p) => p.life > 0);

    // 毒の雲・燃える大地
    for (const z of w.zones) {
      z.t += dt;
      if (z.drift) {
        const e = nearestTo(z.x, z.y, 200);
        if (e) {
          const d = Math.max(1, dist(e.x, e.y, z.x, z.y));
          z.x += ((e.x - z.x) / d) * 14 * dt;
          z.y += ((e.y - z.y) / d) * 14 * dt;
        }
      }
      if (z.kind === 'poison' && syn.has('vortex') && w.wells.length) {
        const wl = w.wells[0];
        synText('vortex', z.x, z.y);
        const d = Math.max(1, dist(wl.x, wl.y, z.x, z.y));
        z.x += ((wl.x - z.x) / d) * 30 * dt;
        z.y += ((wl.y - z.y) / d) * 30 * dt;
      }
      for (const e of alive()) {
        if (dist(e.x, e.y, z.x, z.y) > z.r + e.r) continue;
        if (z.kind === 'poison') applyStatus(e, 'poison', 0.7, z.dps * (syn.has('vortex') ? 1.6 : 1));
        else applyStatus(e, 'burn', 0.7, z.dps);
      }
    }
    w.zones = w.zones.filter((z) => z.t < z.life);

    // レーザー
    for (const bm of w.beams) {
      bm.t += dt;
      if (bm.t >= bm.tick * (bm.life / bm.ticks)) {
        bm.tick++;
        const ex = cx + Math.cos(bm.a) * 240;
        const ey = cy + Math.sin(bm.a) * 240;
        for (const e of alive()) {
          const vx = ex - cx;
          const vy = ey - cy;
          const u = Math.max(0, Math.min(1, ((e.x - cx) * vx + (e.y - cy) * vy) / (vx * vx + vy * vy)));
          if (dist(e.x, e.y, cx + vx * u, cy + vy * u) <= bm.w / 2 + e.r) hurt(e, bm.total / bm.ticks, { tag: 'light' });
        }
      }
    }
    w.beams = w.beams.filter((bm) => bm.t < bm.life);

    // 地雷
    for (const m of w.mines) {
      m.t += dt;
      m.arm -= dt;
      if (syn.has('lure') && m.arm <= 0) {
        for (const e of alive()) {
          const d = dist(e.x, e.y, m.x, m.y);
          if (d < 70 && d > 4) {
            e.x += ((m.x - e.x) / d) * 22 * dt;
            e.y += ((m.y - e.y) / d) * 22 * dt;
          }
        }
      }
      if (m.arm <= 0 && !m.boom) {
        const trig = (syn.has('lure') ? 22 : 11);
        if (alive().some((e) => dist(e.x, e.y, m.x, m.y) <= trig + e.r)) m.boom = true;
      }
    }
    const L9 = lvOf('mine');
    for (const m of w.mines.filter((x) => x.boom)) {
      const r = (26 + 2 * L9) * (syn.has('lure') ? 1.4 : 1);
      explode(m.x, m.y, r, D() * (2.5 + 0.4 * (L9 - 1)) * (syn.has('lure') ? 1.3 : 1), 'physical');
      if (syn.has('lure')) synText('lure', m.x, m.y);
      if (L9 >= 5) for (const o of w.mines) if (o !== m && dist(o.x, o.y, m.x, m.y) <= 48) o.boom = true;
    }
    w.mines = w.mines.filter((m) => !m.boom);

    // 重力井戸
    for (const wl of w.wells) {
      wl.t += dt;
      wl.tickT += dt;
      for (const e of alive()) {
        const d = dist(e.x, e.y, wl.x, wl.y);
        if (d > wl.r + e.r) continue;
        if (d > 3) {
          const mv = Math.min(d, wl.pull * dt);
          e.x += ((wl.x - e.x) / d) * mv;
          e.y += ((wl.y - e.y) / d) * mv;
        }
      }
      if (wl.tickT >= 0.4) {
        wl.tickT -= 0.4;
        for (const e of alive()) if (dist(e.x, e.y, wl.x, wl.y) <= wl.r + e.r) hurt(e, D() * 0.35, { tag: 'gravity', dot: true });
      }
      if (wl.t >= wl.life && wl.L >= 5 && !wl.collapsed) {
        wl.collapsed = true;
        explode(wl.x, wl.y, wl.r * 0.8, D() * 3, 'gravity');
      }
    }
    w.wells = w.wells.filter((wl) => wl.t < wl.life);

    // 流星
    for (const m of w.meteors) {
      m.t += dt;
      if (m.t >= m.delay && !m.hit) {
        m.hit = true;
        explode(m.x, m.y, m.r, m.dmg, 'fire');
        if (syn.has('burnland')) {
          w.zones.push({ kind: 'fire', x: m.x, y: m.y, r: m.r * 0.75, life: 3.2, t: 0, dps: D() * 0.6 });
          synText('burnland', m.x, m.y);
        }
      }
    }
    w.meteors = w.meteors.filter((m) => !m.hit);
    w.flames = w.flames.filter((f) => (f.t += dt) < f.life);
  }

  // ---- ダメージの補正と、当たったときの組み合わせ効果 ----
  const isFrozen = (e) => e.freeze > 0 || (e.slow && e.slow.t > 0);
  function modify(e, amount, o) {
    if (syn.has('shatter') && o.tag === 'lightning' && e.freeze > 0) {
      synText('shatter', e.x, e.y);
      return amount * 2;
    }
    return amount;
  }

  function onHit(e, amount, o) {
    if (o.synergy || e.dead) return;
    const fire = o.tag === 'fire';
    if (fire && syn.has('steam') && isFrozen(e)) {
      e.freeze = 0;
      if (e.slow) e.slow.t = 0;
      for (const n of alive()) if (n !== e && dist(n.x, n.y, e.x, e.y) <= 32 + n.r) hurt(n, amount * 0.9, { tag: 'steam', synergy: true });
      addFx({ kind: 'boom', life: 0.45, x: e.x, y: e.y, r: 32, tag: 'steam' });
      synText('steam', e.x, e.y);
    }
    if (fire && syn.has('toxic') && e.poison && e.poison.t > 0) {
      e.poison.t = 0;
      for (const n of alive()) if (dist(n.x, n.y, e.x, e.y) <= 38 + n.r) hurt(n, amount * 1.1, { tag: 'toxic', synergy: true });
      addFx({ kind: 'boom', life: 0.5, x: e.x, y: e.y, r: 38, tag: 'toxic' });
      synText('toxic', e.x, e.y);
    }
  }

  function onKill(e) {
    if (lvOf('flame') >= 5 && e.burn && e.burn.t > 0) {
      for (const n of alive()) if (dist(n.x, n.y, e.x, e.y) <= 32 + n.r) applyStatus(n, 'burn', 2.2, e.burn.dps * 0.8);
    }
  }

  // 武器の追加・強化のあとに呼ぶ。組み合わせ効果と、新しい武器の待ち時間を更新する。
  function refresh() {
    syn = activeSynergies(new Set(loadout.map((x) => x.id)));
    w.syn = syn;
    for (const x of loadout) if (cd[x.id] === undefined) cd[x.id] = 0.4;
  }

  return { update, modify, onHit, onKill, refresh, get syn() { return syn; } };
}
