// ツリー砦: オーバードライブ（OD）のデータと計算。画面なし。
//   OD = 敵を倒すとゲージがたまり、満タンでタップすると、数秒間強くなる。
//   タイプ（1 つ装備）で、発動の瞬間の効果と、強化の中身が変わる。強化（持続・充電・威力）はポイントで買う。
//   戦闘外の「OD 工房」で選ぶ・買う。戦闘は odConfig(od) の結果だけを読む。
export const OD_BASE_SEC = 8;
export const OD_MAX_LV = 5;

// dmg: OD 中のダメージ倍率 / speed: 攻撃の勢い / slow: 敵の動く速さ（小さいほど遅い）/ reduce: 受けるダメージ（小さいほど減る）
export const OD_TYPES = [
  { id: 'boost', name: '加速', color: '#ffd84a', price: 0, dmg: 1.25, speed: 1.7, slow: 1, reduce: 1, fire: 1,
    desc: '攻撃速度 1.7 倍・ダメージ 1.25 倍', start: 'なし（すぐ強くなる）' },
  { id: 'blast', name: '爆裂', color: '#ff8a3c', price: 250, dmg: 1.15, speed: 1.3, slow: 1, reduce: 1, fire: 1.3,
    desc: '火の威力 +30%・攻撃速度 1.3 倍', start: '全員を爆破（致命傷の瞬間にも自動発動）' },
  { id: 'frost', name: '氷結', color: '#9fe8ff', price: 250, dmg: 1.1, speed: 1.3, slow: 0.6, reduce: 1, fire: 1,
    desc: '敵の動き 40% 減・攻撃速度 1.3 倍', start: '全員を 2 秒凍らせる' },
  { id: 'regen', name: '再生', color: '#7dff8a', price: 250, dmg: 1.1, speed: 1.3, slow: 1, reduce: 0.6, fire: 1,
    desc: '受けるダメージ 40% 減・攻撃速度 1.3 倍', start: '耐久が 25% 回復' },
];
export const OD_TYPE = Object.fromEntries(OD_TYPES.map((t) => [t.id, t]));

// 強化。costs[i] = Lv(i+1) にするための費用
export const OD_UPGRADES = [
  { id: 'dur', name: '持続時間', unit: '+1 秒', costs: [80, 140, 220, 330, 470], desc: 'ODが続く時間が、1 秒ずつ延びる' },
  { id: 'charge', name: '充電速度', unit: '+15%', costs: [80, 140, 220, 330, 470], desc: 'ゲージのたまる速さが、15% ずつ上がる' },
  { id: 'power', name: '威力', unit: '+6%', costs: [100, 170, 260, 380, 540], desc: 'OD 中のダメージが 6% ずつ増え、発動の瞬間の効果も強くなる' },
];
export const OD_UPGRADE = Object.fromEntries(OD_UPGRADES.map((u) => [u.id, u]));

export const defaultOd = () => ({ type: 'boost', owned: ['boost'], lv: { dur: 0, charge: 0, power: 0 } });

// 保存データを整える（壊れた値・知らない id は捨てる）
export function sanitizeOd(raw) {
  const od = defaultOd();
  if (!raw || typeof raw !== 'object') return od;
  const owned = new Set(['boost']);
  if (Array.isArray(raw.owned)) for (const id of raw.owned) if (OD_TYPE[id]) owned.add(id);
  od.owned = [...owned];
  od.type = owned.has(raw.type) ? raw.type : 'boost';
  for (const u of OD_UPGRADES) {
    const v = Math.floor(Number(raw.lv && raw.lv[u.id]) || 0);
    od.lv[u.id] = Math.max(0, Math.min(OD_MAX_LV, v));
  }
  return od;
}

// 戦闘が読む設定
export function odConfig(od = defaultOd()) {
  const t = OD_TYPE[od.type] || OD_TYPE.boost;
  const p = od.lv.power;
  return {
    id: t.id, def: t,
    dur: OD_BASE_SEC + od.lv.dur,
    chargeK: 1 + 0.15 * od.lv.charge,
    dmgK: t.dmg * (1 + 0.06 * p),
    effK: 1 + 0.15 * p, // 発動の瞬間の効果の強さ
    speedK: t.speed, slowK: t.slow, reduceK: t.reduce, fireK: t.fire,
  };
}

// 次に払う費用（買えない・最大なら null）
export function odCost(od, kind, id) {
  if (kind === 'type') return od.owned.includes(id) ? null : OD_TYPE[id].price;
  const lv = od.lv[id];
  return lv >= OD_MAX_LV ? null : OD_UPGRADE[id].costs[lv];
}

// 買う・強化する・装備する。points は呼び出し側が持つ（ここでは減らさず、払った額を返す）
export function odAct(od, points, kind, id) {
  if (kind === 'type') {
    if (!od.owned.includes(id)) {
      const c = OD_TYPE[id].price;
      if (points < c) return { ok: false, why: 'ポイント不足' };
      od.owned.push(id);
      od.type = id;
      return { ok: true, paid: c, did: 'buy' };
    }
    if (od.type === id) return { ok: false, why: '装備中' };
    od.type = id;
    return { ok: true, paid: 0, did: 'equip' };
  }
  const c = odCost(od, 'up', id);
  if (c === null) return { ok: false, why: '最大' };
  if (points < c) return { ok: false, why: 'ポイント不足' };
  od.lv[id]++;
  return { ok: true, paid: c, did: 'up' };
}

// 戦闘中、OD ボタンをタップしたけれどまだ使えないときの説明（toast の形）
export function odInfoToast(od) {
  const t = od.cfg.def;
  const pct = Math.floor(od.gauge);
  return {
    icon: 'lightning', color: t.color, t: 4,
    title: od.active > 0 ? `OD「${t.name}」発動中` : `OD「${t.name}」 充電 ${pct}%`,
    sub: `満タンでタップ: ${od.cfg.dur} 秒間 ${t.desc}`,
  };
}
