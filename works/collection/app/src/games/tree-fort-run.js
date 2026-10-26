// ツリー砦: 1 回の挑戦（ラン）の中の成長。敵を倒して経験値をため、レベルアップごとに 3 択から選ぶ。
// 画面や通信とは独立（ここでは「選択肢を作る」「選んだ結果を反映する」だけ）。
import { WEAPONS, WEAPON, SYNERGY, SLOT_MAX, maxLevelOf, activeSynergies } from './tree-fort-weapons.js';

// 次のレベルまでに必要な経験値（xpMul はツリーの強化で増える）
export const xpNeed = (level, xpMul = 1) => Math.max(6, Math.round((6 + 6 * level + 0.8 * level * level) / xpMul));

// 新しい武器の最初のレベル（ツリーの「武器の素質」で上がる）
export const startLevel = (id, stats) => Math.min(maxLevelOf(id), 1 + Math.floor((stats && stats.weaponLv) || 0));

// その挑戦の間だけ効くステータス強化
export const STAT_OPTIONS = [
  { id: 'dmg', name: '攻撃力アップ', desc: '主砲・武器のダメージ +25%', color: '#ff7a8a', apply: (st) => { st.dmg *= 1.25; } },
  { id: 'rate', name: '連射アップ', desc: '連射速度 +22%', color: '#ffd84a', apply: (st) => { st.rate *= 1.22; } },
  { id: 'range', name: '射程アップ', desc: '射程 +14', color: '#7fd6ff', apply: (st) => { st.range += 14; } },
  { id: 'hp', name: '装甲アップ', desc: '耐久 +30（その分回復）', color: '#7dff8a', apply: (st, ctx) => { st.hp += 30; ctx.tower.max += 30; ctx.tower.hp += 30; } },
  { id: 'crit', name: '会心アップ', desc: '会心率 +10%', color: '#ff9ae8', apply: (st) => { st.crit = Math.min(1, st.crit + 0.1); } },
  { id: 'regen', name: '修復アップ', desc: '毎秒の回復 +1.2', color: '#9affc8', apply: (st) => { st.regen += 1.2; } },
  { id: 'pierce', name: '貫通アップ', desc: '主砲が敵をさらに 1 体貫通（最大 3）', color: '#fff2a0', apply: (st) => { st.pierce = Math.min(3, st.pierce + 1); }, max: 3 },
  { id: 'target', name: 'マルチショット', desc: '同時に狙う数 +1（最大 4）', color: '#c9a3ff', apply: (st) => { st.targets = Math.min(4, st.targets + 1); }, max: 4 },
];
const STAT = Object.fromEntries(STAT_OPTIONS.map((s) => [s.id, s]));

const UNKNOWN = { name: '？？？', color: '#b8a0ff' };

// 強化の前後の値を「現在 12 → 15」の形で返す（その場で複製して適用し、差を読む）
const STAT_KEY = { target: 'targets' };
const STAT_PCT = new Set(['crit']);
function statNote(s, stats, tower) {
  const key = STAT_KEY[s.id] || s.id;
  const after = { ...stats };
  s.apply(after, { tower: { max: tower.max, hp: tower.hp } });
  const f = (v) => (STAT_PCT.has(key) ? `${Math.round(v * 100)}%` : `${Math.round(v * 10) / 10}`);
  return `現在 ${f(stats[key])} → ${f(after[key])}`;
}

// 選択肢を作る。ctx: { rng, stats, loadout, slots, discovered, g（その時点の難しさ）, tower, count }
export function makeOptions(ctx) {
  const { rng, stats, loadout, slots, discovered, g, tower } = ctx;
  const count = ctx.count || 3;
  const have = new Set(loadout.map((w) => w.id));
  const cand = [];

  for (const w of loadout) {
    if (w.level >= maxLevelOf(w.id)) continue;
    const def = WEAPON[w.id];
    cand.push({
      weight: 40 + (w.level <= 2 ? 10 : 0), // Lv10 まで育てやすいよう、強化の選択肢は出やすい
      opt: { kind: 'weapon-up', id: w.id, name: def.name, color: def.color, level: w.level + 1, desc: def.levels[w.level], label: `Lv${w.level} → Lv${w.level + 1}` },
    });
  }
  if (loadout.length < Math.min(slots, SLOT_MAX)) {
    const before = activeSynergies(have);
    for (const def of WEAPONS) {
      if (have.has(def.id)) continue;
      const after = activeSynergies([...have, def.id]);
      const synNew = [...after].filter((s) => !before.has(s));
      const newSyn = synNew.length;
      const synNote = newSyn ? `★ 組み合わせ【${synNew.map((s) => SYNERGY[s].name).join('・')}】が発動` : '';
      if (discovered.has(def.id)) {
        cand.push({
          weight: 22 + (newSyn ? 16 : 0) + (loadout.length === 0 ? 20 : 0),
          opt: { kind: 'weapon-new', id: def.id, name: def.name, color: def.color, level: 1, desc: def.levels[0], label: 'NEW', star: newSyn > 0, note: synNote },
        });
      } else {
        // まだ見つけていない武器は「？？？」として出る。波が進むほど出やすい。
        cand.push({
          weight: Math.min(28, 8 + g * 1.3) * (loadout.length === 0 ? 0.4 : 1),
          opt: { kind: 'weapon-new', id: def.id, name: UNKNOWN.name, color: UNKNOWN.color, level: 1, desc: '未知の武器。選ぶと正体が分かる', label: 'NEW?', unknown: true, star: newSyn > 0, note: newSyn ? '★ 持っている武器と組み合わせ効果がある' : '' },
        });
      }
    }
  }
  for (const s of STAT_OPTIONS) {
    if (s.max && (stats[s.id === 'target' ? 'targets' : s.id] || 0) >= s.max) continue;
    cand.push({ weight: 9, opt: { kind: 'stat', id: s.id, name: s.name, color: s.color, desc: s.desc, label: 'ステータス', note: statNote(s, stats, tower) } });
  }
  const dmgd = tower.hp < tower.max * 0.7;
  cand.push({ weight: dmgd ? 14 : 3, opt: { kind: 'heal', id: 'heal', name: '応急修理', color: '#7dff8a', desc: '耐久を 40% 回復', label: '回復' } });

  // 重みつきで、重複なく選ぶ
  const out = [];
  const pool = cand.slice();
  while (out.length < count && pool.length) {
    const total = pool.reduce((a, c) => a + c.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    out.push(pool.splice(idx, 1)[0].opt);
  }
  // 武器が 1 つもないうちは、必ず武器が選べるようにする
  if (loadout.length === 0 && !out.some((o) => o.kind === 'weapon-new')) {
    const w = cand.filter((c) => c.opt.kind === 'weapon-new' && !c.opt.unknown).sort((a, b) => b.weight - a.weight)[0];
    if (w) out[out.length - 1] = w.opt;
  }
  return out;
}

// 選んだ結果を反映する。ctx: { stats, loadout, discovered, tower, refresh(), found（新しく見つけた武器の記録）}
export function applyOption(ctx, opt) {
  if (opt.kind === 'weapon-new') {
    ctx.loadout.push({ id: opt.id, level: startLevel(opt.id, ctx.stats) });
    if (!ctx.discovered.has(opt.id)) {
      ctx.discovered.add(opt.id);
      ctx.found.push(opt.id);
    }
    ctx.refresh();
  } else if (opt.kind === 'weapon-up') {
    const w = ctx.loadout.find((x) => x.id === opt.id);
    if (w && w.level < maxLevelOf(w.id)) w.level++;
    ctx.refresh();
  } else if (opt.kind === 'stat') {
    STAT[opt.id].apply(ctx.stats, ctx);
  } else if (opt.kind === 'heal') {
    ctx.tower.hp = Math.min(ctx.tower.max, ctx.tower.hp + ctx.tower.max * 0.4);
  }
}

// 画面なしのシミュレーション用の選び方（人間が選ぶ代わり）。武器 > 相性◎ > ステータスの順に好む。
export function autoPick(options) {
  const score = (o) => {
    if (o.kind === 'weapon-new') return (o.unknown ? 5.2 : 5.5) + (o.star ? 2 : 0);
    if (o.kind === 'weapon-up') return 4.5;
    if (o.kind === 'stat') return o.id === 'dmg' ? 3.4 : o.id === 'rate' ? 3.2 : 2.6;
    return 1;
  };
  let best = 0;
  options.forEach((o, i) => {
    if (score(o) > score(options[best])) best = i;
  });
  return best;
}
