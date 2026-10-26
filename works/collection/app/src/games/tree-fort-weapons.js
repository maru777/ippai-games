// ツリー砦の武器: データ（12 種・各 Lv1〜10・組み合わせ効果）と、戦闘中の動き。
// 武器の追加は WEAPONS に 1 件足し、下の upd に動きを書く。組み合わせ効果は SYNERGIES に足す。
// 戦闘本体（tree-fort-battle.js）は api（敵・ダメージ・演出の道具）を渡して createWeapons を呼ぶだけ。
export const SLOT_BASE = 3;
export const SLOT_MAX = 6;
export const SLOT_COST = { 4: 300, 5: 750, 6: 1500 };
export const MAX_LEVEL = 10; // 武器の最大レベル。levels が 5 つの武器（まだ Lv10 にしていないもの）は、そこが上限
// その武器の上限レベル（説明が書かれているところまで）
export const maxLevelOf = (id) => WEAPON[id].levels.length;

// cost[i] = Lv(i+1) にするための費用。levels[i] = Lv(i+1) の効果の説明。
export const WEAPONS = [
  {
    id: 'bomb', name: '爆弾', tags: ['fire'], color: '#ff9a3c', desc: '敵の群れに爆発を撃ち込む',
    cost: [100, 70, 120, 200, 320, 420, 540, 700, 900, 1200],
    levels: ['爆発（範囲 小）', '威力 +、範囲 +', '2 連続で爆発', '威力・範囲 ++', '子爆弾が飛び散る', '威力・範囲 +++', '子爆弾が 6 個に（連鎖して爆発）', '威力 ++++・連射 +', '3 連続で爆発', 'MAX: 着弾点に巨大な爆発と衝撃波'],
  },
  {
    id: 'lightning', name: '雷撃', tags: ['lightning'], color: '#7fd6ff', desc: '敵から敵へ連鎖する雷',
    cost: [100, 70, 120, 200, 320, 420, 540, 700, 900, 1200],
    levels: ['3 体に連鎖', '威力 +', '連鎖 +1', '威力 ++', 'さらに 3 か所へ落雷', '威力 +++', '連鎖 +2', '威力 ++++・連射 +', '落雷が 6 か所に', 'MAX: 数秒ごとに画面全体へ雷の嵐'],
  },
  {
    id: 'blade', name: '回転刃', tags: ['physical'], color: '#e8f0ff', desc: '砦の周りを回って近づく敵を斬る',
    cost: [90, 60, 110, 180, 300, 400, 520, 680, 880, 1150],
    levels: ['刃 2 枚', '威力・速度 +', '刃 3 枚', '威力 ++', '刃 4 枚＋衝撃波', '威力・速度 +++', '刃 5 枚', '衝撃波が強く・速く', '刃 6 枚', 'MAX: 外周にもう 1 周の刃（逆回転）'],
  },
  {
    id: 'flame', name: '火炎放射', tags: ['fire'], color: '#ff6a2a', desc: '近距離の扇形に炎を吹き、敵を燃やす',
    cost: [120, 80, 130, 210, 340, 440, 560, 720, 920, 1200],
    levels: ['扇形の炎＋燃焼', '威力 +', '範囲が広がる', '燃焼ダメージ ++', '倒すと周囲に燃え移る', '威力・範囲 +++', '炎の扇が広がる', '燃焼ダメージ ++++', '燃え移りが広がり、倒した跡が燃え続ける', 'MAX: 全周へ炎を吹き、数秒ごとに火柱が立つ'],
  },
  {
    id: 'frost', name: '氷結弾', tags: ['ice'], color: '#9fe8ff', desc: '命中した敵を遅くし、凍らせる',
    cost: [120, 80, 130, 210, 340, 440, 560, 720, 920, 1200],
    levels: ['鈍足＋凍結(小)', '凍結しやすい', '周囲も鈍足に', '威力 ++・凍結しやすい', '3 方向に撃つ・凍結が長い', '威力・凍結 +++', '4 方向に撃つ', '威力 ++++・凍結が長い', '5 方向・凍った敵が砕けて氷片が飛ぶ', 'MAX: 数秒ごとに「絶対零度」で全員を凍らせる'],
  },
  {
    id: 'poison', name: '毒霧', tags: ['poison'], color: '#8dff6a', desc: '地面に残る毒の雲で、継続ダメージ',
    cost: [130, 80, 140, 220, 360, 460, 580, 750, 950, 1250],
    levels: ['毒の雲を 1 つ', '雲が広く・長く', '雲を 2 つ', '毒ダメージ ++', '雲が敵を追いかける', '雲が広く・長く +++', '雲を 3 つ', '毒ダメージ ++++', '雲が速く追い、さらに広がる', 'MAX: 巨大な毒雲が広がり、毒で倒れた敵が毒をまく'],
  },
  {
    id: 'missile', name: 'ミサイル', tags: ['fire', 'physical'], color: '#ffd84a', desc: '追尾するミサイルを一斉に撃つ',
    cost: [140, 90, 150, 240, 380, 480, 600, 780, 980, 1300],
    levels: ['2 発', '威力 +', '4 発', '威力 ++', '6 発＋大きな爆発', '威力 +++', '8 発', '爆発範囲 +', '10 発・追尾が鋭い', 'MAX: 14 発の一斉射。着弾で分裂して連続爆発'],
  },
  {
    id: 'laser', name: 'レーザー', tags: ['light'], color: '#fff2a0', desc: '一直線に貫く光線',
    cost: [150, 100, 160, 260, 400, 500, 640, 820, 1020, 1350],
    levels: ['光線 1 本', '威力 +', '光線 2 本', '威力 ++', '長く照射（威力 1.5 倍）', '威力 +++', '光線 3 本', '威力 ++++・照射が長い', '光線 4 本', 'MAX: 3 本の極太レーザーが回転しながら照射'],
  },
  {
    id: 'mine', name: '地雷', tags: ['physical'], color: '#c9a36a', desc: '敵の通り道に仕掛け、踏むと爆発',
    cost: [130, 80, 140, 220, 360, 460, 580, 750, 950, 1250],
    levels: ['地雷を仕掛ける', '威力・範囲 +', '一度に 2 個', '威力 ++', '連鎖して爆発', '威力・範囲 +++', '一度に 3 個', '威力 ++++・連鎖範囲 +', '設置が速く、敵を引き寄せる', 'MAX: 地雷原。一度に 5 個、連鎖で一帯が爆発'],
  },
  {
    id: 'gravity', name: '重力井戸', tags: ['gravity'], color: '#b48cff', desc: '敵を中心へ引き寄せ、固めてダメージ',
    cost: [160, 100, 170, 270, 420, 520, 660, 850, 1050, 1400],
    levels: ['引き寄せる井戸', '範囲 +', '範囲 ++', '引力 ++', '最後に崩壊して大ダメージ', '範囲・引力 +++', '井戸が 2 つ同時に', '継続ダメージ 1.6 倍', '崩壊ダメージが 2 倍', 'MAX: ブラックホール。巨大な井戸が敵を吸い込み、崩壊で大爆発'],
  },
  {
    id: 'meteor', name: '流星', tags: ['fire'], color: '#ff8a5a', desc: '空から大きな隕石を降らせる',
    cost: [170, 110, 180, 290, 450, 540, 680, 880, 1100, 1450],
    levels: ['隕石 1 発', '威力 +', '同時に 2 発', '威力 ++', '同時に 3 発', '威力 +++', '同時に 4 発', '威力 ++++・範囲 +', '同時に 5 発', 'MAX: 流星群。8 発が降り、続けてもう 4 発'],
  },
  {
    id: 'drone', name: 'ドローン', tags: ['machine'], color: '#7affc8', desc: '砦に付き添って自動で撃つ小型機',
    cost: [150, 90, 150, 240, 380, 500, 640, 820, 1020, 1350],
    levels: ['1 機', '2 機', '威力 +', '3 機', '二連射', '4 機', '威力 ++', '5 機', '三連射', 'MAX: 6 機が四連射。数秒ごとに全機が一斉射撃'],
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
  const { b, stats, rng, ARENA, dist, alive, nearestTo, hurt, applyStatus } = api;
  let curMax = false; // いま動かしている武器が MAX か（その演出に max を付けて、描画側が金色にする）
  const addFx = (f) => api.addFx(curMax ? { ...f, max: true } : f);
  const { cx, cy } = ARENA;
  let syn = activeSynergies(new Set(loadout.map((w) => w.id)));
  const lvOf = (id) => loadout.find((w) => w.id === id)?.level || 0;
  let curK = 1; // MAX の武器を動かしている間だけ 1.25（MAX のレベル特典）
  const D = () => stats.dmg * curK;
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
      if (L >= 9) later(0.7, () => explode(x, y, r, dmg * 0.5, 'fire'));
      if (L >= 5) {
        const kids = L >= 7 ? 6 : 4;
        for (let i = 0; i < kids; i++) {
          const a = (i / kids) * Math.PI * 2 + 0.4;
          const kx = x + Math.cos(a) * 26;
          const ky = y + Math.sin(a) * 26;
          later(0.2 + i * 0.07, () => explode(kx, ky, 18, dmg * 0.5, 'fire'));
          if (L >= 7) later(0.5 + i * 0.07, () => explode(kx + Math.cos(a) * 14, ky + Math.sin(a) * 14, 14, dmg * 0.3, 'fire')); // 子爆弾が連鎖
        }
      }
      cd.bomb += Math.max(0.9, 2.6 - 0.2 * (L - 1) - (L >= 8 ? 0.2 : 0)) / speedUp();
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
      const chains = 3 + Math.floor(L / 2) + (L >= 7 ? 2 : 0);
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
        for (let i = 0; i < (L >= 9 ? 6 : 3) && pool.length; i++) {
          const e = pool.splice(Math.floor(rng() * pool.length), 1)[0];
          hurt(e, D() * 1.2, { tag: 'lightning' });
          addFx({ kind: 'bolt', life: 0.25, pts: [{ x: e.x + 6, y: e.y - 70 }, { x: e.x, y: e.y }] });
        }
      }
      cd.lightning += Math.max(0.7, 1.7 - 0.1 * (L - 1) - (L >= 8 ? 0.1 : 0)) / speedUp();
    },

    blade(dt, L, mx) {
      const n = L >= 9 ? 6 : L >= 7 ? 5 : L >= 5 ? 4 : L >= 3 ? 3 : 2;
      const R = Math.min(70, 34 + 6 * (L - 1));
      w.angle = (w.angle || 0) + (3.2 + 0.2 * L) * dt;
      w.blades = Array.from({ length: n }, (_, k) => {
        const a = w.angle + (k * Math.PI * 2) / n;
        return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
      });
      if (mx) {
        // MAX: 外周にもう 1 周の刃（逆回転）
        const R2 = R + 30;
        for (let k = 0; k < 6; k++) {
          const a = -w.angle * 0.8 + (k * Math.PI * 2) / 6;
          w.blades.push({ x: cx + Math.cos(a) * R2, y: cy + Math.sin(a) * R2, a });
        }
      }
      const dmg = D() * (0.9 + 0.22 * (L - 1)) * (b.t < (w.bladeBoost || 0) ? 2 : 1); // 大技の間は 2 倍
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
          cd.blade += L >= 8 ? 1.8 : 2.5;
          const sr = 56 + (L >= 8 ? 14 : 0);
          for (const e of alive()) if (dist(e.x, e.y, cx, cy) <= sr + e.r) hurt(e, D() * (L >= 8 ? 2.4 : 1.8), { tag: 'physical' });
          addFx({ kind: 'ring', life: 0.4, x: cx, y: cy, r: sr, tag: 'physical' });
        }
      }
    },

    flame(dt, L, mx) {
      const range = Math.min(110, 62 + 6 * (L - 1));
      if ((cd.flame -= dt) > 0) return;
      const t = nearest(range + 12);
      if (!t) {
        cd.flame = 0;
        return;
      }
      const a = Math.atan2(t.y - cy, t.x - cx);
      const half = mx ? Math.PI : 0.5 + (L >= 3 ? 0.15 : 0) + (L >= 7 ? 0.2 : 0);
      for (const e of alive()) {
        const d = dist(e.x, e.y, cx, cy);
        if (d > range + e.r) continue;
        let da = Math.atan2(e.y - cy, e.x - cx) - a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > half) continue;
        hurt(e, D() * (0.9 + 0.12 * (L - 1)), { tag: 'fire' });
        applyStatus(e, 'burn', 2.5, D() * 0.5 * (1 + 0.25 * (L - 1)) * (L >= 4 ? 1.3 : 1) * (L >= 8 ? 1.3 : 1));
      }
      w.flames.push({ a, range, half, t: 0, life: 0.3, max: curMax });
      cd.flame += Math.max(0.4, 0.9 - 0.05 * L) / speedUp();
    },

    frost(dt, L) {
      if ((cd.frost -= dt) > 0) return;
      const t = nearest(stats.range);
      if (!t) {
        cd.frost = 0;
        return;
      }
      const a0 = Math.atan2(t.y - cy, t.x - cx);
      const spread = L >= 9 ? [-0.5, -0.25, 0, 0.25, 0.5] : L >= 7 ? [-0.45, -0.15, 0.15, 0.45] : L >= 5 ? [-0.3, 0, 0.3] : [0];
      for (const da of spread) {
        const a = a0 + da;
        w.proj.push({ kind: 'frost', x: cx, y: cy, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, life: 1.2, L, dmg: D() * (0.9 + 0.2 * (L - 1)) * (L >= 8 ? 1.2 : 1), t: 0, max: curMax });
      }
      cd.frost += Math.max(0.55, 1.3 - 0.1 * L) / speedUp();
    },

    poison(dt, L) {
      if ((cd.poison -= dt) > 0) return;
      const t = densest(stats.range * 1.1, 34);
      if (!t) {
        cd.poison = 0;
        return;
      }
      const make = (x, y) => w.zones.push({
        kind: 'poison', x, y, r: (30 + 3 * L) * (L >= 9 ? 1.25 : 1), life: 4 + 0.5 * L, t: 0,
        dps: D() * 0.7 * (1 + 0.2 * (L - 1)) * (L >= 4 ? 1.2 : 1) * (L >= 8 ? 1.3 : 1), drift: L >= 5, driftSpd: L >= 9 ? 30 : 14, max: curMax,
      });
      make(t.x, t.y);
      if (L >= 3) {
        const os = alive().filter((e) => dist(e.x, e.y, t.x, t.y) > 40);
        if (os[0]) make(os[0].x, os[0].y);
        if (L >= 7 && os.length > 1) make(os[os.length - 1].x, os[os.length - 1].y);
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
      const n = L >= 9 ? 10 : L >= 7 ? 8 : L >= 5 ? 6 : L >= 3 ? 4 : 2;
      const mx = curMax;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(t.y - cy, t.x - cx) + (i - (n - 1) / 2) * (n > 6 ? 0.28 : 0.5);
        later(i * 0.07, () => w.proj.push({
          kind: 'missile', x: cx, y: cy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 3, L, t: 0,
          dmg: D() * (1.6 + 0.25 * (L - 1)), aoe: L >= 8 ? 30 : L >= 5 ? 24 : 14, max: mx, split: false,
        }));
      }
      cd.missile += Math.max(1.2, 3.0 - 0.2 * L) / speedUp();
    },

    laser(dt, L) {
      if ((cd.laser -= dt) > 0) return;
      const t = nearest(stats.range * 1.3);
      if (!t) {
        cd.laser = 0;
        return;
      }
      const a = Math.atan2(t.y - cy, t.x - cx);
      const life = L >= 8 ? 1.0 : L >= 5 ? 0.7 : 0.3;
      const total = D() * (1.4 + 0.25 * (L - 1)) * (L >= 5 ? 1.5 : 1) * (L >= 8 ? 1.2 : 1);
      const angles = syn.has('prism') ? [a, a - 0.24, a + 0.24] : L >= 9 ? [a - 0.36, a - 0.12, a + 0.12, a + 0.36] : L >= 7 ? [a - 0.25, a, a + 0.25] : L >= 3 ? [a - 0.18, a + 0.18] : [a];
      const k = syn.has('prism') ? 0.7 : 1;
      if (syn.has('prism')) synText('prism', cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
      for (const ang of angles) w.beams.push({ a: ang, w: Math.min(11, 5 + L), t: 0, life, total: total * k, tick: 0, ticks: Math.max(1, Math.round(life / 0.2)), max: curMax });
      cd.laser += Math.max(1.2, 3.2 - 0.2 * L) / speedUp();
    },

    mine(dt, L, mx) {
      if ((cd.mine -= dt) > 0) return;
      const maxMines = mx ? 15 : 3 + L;
      if (w.mines.length >= maxMines) {
        cd.mine = 0.4;
        return;
      }
      const t = nearest(stats.range * 1.5);
      const base = t ? Math.atan2(t.y - cy, t.x - cx) : rng() * Math.PI * 2;
      const n = mx ? 5 : L >= 7 ? 3 : L >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = base + (rng() - 0.5) * (n > 3 ? 1.6 : 0.9);
        const d = 42 + rng() * 28;
        w.mines.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, arm: 0.5, t: 0, boom: false, max: curMax });
      }
      cd.mine += (mx ? 1.2 : L >= 9 ? 1.6 : 2.2) / speedUp();
    },

    gravity(dt, L) {
      if ((cd.gravity -= dt) > 0) return;
      let spot = w.mines.length && syn.has('lure') ? w.mines[0] : densest(stats.range * 1.2, 40);
      if (!spot) {
        cd.gravity = 0;
        return;
      }
      const make = (s, big) => w.wells.push({
        x: s.x, y: s.y, r: Math.min(150, (44 + 4 * L + (L >= 3 ? 10 : 0)) * (big ? 1.8 : 1)), life: (2.2 + 0.3 * L) * (big ? 1.5 : 1), t: 0,
        pull: (55 + 5 * L + (L >= 4 ? 15 : 0)) * (big ? 2 : 1), L, tickT: 0, dpsK: L >= 8 ? 1.6 : 1, big, max: curMax,
      });
      make(spot, false);
      if (L >= 7) {
        const far = alive().find((e) => dist(e.x, e.y, spot.x, spot.y) > 70);
        if (far) make(far, false);
      }
      cd.gravity += (6 - 0.3 * L) / speedUp();
    },

    meteor(dt, L) {
      if ((cd.meteor -= dt) > 0) return;
      const pool = inRange(stats.range * 1.3);
      if (!pool.length) {
        cd.meteor = 0;
        return;
      }
      const n = L >= 9 ? 5 : L >= 7 ? 4 : L >= 5 ? 3 : L >= 3 ? 2 : 1;
      const mx = curMax;
      const drop = (count, t0) => {
        for (let i = 0; i < count; i++) {
          const e = pool[Math.floor(rng() * pool.length)];
          w.meteors.push({
            x: e.x + (rng() - 0.5) * 14, y: e.y + (rng() - 0.5) * 14, t: t0 - i * 0.18, delay: 0.7,
            r: 34 + 3 * L + (L >= 8 ? 8 : 0), dmg: D() * (3.2 + 0.6 * (L - 1)), max: mx,
          });
        }
      };
      drop(n, 0);
      cd.meteor += Math.max(1.4, 3.4 - 0.25 * L) / speedUp();
    },

    drone(dt, L, mx) {
      const n = 1 + Math.floor(L / 2);
      while (w.drones.length < n) w.drones.push({ a: (w.drones.length / n) * Math.PI * 2, cd: rng() * 0.5, x: cx, y: cy });
      w.drones.length = n;
      const dmg = D() * 0.7 * (1 + 0.2 * (L - 1)) * (L >= 3 ? 1.15 : 1) * (L >= 7 ? 1.2 : 1);
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
        const shots = mx ? 4 : L >= 9 ? 3 : L >= 5 ? 2 : 1;
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
              slow: syn.has('dlink-f'), pierce: syn.has('dlink-b') ? 3 : 1, seen: new Set(), max: mx,
            });
          });
        }
        d.cd = mx ? 0.5 : 0.9;
      });
    },
  };

  // ---- MAX の大技: ゲージがたまったら、HUD の武器アイコンをタップして発動する ----
  const ULT_SEC = 14; // ゲージが満タンになるまでの秒数（敵を倒すと早くたまる）
  w.ult = {}; // 武器 id → { charge: 0〜1 }
  const ultOf = (id) => (w.ult[id] = w.ult[id] || { charge: 0 });
  function chargeUlt(id, dt) {
    const u = ultOf(id);
    const was = u.charge;
    u.charge = Math.min(1, u.charge + dt / ULT_SEC);
    if (was < 1 && u.charge >= 1) b.toast = { icon: id, title: `${WEAPON[id].name} の大技が使える！`, sub: '下の武器アイコンをタップで発動', color: '#ffd84a', t: 3 };
  }
  // 敵を倒す・タップが当たるたびに、MAX の武器の大技ゲージが少したまる
  function addCharge(k) {
    for (const x of loadout) if (x.level >= MAX_LEVEL) ultOf(x.id).charge = Math.min(1, ultOf(x.id).charge + k);
  }
  const ults = {
    bomb() {
      const t = densest(stats.range * 1.3, 40) || nearest(stats.range * 1.3);
      if (!t) return false;
      const r = 62;
      explode(t.x, t.y, r * 1.8, D() * 10, 'fire');
      later(0.25, () => explode(t.x, t.y, r * 1.2, D() * 5, 'fire'));
      addFx({ kind: 'ring', life: 0.8, x: t.x, y: t.y, r: r * 2.6, tag: 'fire' });
      return true;
    },
    lightning() {
      const all = alive();
      if (!all.length) return false;
      all.forEach((e, i) => {
        hurt(e, D() * 4, { tag: 'lightning' });
        if (i < 14) addFx({ kind: 'bolt', life: 0.35, pts: [{ x: e.x + 8, y: e.y - 90 }, { x: e.x, y: e.y }] });
      });
      return true;
    },
    blade() {
      if (!alive().length) return false;
      w.bladeBoost = b.t + 6; // 6 秒間、刃のダメージが 2 倍
      for (const e of alive()) if (dist(e.x, e.y, cx, cy) <= 120 + e.r) hurt(e, D() * 5, { tag: 'physical' });
      addFx({ kind: 'ring', life: 0.7, x: cx, y: cy, r: 120, tag: 'physical' });
      return true;
    },
    flame() {
      const hit = inRange(150);
      if (!hit.length) return false;
      for (const e of hit) {
        hurt(e, D() * 5, { tag: 'fire' });
        applyStatus(e, 'burn', 4, D() * 1.5);
      }
      addFx({ kind: 'ring', life: 0.8, x: cx, y: cy, r: 150, tag: 'fire' });
      return true;
    },
    frost() {
      const hit = inRange(stats.range * 1.5);
      if (!hit.length) return false;
      for (const e of hit) {
        applyStatus(e, 'slow', 3.5, 0.3);
        applyStatus(e, 'freeze', 2.4, 0);
        hurt(e, D() * 2.5, { tag: 'ice' });
      }
      addFx({ kind: 'ring', life: 0.9, x: cx, y: cy, r: stats.range * 1.5, tag: 'ice' });
      return true;
    },
    poison() {
      const t = densest(stats.range * 1.3, 40) || nearest(stats.range * 1.3);
      if (!t) return false;
      w.zones.push({ kind: 'poison', x: t.x, y: t.y, r: 110, life: 9, t: 0, dps: D() * 0.7 * 3.2, drift: true, driftSpd: 30, max: true, big: true });
      return true;
    },
    missile() {
      const t = nearest(stats.range * 1.4);
      if (!t) return false;
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(t.y - cy, t.x - cx) + (i - (n - 1) / 2) * 0.28;
        later(i * 0.05, () => w.proj.push({
          kind: 'missile', x: cx, y: cy, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 3, L: 10, t: 0,
          dmg: D() * 3.5, aoe: 30, max: true, split: true,
        }));
      }
      return true;
    },
    laser() {
      const t = nearest(stats.range * 1.5);
      if (!t) return false;
      const a = Math.atan2(t.y - cy, t.x - cx);
      const total = D() * 22;
      for (let i = 0; i < 3; i++) w.beams.push({ a: a + (i * Math.PI * 2) / 3, w: 16, t: 0, life: 2.4, total, tick: 0, ticks: 12, rot: 2.2, max: true });
      return true;
    },
    mine() {
      const es = alive();
      if (!es.length) return false;
      for (const m of w.mines) m.boom = true; // 仕掛けた地雷を、すべて起爆
      for (const e of es.slice(0, 8)) explode(e.x, e.y, 40, D() * 6, 'physical');
      return true;
    },
    gravity() {
      const spot = densest(stats.range * 1.3, 50) || nearest(stats.range * 1.3);
      if (!spot) return false;
      w.wells.push({ x: spot.x, y: spot.y, r: 150, life: 5, t: 0, pull: 220, L: 10, tickT: 0, dpsK: 2.2, big: true, max: true });
      return true;
    },
    meteor() {
      const pool = inRange(stats.range * 1.4);
      if (!pool.length) return false;
      for (let i = 0; i < 12; i++) {
        const e = pool[Math.floor(rng() * pool.length)];
        w.meteors.push({ x: e.x + (rng() - 0.5) * 20, y: e.y + (rng() - 0.5) * 20, t: -i * 0.15, delay: 0.7, r: 46, dmg: D() * 8, max: true });
      }
      return true;
    },
    drone() {
      let fired = false;
      for (const d of w.drones) {
        const t0 = nearestTo(d.x, d.y, stats.range * 1.2);
        if (!t0) continue;
        fired = true;
        const base = Math.atan2(t0.y - d.y, t0.x - d.x);
        for (let i = 0; i < 9; i++) {
          const a2 = base + (i - 4) * 0.14;
          w.proj.push({ kind: 'dshot', x: d.x, y: d.y, vx: Math.cos(a2) * 260, vy: Math.sin(a2) * 260, life: 1.0, t: 0, dmg: D() * 2.4, slow: false, pierce: 3, seen: new Set(), max: true });
        }
      }
      return fired;
    },
  };
  // 武器 id の大技を発動する（MAX で、ゲージが満タンのときだけ）
  function ultimate(id) {
    const x = loadout.find((q) => q.id === id);
    const u = w.ult[id];
    if (!x || x.level < MAX_LEVEL || !u || u.charge < 1) return false;
    curMax = true;
    curK = 1.25;
    const ok = ults[id]();
    curMax = false;
    curK = 1;
    if (!ok) return false;
    u.charge = 0;
    api.addFx({ kind: 'ultCast', life: 1.3, wid: id, name: WEAPON[id].name, color: WEAPON[id].color });
    api.addFx({ kind: 'maxPulse', life: 0.5, max: true });
    return true;
  }

  // ---- 毎フレーム ----
  function update(dt) {
    for (const x of loadout) {
      const mx = x.level >= MAX_LEVEL;
      curMax = mx;
      curK = mx ? 1.25 : 1;
      // MAX の武器も、ふだんの動きは Lv9 と同じ（大技は手動。ゲージがたまったらタップで発動）
      upd[x.id](dt, Math.min(x.level, MAX_LEVEL - 1), mx);
      if (mx) chargeUlt(x.id, dt);
    }
    curMax = false;
    curK = 1;

    // 少し遅れて起きる処理（二段爆発など）
    for (const l of w.later) l.t -= dt;
    const due = w.later.filter((l) => l.t <= 0);
    w.later = w.later.filter((l) => l.t > 0);
    for (const l of due) l.fn();

    // 弾（氷結弾・ミサイル・ドローンの弾）
    for (const p of w.proj) {
      curMax = !!p.max;
      p.t += dt;
      p.life -= dt;
      if (p.kind === 'missile') {
        const e = nearestTo(p.x, p.y, 400);
        if (e) {
          const want = Math.atan2(e.y - p.y, e.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let da = want - cur;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          const turn = (p.L >= 9 ? 6 : 4) * dt;
          const na = cur + Math.max(-turn, Math.min(turn, da));
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
          if (p.split) {
            // MAX: 着弾で分裂して、まわりで連続爆発
            const hx = p.x;
            const hy = p.y;
            for (let k = 0; k < 3; k++) {
              const a = (k / 3) * Math.PI * 2 + p.t * 5;
              later(0.15 + k * 0.1, () => explode(hx + Math.cos(a) * 20, hy + Math.sin(a) * 20, 16, p.dmg * 0.4, 'fire'));
            }
          }
          p.life = 0;
        } else if (p.kind === 'frost') {
          const mul = 0.6 - 0.03 * (p.L - 1);
          const fr = Math.min(0.85, 0.1 + 0.08 * (p.L - 1));
          const dur = p.L >= 8 ? 2.8 : p.L >= 5 ? 2.0 : 1.2;
          // Lv9〜: すでに凍っている敵に当たると砕けて、氷片が飛ぶ
          if (p.L >= 9 && e.freeze > 0) explode(e.x, e.y, 30, p.dmg * 0.8, 'ice');
          const apply = (t, chance) => {
            applyStatus(t, 'slow', 2.2, mul);
            if (rng() < chance) applyStatus(t, 'freeze', dur, 0);
          };
          apply(e, fr); // 先に状態異常を付けてから傷つける（倒れる一撃でも蒸気爆発などが起きる）
          hurt(e, p.dmg, { tag: 'ice' });
          if (p.L >= 3) for (const o of alive()) if (o !== e && dist(o.x, o.y, e.x, e.y) <= (p.L >= 9 ? 40 : 26)) apply(o, p.L >= 5 ? fr : 0);
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
    curMax = false;
    w.proj = w.proj.filter((p) => p.life > 0);

    // 毒の雲・燃える大地
    for (const z of w.zones) {
      z.t += dt;
      if (z.drift) {
        const e = nearestTo(z.x, z.y, 200);
        if (e) {
          const d = Math.max(1, dist(e.x, e.y, z.x, z.y));
          z.x += ((e.x - z.x) / d) * (z.driftSpd || 14) * dt;
          z.y += ((e.y - z.y) / d) * (z.driftSpd || 14) * dt;
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
      if (bm.rot) bm.a += bm.rot * dt;
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
      const pull = syn.has('lure') ? 22 : lvOf('mine') >= 9 ? 14 : 0; // Lv9〜: 地雷が敵を少し引き寄せる
      if (pull && m.arm <= 0) {
        for (const e of alive()) {
          const d = dist(e.x, e.y, m.x, m.y);
          if (d < 70 && d > 4) {
            e.x += ((m.x - e.x) / d) * pull * dt;
            e.y += ((m.y - e.y) / d) * pull * dt;
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
      const r = (26 + 2 * L9) * (syn.has('lure') ? 1.4 : 1) * (m.max ? 1.3 : 1);
      curMax = !!m.max;
      explode(m.x, m.y, r, D() * (2.5 + 0.4 * (L9 - 1)) * (syn.has('lure') ? 1.3 : 1), 'physical');
      curMax = false;
      if (syn.has('lure')) synText('lure', m.x, m.y);
      const chain = L9 >= MAX_LEVEL ? 90 : L9 >= 8 ? 70 : 48;
      if (L9 >= 5) for (const o of w.mines) if (o !== m && dist(o.x, o.y, m.x, m.y) <= chain) o.boom = true;
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
        for (const e of alive()) if (dist(e.x, e.y, wl.x, wl.y) <= wl.r + e.r) hurt(e, D() * 0.35 * (wl.dpsK || 1), { tag: 'gravity', dot: true });
      }
      if (wl.t >= wl.life && wl.L >= 5 && !wl.collapsed) {
        wl.collapsed = true;
        curMax = !!wl.max;
        explode(wl.x, wl.y, wl.r * (wl.big ? 1.1 : 0.8), D() * (wl.big ? 10 : wl.L >= 9 ? 6 : 3), 'gravity');
        if (wl.big) addFx({ kind: 'maxPulse', life: 0.5 });
        curMax = false;
      }
    }
    w.wells = w.wells.filter((wl) => wl.t < wl.life);

    // 流星
    for (const m of w.meteors) {
      m.t += dt;
      if (m.t >= m.delay && !m.hit) {
        m.hit = true;
        curMax = !!m.max;
        explode(m.x, m.y, m.r, m.dmg, 'fire');
        curMax = false;
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
    addCharge(0.02);
    if (lvOf('poison') >= MAX_LEVEL && e.poison && e.poison.t > 0 && w.zones.length < 40) {
      // MAX: 毒で倒れた敵が、毒をまき散らす
      w.zones.push({ kind: 'poison', x: e.x, y: e.y, r: 34, life: 3, t: 0, dps: D() * 0.7, max: true });
    }
    const fl = lvOf('flame');
    if (fl >= 5 && e.burn && e.burn.t > 0) {
      for (const n of alive()) if (dist(n.x, n.y, e.x, e.y) <= (fl >= 9 ? 48 : 32) + n.r) applyStatus(n, 'burn', 2.2, e.burn.dps * 0.8);
      // Lv9〜: 倒した跡がしばらく燃え続ける
      if (fl >= 9 && w.zones.length < 30) w.zones.push({ kind: 'fire', x: e.x, y: e.y, r: 22, life: 2.5, t: 0, dps: D() * 0.5, max: fl >= MAX_LEVEL });
    }
  }

  // 武器の追加・強化のあとに呼ぶ。組み合わせ効果と、新しい武器の待ち時間を更新する。
  function refresh() {
    syn = activeSynergies(new Set(loadout.map((x) => x.id)));
    w.syn = syn;
    for (const x of loadout) if (cd[x.id] === undefined) cd[x.id] = 0.4;
  }

  return { update, modify, onHit, onKill, refresh, ultimate, addCharge, get syn() { return syn; } };
}
