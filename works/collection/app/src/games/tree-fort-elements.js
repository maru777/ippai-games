// ツリー砦: 武器の「要素」。武器ごとに 5 つの要素（威力・弾数・爆発サイズ…）を、レベル（1〜10）の関数として持つ。
// 戦闘中の動き（tree-fort-weapons.js）も、画面の表示（武器をタップしたときの要素の一覧・強化カード）も、ここの式を読む。
//   値の式は get(L)。Lv10（MAX）は、Lv9 と同じ動きに、威力 ×1.25 と、いくつかの特典（kind: 'atk' の表示に ×1.25、ほか各要素に書いた L >= 10 の値）。
//   kind: 表示の形（atk = 攻撃力の何倍 / sec = 秒 / count = 個数 / len = 距離 / pct = % / deg = 角度 / num = 数値）
//   lower: 小さいほど強い要素（間隔・予告時間）。none: 0 のとき「なし」と書く。
export const MAX_K = 1.25;
const c = (L) => Math.min(L, 9);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

const E = (key, name, kind, get, o = {}) => ({ key, name, kind, get, ...o });

// 回転刃の衝撃波（Lv5〜）: 威力・間隔・半径
export const bladeShock = (L) => (c(L) >= 5 ? { dmg: c(L) >= 8 ? 2.4 : 1.8, every: c(L) >= 8 ? 1.8 : 2.5, r: c(L) >= 8 ? 70 : 56 } : null);

export const ELEMENTS = {
  bomb: [
    E('dmg', '威力', 'atk', (L) => 2.2 + 0.35 * (c(L) - 1)),
    E('radius', '爆発サイズ', 'len', (L) => 30 + 4 * (c(L) - 1)),
    E('cd', '連射（間隔）', 'sec', (L) => Math.max(0.9, 2.6 - 0.2 * (c(L) - 1) - (c(L) >= 8 ? 0.2 : 0)), { lower: true }),
    E('repeat', '追撃爆発', 'count', (L) => 1 + (c(L) >= 3) + (c(L) >= 9), { unit: '回' }),
    E('kids', '子爆弾', 'count', (L) => (c(L) >= 7 ? 6 : c(L) >= 5 ? 4 : 0), { unit: '個', none: true }),
  ],
  lightning: [
    E('dmg', '威力', 'atk', (L) => 1.5 + 0.2 * (c(L) - 1)),
    E('chains', '連鎖数', 'count', (L) => 3 + Math.floor(c(L) / 2) + (c(L) >= 7 ? 2 : 0), { unit: '体' }),
    E('cd', '連射（間隔）', 'sec', (L) => Math.max(0.7, 1.7 - 0.1 * (c(L) - 1) - (c(L) >= 8 ? 0.1 : 0)), { lower: true }),
    E('strikes', '落雷', 'count', (L) => (c(L) >= 9 ? 6 : c(L) >= 5 ? 3 : 0), { unit: 'か所', none: true }),
    E('reach', '連鎖距離', 'len', (L) => 48 + 3 * (c(L) - 1)),
  ],
  blade: [
    E('dmg', '威力', 'atk', (L) => 0.9 + 0.22 * (c(L) - 1)),
    E('count', '刃の数', 'count', (L) => (c(L) >= 9 ? 6 : c(L) >= 7 ? 5 : c(L) >= 5 ? 4 : c(L) >= 3 ? 3 : 2) + (L >= 10 ? 6 : 0), { unit: '枚' }),
    E('radius', '回転半径', 'len', (L) => Math.min(70, 34 + 6 * (c(L) - 1))),
    E('spin', '回転速度', 'num', (L) => 3.2 + 0.2 * c(L), { unit: 'rad/秒' }),
    E('shock', '衝撃波', 'atk', (L) => (bladeShock(L) ? bladeShock(L).dmg : 0), { none: true }),
  ],
  flame: [
    E('dmg', '威力', 'atk', (L) => 0.9 + 0.12 * (c(L) - 1)),
    E('range', '射程', 'len', (L) => Math.min(110, 62 + 6 * (c(L) - 1))),
    E('arc', '扇の広さ', 'deg', (L) => (L >= 10 ? Math.PI : 0.5 + (c(L) >= 3 ? 0.15 : 0) + (c(L) >= 7 ? 0.2 : 0))),
    E('burn', '燃焼ダメージ', 'atk', (L) => 0.5 * (1 + 0.25 * (c(L) - 1)) * (c(L) >= 4 ? 1.3 : 1) * (c(L) >= 8 ? 1.3 : 1), { per: '/秒' }),
    E('cd', '連射（間隔）', 'sec', (L) => Math.max(0.4, 0.9 - 0.05 * c(L)), { lower: true }),
  ],
  frost: [
    E('dmg', '威力', 'atk', (L) => (0.9 + 0.2 * (c(L) - 1)) * (c(L) >= 8 ? 1.2 : 1)),
    E('count', '弾数（方向）', 'count', (L) => (c(L) >= 9 ? 5 : c(L) >= 7 ? 4 : c(L) >= 5 ? 3 : 1), { unit: '発' }),
    E('slow', '鈍足の強さ', 'pct', (L) => 0.4 + 0.03 * (c(L) - 1)),
    E('chance', '凍結確率', 'pct', (L) => Math.min(0.85, 0.1 + 0.08 * (c(L) - 1))),
    E('time', '凍結時間', 'sec', (L) => (c(L) >= 8 ? 2.8 : c(L) >= 5 ? 2.0 : 1.2)),
  ],
  poison: [
    E('dps', '毒ダメージ', 'atk', (L) => 0.7 * (1 + 0.2 * (c(L) - 1)) * (c(L) >= 4 ? 1.2 : 1) * (c(L) >= 8 ? 1.3 : 1), { per: '/秒' }),
    E('size', '雲の大きさ', 'len', (L) => (30 + 3 * c(L)) * (c(L) >= 9 ? 1.25 : 1)),
    E('time', '持続時間', 'sec', (L) => 4 + 0.5 * c(L)),
    E('count', '雲の数', 'count', (L) => (c(L) >= 7 ? 3 : c(L) >= 3 ? 2 : 1), { unit: '個' }),
    E('drift', '追尾', 'num', (L) => (c(L) >= 9 ? 30 : c(L) >= 5 ? 14 : 0), { none: true }),
  ],
  missile: [
    E('dmg', '威力', 'atk', (L) => 1.6 + 0.25 * (c(L) - 1)),
    E('count', '弾数', 'count', (L) => (c(L) >= 9 ? 10 : c(L) >= 7 ? 8 : c(L) >= 5 ? 6 : c(L) >= 3 ? 4 : 2), { unit: '発' }),
    E('aoe', '爆発サイズ', 'len', (L) => (c(L) >= 8 ? 30 : c(L) >= 5 ? 24 : 14)),
    E('turn', '追尾性能', 'num', (L) => (c(L) >= 9 ? 6 : 4)),
    E('cd', '連射（間隔）', 'sec', (L) => Math.max(1.2, 3.0 - 0.2 * c(L)), { lower: true }),
  ],
  laser: [
    E('dmg', '威力', 'atk', (L) => (1.4 + 0.25 * (c(L) - 1)) * (c(L) >= 5 ? 1.5 : 1) * (c(L) >= 8 ? 1.2 : 1), { per: '/本' }),
    E('count', '本数', 'count', (L) => (c(L) >= 9 ? 4 : c(L) >= 7 ? 3 : c(L) >= 3 ? 2 : 1), { unit: '本' }),
    E('width', '太さ', 'len', (L) => Math.min(11, 5 + c(L))),
    E('time', '照射時間', 'sec', (L) => (c(L) >= 8 ? 1.0 : c(L) >= 5 ? 0.7 : 0.3)),
    E('cd', '連射（間隔）', 'sec', (L) => Math.max(1.2, 3.2 - 0.2 * c(L)), { lower: true }),
  ],
  mine: [
    E('dmg', '威力', 'atk', (L) => 2.5 + 0.4 * (c(L) - 1)),
    E('radius', '爆発範囲', 'len', (L) => 26 + 2 * c(L)),
    E('count', '同時設置数', 'count', (L) => (L >= 10 ? 5 : c(L) >= 7 ? 3 : c(L) >= 3 ? 2 : 1), { unit: '個' }),
    E('interval', '設置間隔', 'sec', (L) => (L >= 10 ? 1.2 : c(L) >= 9 ? 1.6 : 2.2), { lower: true }),
    E('chain', '連鎖範囲', 'len', (L) => (L >= 10 ? 90 : c(L) >= 8 ? 70 : c(L) >= 5 ? 48 : 0), { none: true }),
  ],
  gravity: [
    E('radius', '範囲', 'len', (L) => Math.min(150, 44 + 4 * c(L) + (c(L) >= 3 ? 10 : 0))),
    E('pull', '引力', 'num', (L) => 55 + 5 * c(L) + (c(L) >= 4 ? 15 : 0)),
    E('time', '持続時間', 'sec', (L) => 2.2 + 0.3 * c(L)),
    E('dot', '継続ダメージ', 'atk', (L) => 0.35 * (c(L) >= 8 ? 1.6 : 1), { per: '/0.4秒' }),
    E('collapse', '崩壊ダメージ', 'atk', (L) => (c(L) >= 9 ? 6 : c(L) >= 5 ? 3 : 0), { none: true }),
  ],
  meteor: [
    E('dmg', '威力', 'atk', (L) => 3.2 + 0.6 * (c(L) - 1)),
    E('count', '同時発数', 'count', (L) => (c(L) >= 9 ? 5 : c(L) >= 7 ? 4 : c(L) >= 5 ? 3 : c(L) >= 3 ? 2 : 1), { unit: '発' }),
    E('radius', '爆発サイズ', 'len', (L) => 34 + 3 * c(L) + (c(L) >= 8 ? 8 : 0)),
    E('cd', '落下間隔', 'sec', (L) => Math.max(1.4, 3.4 - 0.25 * c(L)), { lower: true }),
    E('delay', '予告時間', 'sec', (L) => Math.max(0.35, 0.7 - 0.04 * (c(L) - 1)), { lower: true }),
  ],
  drone: [
    E('count', '機数', 'count', (L) => 1 + Math.floor(c(L) / 2), { unit: '機' }),
    E('dmg', '威力', 'atk', (L) => 0.7 * (1 + 0.2 * (c(L) - 1)) * (c(L) >= 3 ? 1.15 : 1) * (c(L) >= 7 ? 1.2 : 1), { per: '/発' }),
    E('shots', '連射数', 'count', (L) => (L >= 10 ? 4 : c(L) >= 9 ? 3 : c(L) >= 5 ? 2 : 1), { unit: '連射' }),
    E('cd', '射撃間隔', 'sec', (L) => (L >= 10 ? 0.5 : Math.max(0.55, 0.9 - 0.04 * (c(L) - 1))), { lower: true }),
    E('reach', '射程', 'pct', (L) => 0.95 + 0.02 * (c(L) - 1), { suffix: '（主砲比）' }),
  ],
};

// 要素の分類。ツリーの「武器強化」が、分類ごとに効く（stats.wdmg / wrate / wsize / wcount / wtime）。
//   dmg = 威力 / rate = 連射（間隔が短くなる）/ size = 範囲 / count = 数 / time = 持続。ここにない要素（追撃爆発・子爆弾・落雷・連射数・予告時間・速さ・確率など）は、ツリーでは変わらない。
const CAT = {
  dmg: 'dmg', dps: 'dmg', burn: 'dmg', dot: 'dmg', collapse: 'dmg', shock: 'dmg',
  cd: 'rate', interval: 'rate',
  radius: 'size', size: 'size', aoe: 'size', range: 'size', arc: 'size', width: 'size', reach: 'size',
  count: 'count', chains: 'count',
  time: 'time',
};
for (const list of Object.values(ELEMENTS)) for (const e of list) e.cat = CAT[e.key] || null;
export const CATEGORIES = { dmg: '威力', rate: '連射', size: '範囲', count: '数', time: '持続' };

// ツリーの底上げを掛ける（stats がなければ、そのまま）
export function modValue(e, v, stats) {
  if (!stats || !e.cat) return v;
  switch (e.cat) {
    case 'dmg': return v * (1 + (stats.wdmg || 0));
    case 'rate': return v * (1 - Math.min(0.6, stats.wrate || 0)); // 間隔 −X%（最大 60%）
    case 'size': return e.key === 'arc' ? Math.min(Math.PI, v * (1 + (stats.wsize || 0))) : v * (1 + (stats.wsize || 0));
    case 'count': return v > 0 ? v + Math.floor(stats.wcount || 0) : v;
    case 'time': return v * (1 + (stats.wtime || 0));
    default: return v;
  }
}

// 戦闘が読む式: EV.bomb.dmg(level)。stats を渡すと、ツリーの底上げが掛かった値になる
export const makeEV = (stats) => Object.fromEntries(Object.entries(ELEMENTS).map(([id, list]) => [id, Object.fromEntries(list.map((e) => [e.key, (L) => modValue(e, e.get(L), stats)]))]));
export const EV = makeEV(null);

const isAtk = (e) => e.kind === 'atk';
// 表示用の値（攻撃力の倍率は、MAX のとき ×1.25 を含める）
export const shown = (e, L, stats = null) => modValue(e, isAtk(e) && L >= 10 ? e.get(L) * MAX_K : e.get(L), stats);

// 値の表示（long = 一覧用、short = 強化カードの 1 行用）
export function fmtValue(e, v, short = false) {
  if (e.none && v === 0) return short ? 'なし' : 'なし';
  switch (e.kind) {
    case 'atk': return short ? `×${r2(v)}` : `攻撃力×${r2(v)}${e.per ? ` ${e.per}` : ''}`;
    case 'sec': return short ? `${r2(v)}s` : `${r2(v)} 秒`;
    case 'count': return short ? `${v}` : `${v} ${e.unit || ''}`.trim();
    case 'len': return short ? `${Math.round(v)}` : `半径 ${Math.round(v)}`;
    case 'pct': return `${Math.round(v * 100)}%`;
    case 'deg': return `${Math.round(v * 2 * 57.3)}°`;
    default: return `${r1(v)}${e.unit && !short ? ` ${e.unit}` : ''}`;
  }
}

// その武器の、レベル L の要素の一覧（画面用）。前のレベルからの増減・次のレベルの値・Lv10 までの進み具合つき。
export function weaponElements(id, L, stats = null) {
  return ELEMENTS[id].map((e) => {
    const cur = shown(e, L, stats);
    const prev = L > 1 ? shown(e, L - 1, stats) : null;
    const next = L < 10 ? shown(e, L + 1, stats) : null;
    const v1 = shown(e, 1, stats);
    const v10 = shown(e, 10, stats);
    const span = v10 - v1;
    const ratio = span === 0 ? 1 : Math.max(0, Math.min(1, (cur - v1) / span));
    const gain = prev === null ? 0 : cur - prev; // 正 = 数値が増えた
    const better = e.lower ? gain < 0 : gain > 0;
    return {
      key: e.key, name: e.name, cur: fmtValue(e, cur), short: fmtValue(e, cur, true), curRaw: cur,
      next: next === null ? null : fmtValue(e, next, true), nextRaw: next,
      changed: prev !== null && Math.abs(gain) > 1e-9, better, isNew: prev !== null && prev === 0 && cur > 0,
      delta: prev === null || Math.abs(gain) <= 1e-9 ? '' : (prev === 0 && cur > 0 ? '新規' : `${gain > 0 ? '+' : '−'}${fmtValue({ ...e, none: false, per: '', unit: '' }, Math.abs(gain), true).replace(/^×/, '')}`),
      ratio, // Lv1 を 0、Lv10 を 1 とした進み具合（間隔など、小さいほど強い要素も同じ向き）
    };
  });
}

// 強化カード用: Lv(L) → Lv(L+1) で変わる要素を「名前 現在→次」の短い文にする（最大 n 件）
export function upgradeChanges(id, L, n = 3, stats = null) {
  const out = [];
  for (const e of ELEMENTS[id]) {
    const a = shown(e, L, stats);
    const b = shown(e, L + 1, stats);
    if (Math.abs(a - b) > 1e-9) out.push(`${e.name} ${fmtValue(e, a, true)}→${fmtValue(e, b, true)}`);
  }
  return out.slice(0, n);
}
