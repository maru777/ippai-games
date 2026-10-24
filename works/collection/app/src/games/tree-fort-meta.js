// ツリー砦の「遊びの幅」を作るデータ: ステージ情報・特色（モディファイア）・遺物・契約・実績。
// 戦闘（tree-fort-battle.js）と画面が読むだけで、ここに足せば遊びが増える。

// ---- ステージ ----
// mods: そのステージの特色。boss: ボスの名前。
export const STAGE_INFO = [
  null,
  { name: '草原の入口', boss: 'ストーン', mods: [] },
  { name: '古い街道', boss: 'ウッドマン', mods: ['swift'] },
  { name: '濃い森', boss: 'ミスト', mods: ['horde'] },
  { name: '霧の渓谷', boss: 'アイアン', mods: ['fog'] },
  { name: '鉄の砦', boss: 'ポイズナ', mods: ['plated'] },
  { name: '雷鳴の丘', boss: 'サンダー', mods: ['rush'] },
  { name: '氷の洞窟', boss: 'フロスト', mods: ['regen'] },
  { name: '灼熱の荒野', boss: 'マグマ', mods: ['haunt'] },
  { name: '幽霊の城', boss: 'ファントム', mods: ['swift', 'fog'] },
  { name: '終焉の塔', boss: 'エンド', mods: ['plated', 'horde'] },
];
export const ENDLESS_UNLOCK = 3; // この番号のステージをクリアすると「無限」が遊べる

// ---- 特色 ----
export const MODS = {
  swift: { name: '疾風', desc: '敵の足が 20% 速い', spd: 1.2 },
  horde: { name: '大群', desc: '敵の数が 35% 増える（体力は 15% 低い）', count: 1.35, hp: 0.85 },
  fog: { name: '霧', desc: '射程が 15% 短くなる', range: 0.85 },
  plated: { name: '重装備', desc: 'すべての敵に装甲 +1.2', armor: 1.2 },
  rush: { name: '急襲', desc: '敵が短い間隔で次々に出る', spawn: 0.65 },
  regen: { name: '再生', desc: '敵が毎秒 1.5% 回復する', regen: 0.015 },
  haunt: { name: '呪い', desc: '精鋭の敵が出やすい（宝箱も増える）', elite: 3 },
  wealthy: { name: '豊穣', desc: 'ポイント +40%（経験値 -10%）', pointAdd: 0.4, xp: 0.9 },
};

// 特色の配列から、戦闘で使う倍率をまとめる
export function combineMods(ids = []) {
  const m = { spd: 1, hp: 1, count: 1, armor: 0, spawn: 1, regen: 0, elite: 1, range: 1, pointAdd: 0, xp: 1 };
  for (const id of ids) {
    const d = MODS[id];
    if (!d) continue;
    m.spd *= d.spd || 1;
    m.hp *= d.hp || 1;
    m.count *= d.count || 1;
    m.armor += d.armor || 0;
    m.spawn *= d.spawn || 1;
    m.regen += d.regen || 0;
    m.elite *= d.elite || 1;
    m.range *= d.range || 1;
    m.pointAdd += d.pointAdd || 0;
    m.xp *= d.xp || 1;
  }
  return m;
}

// 今日の挑戦: 日付から決まる特色と乱数の種
export function dailyChallenge(date = new Date()) {
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const d = date.getDate();
  const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const seed = y * 10000 + mo * 100 + d;
  const ids = Object.keys(MODS);
  const a = ids[seed % ids.length];
  const b = ids[(Math.floor(seed / 7) + 3) % ids.length];
  return { key, seed, mods: a === b ? [a, 'swift'] : [a, b] };
}

// ---- 遺物（精鋭の敵が落とす宝箱から 1 つ選ぶ。その挑戦の間ずっと効く）----
// apply(ctx): ctx = { stats, tower, b }。tagMul は属性ごとのダメージ倍率、dotMul は継続ダメージの倍率。
export const RELICS = [
  { id: 'ember', name: '燃える護符', color: '#ff8a3c', desc: '火属性のダメージ +30%', tagMul: { fire: 1.3, burn: 1.3 } },
  { id: 'frostheart', name: '氷の心臓', color: '#8fe8ff', desc: '氷属性 +30%。凍った・鈍足の敵へのダメージ +15%', tagMul: { ice: 1.3 }, frozenMul: 1.15 },
  { id: 'storm', name: '嵐の針', color: '#7fd6ff', desc: '雷属性のダメージ +35%', tagMul: { lightning: 1.35 } },
  { id: 'venom', name: '毒の小瓶', color: '#8dff6a', desc: '毒・燃焼などの継続ダメージ +45%', dotMul: 1.45 },
  { id: 'lens', name: '集光レンズ', color: '#fff2a0', desc: '光・機械属性のダメージ +30%', tagMul: { light: 1.3, machine: 1.3 } },
  { id: 'gravstone', name: '重力石', color: '#b48cff', desc: '重力・物理属性のダメージ +25%', tagMul: { gravity: 1.25, physical: 1.25 } },
  { id: 'magnet', name: '磁石', color: '#7affc8', desc: '経験値 +25%', apply: (c) => { c.stats.xpMul += 0.25; } },
  { id: 'clover', name: '四つ葉', color: '#7dff8a', desc: 'レベルアップの選択肢が 1 つ増える（最大 4）', apply: (c) => { c.stats.choices = Math.min(4, c.stats.choices + 1); } },
  { id: 'heartstone', name: '命の石', color: '#ff7a8a', desc: '耐久 +40・毎秒の回復 +1', apply: (c) => { c.tower.max += 40; c.tower.hp += 40; c.stats.regen += 1; } },
  { id: 'fang', name: '吸血の牙', color: '#ff5470', desc: '敵を倒すと耐久が 0.8 回復', apply: (c) => { c.stats.leech += 0.8; } },
  { id: 'hawk', name: '鷹の目', color: '#ff9ae8', desc: '会心率 +12%', apply: (c) => { c.stats.crit = Math.min(1, c.stats.crit + 0.12); } },
  { id: 'boots', name: '疾風の靴', color: '#ffd84a', desc: '連射速度 +20%', apply: (c) => { c.stats.rate *= 1.2; } },
  { id: 'giant', name: '巨人の指輪', color: '#ff7a8a', desc: '攻撃力 +25%', apply: (c) => { c.stats.dmg *= 1.25; } },
  { id: 'dice', name: '運命のサイコロ', color: '#c9a3ff', desc: 'レベルアップの選び直し +2 回', apply: (c) => { c.b.rerolls += 2; } },
  { id: 'echo', name: 'こだま', color: '#9fe8ff', desc: '武器の待ち時間が 18% 短くなる', apply: (c) => { c.b.cdRate *= 1.18; } },
  { id: 'cup', name: '黄金の杯', color: '#ffd84a', desc: '獲得ポイント +30%', apply: (c) => { c.stats.pointMul += 0.3; } },
];
export const RELIC = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// 遺物を効かせる（apply 以外の効果は、戦闘側が b.relics から読む）
export function applyRelic(ctx, id) {
  const r = RELIC[id];
  if (!r) return;
  if (r.apply) r.apply(ctx);
}

// 遺物の選択肢（持っていないものから n 個）
export function relicOptions(rng, have, n = 3) {
  const pool = RELICS.filter((r) => !have.includes(r.id));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

// ---- 契約（波の合間に出る、リスクと見返りの選択）----
export const CONTRACTS = [
  {
    id: 'blood', name: '血の契約', color: '#ff5470', give: '耐久が 25% 減る', get: '経験値 +50%・すぐにレベルアップ 1 回',
    apply: (c) => { c.tower.hp = Math.max(1, c.tower.hp - c.tower.max * 0.25); c.stats.xpMul += 0.5; c.b.grantLevel(); },
  },
  {
    id: 'greed', name: '強欲の契約', color: '#ffd84a', give: '敵の体力 +20%', get: 'ポイント +40%（この挑戦）',
    apply: (c) => { c.b.rt.hp *= 1.2; c.stats.pointMul += 0.4; },
  },
  {
    id: 'rushpact', name: '急ぎの契約', color: '#7fd6ff', give: '敵の足が 15% 速くなる', get: '選び直し +2・次のレベルアップまでの経験値 -30%',
    apply: (c) => { c.b.rt.spd *= 1.15; c.b.rerolls += 2; c.b.xpNeed = Math.ceil(c.b.xpNeed * 0.7); },
  },
  {
    id: 'blessing', name: '祝福', color: '#7dff8a', give: 'なし', get: '耐久を全回復・攻撃力 +10%',
    apply: (c) => { c.tower.hp = c.tower.max; c.stats.dmg *= 1.1; },
  },
  {
    id: 'thorn', name: '鉄の契約', color: '#9aa8d8', give: '敵に装甲 +1', get: '会心率 +15%・攻撃力 +10%',
    apply: (c) => { c.b.rt.armor += 1; c.stats.crit = Math.min(1, c.stats.crit + 0.15); c.stats.dmg *= 1.1; },
  },
];
export const CONTRACT = Object.fromEntries(CONTRACTS.map((x) => [x.id, x]));
export const CONTRACT_WAVES = [3, 6]; // この波の直前に契約が出る（ステージ制のみ）

// ---- 実績 ----
// check(p): p = { stageClear, stars, discoveredWeapons, discoveredSyn, bestWave, runs, bestCombo, relics }
export const ACHIEVEMENTS = [
  { id: 'first', name: 'はじめての勝利', desc: 'ステージ 1 をクリア', reward: 30, check: (p) => p.stageClear >= 1 },
  { id: 'stage5', name: '中堅の砦', desc: 'ステージ 5 をクリア', reward: 120, check: (p) => p.stageClear >= 5 },
  { id: 'stage10', name: '終焉を越えて', desc: 'ステージ 10 をクリア', reward: 400, check: (p) => p.stageClear >= 10 },
  { id: 'star3', name: '完全勝利', desc: '★3 でステージをクリア', reward: 80, check: (p) => Object.values(p.stars).some((s) => s >= 3) },
  { id: 'stars15', name: '星集め', desc: '星を合計 15 個集める', reward: 200, check: (p) => Object.values(p.stars).reduce((a, b) => a + b, 0) >= 15 },
  { id: 'weapons6', name: '武器コレクター', desc: '武器を 6 種見つける', reward: 100, check: (p) => p.discoveredWeapons >= 6 },
  { id: 'weapons12', name: '武器マスター', desc: '武器を 12 種すべて見つける', reward: 300, check: (p) => p.discoveredWeapons >= 12 },
  { id: 'syn5', name: '組み合わせの探究者', desc: '組み合わせ効果を 5 種見つける', reward: 120, check: (p) => p.discoveredSyn >= 5 },
  { id: 'syn11', name: '組み合わせの達人', desc: '組み合わせ効果を 11 種すべて見つける', reward: 350, check: (p) => p.discoveredSyn >= 11 },
  { id: 'combo30', name: '連鎖の嵐', desc: '30 連続で撃破（コンボ）', reward: 100, check: (p) => p.bestCombo >= 30 },
  { id: 'relic3', name: '遺物持ち', desc: '1 回の挑戦で遺物を 3 つ集める', reward: 100, check: (p) => p.relics >= 3 },
  { id: 'endless20', name: '終わりなき戦い', desc: '無限モードで 20 波に到達', reward: 200, check: (p) => p.bestWave >= 20 },
];
