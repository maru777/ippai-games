// 放置ボットとタップボット（0.3 秒ごとに、一番近い敵をタップ。MAX の大技は、ゲージがたまれば使う）で、ステージのクリア率を比べる（バランス調整用。テストではない）。
// ステージごとに、そのあたりまで進めた想定のツリー（ポイントの予算で、安い順に買う）を使い、「通常の波だけ（ボスなし）」と「ボスあり」を測る。
// 方針（放置でも進める。山場は介入で突破）の目安: ボスなしは、放置 6〜7 割・タップ 9 割以上。ボスありは、放置 1〜3 割・タップ 7〜9 割。
// 使い方: node works/collection/tests/bot-compare.mjs [--stages=1,2,3,5,8,10] [--n=10] [--autoK=0.7] [--bossAutoK=1] [--bossHp=1] [--gstep=5] [--gfirst=4.5] [--cap=70] [--pointK=1] [--bossGrow=0]
import { createBattle, TUNE } from '../app/src/games/tree-fort-battle.js';
import { autoPick, startLevel } from '../app/src/games/tree-fort-run.js';
import { computeStats, TREE, startWeapons } from '../app/src/games/tree-fort-data.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const N = +(args.n || 10);
const STAGES = (args.stages || '1,2,3,5,8,10').split(',').map(Number);
if (args.autoK) TUNE.autoK = +args.autoK;
if (args.bossAutoK) TUNE.bossAutoK = +args.bossAutoK;
if (args.bossHp) TUNE.bossHp = +args.bossHp;
if (args.gstep) TUNE.gstep = +args.gstep;
if (args.gfirst) TUNE.gfirst = +args.gfirst;
if (args.cap) TUNE.waveCap = +args.cap;
if (args.pointK) TUNE.pointK = +args.pointK;
if (args.bossGrow) TUNE.bossGrow = +args.bossGrow;
const ALL = new Set(WEAPONS.map((w) => w.id));
// 各ステージを 1 回ずつクリアして稼いだポイントの目安（pointK = 0.3 のとき）。ツリー全体は約 17,000 P
const BUDGET = { 1: 0, 2: 700, 3: 1600, 4: 2800, 5: 4200, 6: 6000, 7: 8000, 8: 10000, 9: 12500, 10: 15000 };

// 予算で、買えるノードを安い順に買ったツリー
function treeFor(budget) {
  const owned = new Set(['core']);
  let left = budget;
  for (;;) {
    const cand = TREE.filter((n) => !owned.has(n.id) && n.req.every((r) => owned.has(r)) && n.cost <= left).sort((a, b) => a.cost - b.cost);
    if (!cand.length) break;
    owned.add(cand[0].id);
    left -= cand[0].cost;
  }
  return owned;
}

function run(stage, tapping, noBoss, seed) {
  const owned = treeFor(BUDGET[stage] ?? 15000);
  const stats = computeStats(owned);
  const loadout = startWeapons(owned, [], stats).map((id) => ({ id, level: startLevel(id, stats) }));
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sim = createBattle(stats, rng, { stage, leveling: true, slots: 3, discovered: ALL, loadout, noBoss });
  const dt = 1 / 30;
  let tapT = 0;
  for (let t = 0; t < 2400 && !sim.b.over; t += dt) {
    while (sim.b.options || sim.b.relicOpts || sim.b.event) {
      if (sim.b.options) sim.pick(autoPick(sim.b.options));
      else if (sim.b.relicOpts) sim.chooseRelic(0);
      else sim.chooseContract(0);
    }
    sim.overdrive();
    if (tapping) {
      tapT -= dt;
      if (tapT <= 0) {
        const es = sim.b.enemies.filter((e) => !e.dead);
        if (es.length) {
          const e = es.sort((a, b) => Math.hypot(a.x - 120, a.y - 172) - Math.hypot(b.x - 120, b.y - 172))[0];
          sim.tap(e.x, e.y);
        }
        tapT = 0.3;
      }
      for (const w of sim.b.loadout) if (w.level >= 10) sim.ultimate(w.id);
    }
    sim.step(dt);
  }
  return { clear: sim.b.cleared ? 1 : 0, wave: sim.b.wave, sec: sim.b.t, lv: sim.b.level, pts: sim.earned() };
}

const cell = (stage, tapping, noBoss) => {
  let c = 0;
  let sec = 0;
  let wave = 0;
  let pts = 0;
  for (let i = 0; i < N; i++) {
    const r = run(stage, tapping, noBoss, 100 + i);
    c += r.clear;
    sec += r.sec;
    wave += r.wave;
    pts += r.pts;
  }
  return { c, sec: sec / N, wave: wave / N, pts: pts / N };
};
const f = (x) => `${String(x.c).padStart(2)}/${N}`;
console.log(`TUNE ${JSON.stringify(TUNE)}`);
console.log('ステージ 予算 | ボスなし 放置 / タップ | ボスあり 放置 / タップ | 秒(タップ・ボスあり)  到達波(放置・ボスあり)  稼ぎ');
for (const st of STAGES) {
  const a = cell(st, false, true);
  const b = cell(st, true, true);
  const c = cell(st, false, false);
  const d = cell(st, true, false);
  console.log(`st${String(st).padEnd(2)} ${String(BUDGET[st] ?? 15000).padStart(6)} |      ${f(a)} / ${f(b)}     |      ${f(c)} / ${f(d)}      | ${Math.round(d.sec)}s  W${c.wave.toFixed(1)}  稼ぎ(タップ) ${Math.round(d.pts)}P`);
}
