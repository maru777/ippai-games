// ツリー砦のデータ: スキルツリー（ノード定義）と、取得済みノードから能力値を求める処理。
// ノードを足すだけで遊びを増やせる（描画・戦闘は能力値だけを見る）。
// 位置 (gx, gy) はツリー画面のマス目（中心 (0,0)・上が -y）。req は「すべて取得済みなら取得できる」ノード。
// fx は能力値への加算。unlock は新しい攻撃の解放。

export const BASE_STATS = {
  dmg: 6, // 攻撃力
  rate: 1.0, // 弾を撃つ回数 / 秒
  range: 80, // 射程（px）
  targets: 1, // 同時に狙う数
  pierce: 0, // 弾が貫通する数
  crit: 0, // 会心率（0〜1。会心は 2 倍）
  hp: 50, // 砦の耐久
  regen: 0, // 毎秒の回復
  reduce: 0, // 受けるダメージの軽減（0〜1）
  pointMul: 0, // ポイント獲得の上乗せ（0.2 = +20%）
  waveBonus: 2, // 波を守り切ったときの基本ボーナス
  slow: 0, // 砦の近くの敵を遅くする割合
  leech: 0, // 敵を倒すたびの回復量
  xpMul: 1, // 経験値の倍率
  rerolls: 1, // レベルアップの選び直しの回数（1 回の挑戦あたり）
  startPicks: 0, // 挑戦の開始時に行えるレベルアップの回数
  weaponLv: 0, // 新しく手に入れる武器（と最初から持つ武器）の、最初のレベルの上乗せ
  // 武器強化（ツリーの「武器強化」の枝）: 要素の分類ごとの底上げ。tree-fort-elements.js の CAT を参照
  wdmg: 0, // 威力 +%（0.1 = +10%）
  wrate: 0, // 連射: 間隔 −%
  wsize: 0, // 範囲 +%
  wcount: 0, // 数 +（弾数・本数・機数・刃の数など）
  wtime: 0, // 持続 +%
  // 属性（ツリーの「属性」の枝）: その属性の与ダメージ +%（0.2 = +20%）。対応するタグは ATTR_TAGS
  tfire: 0, tice: 0, tlightning: 0, tpoison: 0, tlight: 0, tgravity: 0,
  choices: 3, // レベルアップの選択肢の数
};

export const UNLOCKS = {
  bomb: { name: '爆弾砲', desc: '敵の群れに爆発を撃ち込む' },
  lightning: { name: '雷撃', desc: '敵から敵へ連鎖する雷' },
  blade: { name: '回転刃', desc: '砦の周りを回って近づく敵を斬る' },
};

// ツリーの値段の倍率（獲得ポイントはそのままで、買い物を重くする）
const COST_MUL = 2.5;
const TREE_BASE = [
  { id: 'core', name: '砦の核', desc: 'ここから枝が伸びる', cost: 0, gx: 0, gy: 0, req: [], mark: '核' },

  // 上: 攻撃
  { id: 'atk1', name: '鋭い弾', desc: '攻撃力 +2', cost: 10, gx: 0, gy: -1, req: ['core'], fx: { dmg: 2 }, mark: '攻' },
  { id: 'atk2', name: '強い弾', desc: '攻撃力 +3', cost: 25, gx: 0, gy: -2, req: ['atk1'], fx: { dmg: 3 }, mark: '攻' },
  { id: 'atk3', name: '貫通弾', desc: '弾が敵を 1 体貫通する', cost: 60, gx: 0, gy: -3, req: ['atk2'], fx: { pierce: 1 }, mark: '貫' },
  { id: 'atk4', name: '会心', desc: '会心率 +20%（ダメージ 2 倍）', cost: 100, gx: 0, gy: -4, req: ['atk3'], fx: { crit: 0.2 }, mark: '会' },
  { id: 'atk5', name: '爆弾砲', desc: '爆弾を最初から装備して出撃（新しい攻撃）', cost: 160, gx: 0, gy: -5, req: ['atk4'], unlock: 'bomb', mark: '爆' },

  // 右: 速さ・射程
  { id: 'spd1', name: '連射 I', desc: '連射速度 +25%', cost: 10, gx: 1, gy: 0, req: ['core'], fx: { rate: 0.25 }, mark: '速' },
  { id: 'spd2', name: '連射 II', desc: '連射速度 +30%', cost: 30, gx: 2, gy: 0, req: ['spd1'], fx: { rate: 0.3 }, mark: '速' },
  { id: 'spd3', name: 'ダブルショット', desc: '同時に狙う数 +1', cost: 80, gx: 3, gy: 0, req: ['spd2'], fx: { targets: 1 }, mark: '二' },
  { id: 'spd4', name: '遠視', desc: '射程 +30', cost: 55, gx: 4, gy: 0, req: ['spd3'], fx: { range: 30 }, mark: '射' },
  { id: 'spd5', name: '雷撃', desc: '雷撃を最初から装備して出撃（新しい攻撃）', cost: 170, gx: 5, gy: 0, req: ['spd4'], unlock: 'lightning', mark: '雷' },

  // 左: 守り
  { id: 'def1', name: '装甲 I', desc: '耐久 +30', cost: 10, gx: -1, gy: 0, req: ['core'], fx: { hp: 30 }, mark: '守' },
  { id: 'def2', name: '修復', desc: '毎秒 +1.5 回復', cost: 30, gx: -2, gy: 0, req: ['def1'], fx: { regen: 1.5 }, mark: '治' },
  { id: 'def3', name: '装甲 II', desc: '耐久 +60', cost: 70, gx: -3, gy: 0, req: ['def2'], fx: { hp: 60 }, mark: '守' },
  { id: 'def4', name: '防壁', desc: '受けるダメージ -20%', cost: 100, gx: -4, gy: 0, req: ['def3'], fx: { reduce: 0.2 }, mark: '壁' },
  { id: 'def5', name: '回転刃', desc: '回転刃を最初から装備して出撃（新しい攻撃）', cost: 150, gx: -5, gy: 0, req: ['def4'], unlock: 'blade', mark: '刃' },

  // 下: 経済・補助
  { id: 'eco1', name: '報酬 I', desc: 'ポイント +25%', cost: 15, gx: 0, gy: 1, req: ['core'], fx: { pointMul: 0.25 }, mark: '金' },
  { id: 'eco2', name: '守りの褒賞', desc: '波ごとのボーナス +4', cost: 40, gx: 0, gy: 2, req: ['eco1'], fx: { waveBonus: 4 }, mark: '褒' },
  { id: 'eco3', name: '報酬 II', desc: 'ポイント +35%', cost: 90, gx: 0, gy: 3, req: ['eco2'], fx: { pointMul: 0.35 }, mark: '金' },
  { id: 'eco4', name: '凍てつく結界', desc: '砦の近くの敵が 35% 遅くなる', cost: 110, gx: 0, gy: 4, req: ['eco3'], fx: { slow: 0.35 }, mark: '凍' },
  { id: 'eco5', name: '吸収', desc: '敵を倒すと耐久が 0.6 回復', cost: 150, gx: 0, gy: 5, req: ['eco4'], fx: { leech: 0.6 }, mark: '吸' },

  // 斜め: 成長（挑戦中のレベルアップを助ける）
  { id: 'grw1', name: '経験値 I', desc: '経験値 +20%', cost: 20, gx: 1, gy: 1, req: ['core'], fx: { xpMul: 0.2 }, mark: '経' },
  { id: 'grw2', name: '選び直し', desc: 'レベルアップの選び直し +1 回', cost: 50, gx: 2, gy: 2, req: ['grw1'], fx: { rerolls: 1 }, mark: '振' },
  { id: 'grw3', name: '先行成長', desc: '出撃の直後に、レベルアップを 1 回行える', cost: 100, gx: 3, gy: 3, req: ['grw2'], fx: { startPicks: 1 }, mark: '先' },
  { id: 'grw4', name: '選択肢 +1', desc: 'レベルアップの選択肢が 4 つになる', cost: 160, gx: 4, gy: 4, req: ['grw3'], fx: { choices: 1 }, mark: '四' },
  { id: 'wlv1', name: '武器の素質 I', desc: '武器を最初から Lv2 で手に入れる', cost: 120, gx: 2, gy: 3, req: ['grw2'], fx: { weaponLv: 1 }, mark: '武' },
  { id: 'wlv2', name: '武器の素質 II', desc: '武器を最初から Lv3 で手に入れる', cost: 400, gx: 3, gy: 4, req: ['wlv1', 'grw3'], fx: { weaponLv: 1 }, mark: '武' },
  // 武器強化: 全武器を、威力・連射・範囲・数・持続の 5 分類で底上げする（I → II）。左上へ斜めに伸びる
  { id: 'arm1', name: '威力 I', desc: '全武器の威力 +10%', cost: 24, gx: -1, gy: -1, req: ['core'], fx: { wdmg: 0.1 }, mark: '威' },
  { id: 'arm2', name: '連射 I', desc: '全武器の待ち時間 −10%', cost: 32, gx: -2, gy: -2, req: ['arm1'], fx: { wrate: 0.1 }, mark: '連' },
  { id: 'arm3', name: '範囲 I', desc: '全武器の範囲（爆発・射程・太さ）+10%', cost: 40, gx: -3, gy: -3, req: ['arm2'], fx: { wsize: 0.1 }, mark: '範' },
  { id: 'arm4', name: '数 I', desc: '全武器の数（弾数・本数・機数・刃の数）+1', cost: 80, gx: -4, gy: -4, req: ['arm3'], fx: { wcount: 1 }, mark: '数' },
  { id: 'arm5', name: '持続 I', desc: '全武器の持続（雲・井戸・凍結・照射）+15%', cost: 48, gx: -5, gy: -5, req: ['arm4'], fx: { wtime: 0.15 }, mark: '持' },
  { id: 'arm6', name: '威力 II', desc: '全武器の威力 +10%（さらに）', cost: 72, gx: -1, gy: -2, req: ['arm1'], fx: { wdmg: 0.1 }, mark: '威' },
  { id: 'arm7', name: '連射 II', desc: '全武器の待ち時間 −10%（さらに）', cost: 88, gx: -2, gy: -3, req: ['arm2', 'arm6'], fx: { wrate: 0.1 }, mark: '連' },
  { id: 'arm8', name: '範囲 II', desc: '全武器の範囲 +10%（さらに）', cost: 104, gx: -3, gy: -4, req: ['arm3', 'arm7'], fx: { wsize: 0.1 }, mark: '範' },
  { id: 'arm9', name: '数 II', desc: '全武器の数 +1（さらに）', cost: 160, gx: -4, gy: -5, req: ['arm4', 'arm8'], fx: { wcount: 1 }, mark: '数' },
  { id: 'arm10', name: '持続 II', desc: '全武器の持続 +15%（さらに）', cost: 112, gx: -5, gy: -6, req: ['arm5', 'arm9'], fx: { wtime: 0.15 }, mark: '持' },
  // 属性: その属性の武器のダメージ +20%（遺物と重なる）。右上へ斜めに伸びる
  { id: 'elem1', name: '火の祝福', desc: '火属性のダメージ +20%（爆弾・火炎放射・ミサイル・流星）', cost: 60, gx: 1, gy: -1, req: ['core'], fx: { tfire: 0.2 }, mark: '火' },
  { id: 'elem2', name: '氷の祝福', desc: '氷属性のダメージ +20%（氷結弾）', cost: 60, gx: 2, gy: -2, req: ['elem1'], fx: { tice: 0.2 }, mark: '氷' },
  { id: 'elem3', name: '雷の祝福', desc: '雷属性のダメージ +20%（雷撃）', cost: 60, gx: 3, gy: -3, req: ['elem2'], fx: { tlightning: 0.2 }, mark: '雷' },
  { id: 'elem4', name: '毒の祝福', desc: '毒属性のダメージ +20%（毒霧）', cost: 60, gx: 4, gy: -4, req: ['elem3'], fx: { tpoison: 0.2 }, mark: '毒' },
  { id: 'elem5', name: '光・機械の祝福', desc: '光・機械属性のダメージ +20%（レーザー・ドローン）', cost: 60, gx: 5, gy: -5, req: ['elem4'], fx: { tlight: 0.2 }, mark: '光' },
  { id: 'elem6', name: '重力・物理の祝福', desc: '重力・物理属性のダメージ +20%（重力井戸・地雷・回転刃・ミサイル・タップ）', cost: 60, gx: 6, gy: -6, req: ['elem5'], fx: { tgravity: 0.2 }, mark: '重' },
  { id: 'grw5', name: '経験値 II', desc: '経験値 +35%', cost: 220, gx: 5, gy: 5, req: ['grw4'], fx: { xpMul: 0.35 }, mark: '経' },
];

export const TREE = TREE_BASE.map((n) => ({ ...n, cost: Math.round((n.cost * COST_MUL) / 5) * 5 }));
export const NODE = Object.fromEntries(TREE.map((n) => [n.id, n]));

// 属性の枝の能力値 → 効くダメージのタグ（燃焼・毒は、その属性の継続ダメージ）
export const ATTR_TAGS = {
  tfire: ['fire', 'burn'], tice: ['ice'], tlightning: ['lightning'], tpoison: ['poison', 'toxic'], tlight: ['light', 'machine'], tgravity: ['gravity', 'physical'],
};

export const START_OWNED = ['core'];

// 取得済みノード（id の配列または Set）から能力値を求める
export function computeStats(owned) {
  const set = owned instanceof Set ? owned : new Set(owned);
  const st = { ...BASE_STATS, weapons: { bomb: false, lightning: false, blade: false } };
  for (const n of TREE) {
    if (!set.has(n.id)) continue;
    if (n.fx) for (const [k, v] of Object.entries(n.fx)) st[k] += v;
    if (n.unlock) st.weapons[n.unlock] = true;
  }
  st.crit = Math.min(1, st.crit);
  st.reduce = Math.min(0.8, st.reduce);
  st.slow = Math.min(0.7, st.slow);
  return st;
}

// ノード id を取得できるか（前提がそろい、ポイントが足りる）
export function canBuy(owned, points, id) {
  const n = NODE[id];
  if (!n || owned.has(id)) return { ok: false, why: '取得済み' };
  if (!n.req.every((r) => owned.has(r))) return { ok: false, why: '前の枝が必要' };
  if (points < n.cost) return { ok: false, why: 'ポイント不足' };
  return { ok: true, why: '' };
}

// 返却（払い戻し）できるか。これを前提にしている取得済みノードがあるとできない。核は不可。
export function canRefund(owned, id) {
  if (id === 'core' || !owned.has(id)) return { ok: false, why: '' };
  const dep = TREE.find((n) => owned.has(n.id) && n.req.includes(id));
  if (dep) return { ok: false, why: `先に「${dep.name}」を戻す` };
  return { ok: true, why: '' };
}

// ツリーのノードで解放される武器（Lv1 を無料で得る）
export const TREE_WEAPON_NODE = { bomb: 'atk5', lightning: 'spd5', blade: 'def5' };

// 武器の現在のレベル。ツリーのノードで解放された武器は、最低でも Lv1。
export const weaponLevelOf = (owned, levels, id) => Math.max(levels[id] || 0, TREE_WEAPON_NODE[id] && owned.has(TREE_WEAPON_NODE[id]) ? 1 : 0);
