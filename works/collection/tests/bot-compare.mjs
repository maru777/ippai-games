// 放置ボットとタップボット（0.4 秒ごとに一番近い敵をタップ）で、同じ砦・ステージのクリア率を比べる（バランス調整用。テストではない）。
// 放置でもクリアできるなら、プレイヤーの操作が効いていない。実行: node works/collection/tests/bot-compare.mjs
import { createBattle } from '../app/src/games/tree-fort-battle.js';
import { autoPick } from '../app/src/games/tree-fort-run.js';
import { computeStats, START_OWNED, TREE } from '../app/src/games/tree-fort-data.js';
import { WEAPONS } from '../app/src/games/tree-fort-weapons.js';
const ALL = new Set(WEAPONS.map(w=>w.id));
const MID = ['core','atk1','atk2','spd1','spd2','def1','def2','def3','eco1','grw1','grw2'];
function run(st, owned, stage, tapping, seed) {
  let s=seed; const rng=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const sim=createBattle(computeStats(new Set(owned)), rng, {stage, leveling:true, slots:3, discovered:ALL});
  const dt=1/30; let tapT=0;
  for (let t=0;t<1800 && !sim.b.over;t+=dt){
    while(sim.b.options||sim.b.relicOpts||sim.b.event){ if(sim.b.options) sim.pick(autoPick(sim.b.options)); else if(sim.b.relicOpts) sim.chooseRelic(0); else sim.chooseContract(0); }
    sim.overdrive();
    if (tapping) { tapT-=dt; if (tapT<=0) { const es=sim.b.enemies.filter(e=>!e.dead); if(es.length){ const e=es.sort((a,b)=>Math.hypot(a.x-120,a.y-172)-Math.hypot(b.x-120,b.y-172))[0]; sim.tap(e.x,e.y);} tapT=0.3; } }
    sim.step(dt);
  }
  return {cl:sim.b.cleared?1:0, wave:sim.b.wave, lv:sim.b.level};
}
const FULL = TREE.map((n) => n.id);
for (const [name, owned, stage] of [['初期 st1', START_OWNED, 1], ['中盤 st2', MID, 2], ['中盤 st3', MID, 3], ['中盤 st5', MID, 5], ['全ツリー st5', FULL, 5], ['全ツリー st8', FULL, 8], ['全ツリー st10', FULL, 10]]) {
  for (const tapping of [false, true]) {
    let cl=0,w=0,lv=0; const N=12;
    for (let i=0;i<N;i++){ const r=run(0,owned,stage,tapping,100+i); cl+=r.cl; w+=r.wave; lv+=r.lv; }
    console.log(name, tapping?'タップ':'放置', 'clear',cl+'/'+N,'wave',(w/N).toFixed(1),'lv',(lv/N).toFixed(1));
  }
}
