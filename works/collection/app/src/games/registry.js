// 収録ゲーム一覧。load が null のものはメニューで「準備中」と表示される。
// world: 'keitai'（ケータイゲーム集）/ 'versus'（対戦・ボード）/ 'puzzle'（パズル＆戦略）。ポータルのタブ分けに使う（世界ごとに見た目と BGM の音色が変わる）。
// genre: 将来、1 つの世界のゲームが増えたときの絞り込み用。scored: true はポータルにベストを表示する。
// href があるものは、別ページ（Godot 版のパズル集など）へ移動する。
export const GAMES = [
  { id: 'cave-heli', title: '洞窟ヘリ', desc: '長押しで上昇', world: 'keitai', genre: 'action', scored: true, load: () => import('./cave-heli.js') },
  { id: 'bike-dash', title: '坂道ダッシュ', desc: 'タップでジャンプ', world: 'keitai', genre: 'action', scored: true, load: () => import('./bike-dash.js') },
  { id: 'thread-needle', title: '糸通し', desc: 'タップで糸を上げる', world: 'keitai', genre: 'action', scored: true, load: () => import('./thread-needle.js') },
  { id: 'poyo-jump', title: 'ポヨジャンプ', desc: 'ドラッグで足場を登る', world: 'keitai', genre: 'action', scored: true, load: () => import('./poyo-jump.js') },
  { id: 'madam-fly', title: 'マダム飛行', desc: '長押しで上昇', world: 'keitai', genre: 'action', scored: true, load: () => import('./madam-fly.js') },
  { id: 'beach-volley', title: '砂浜バレー', desc: '3タッチで打ち返す', world: 'keitai', genre: 'action', scored: true, load: () => import('./beach-volley.js') },
  { id: 'mari-adventure', title: 'マリさんの冒険', desc: '横スクロール 全3面', world: 'keitai', genre: 'action', scored: true, load: () => import('./mari-adventure.js') },
  { id: 'tree-fort', title: 'ルーンタワー', desc: 'ルーンを育てて塔を守る', world: 'puzzle', genre: 'strategy', scored: true, load: () => import('./tree-fort.js') },
  { id: 'wall-race', title: 'こりぽーる', desc: 'CPU・オンライン対戦', world: 'versus', genre: 'board', load: () => import('./wall-race.js') },
  { id: 'isolation', title: 'あいぽれーしょん', desc: 'マスを消して相手を閉じこめる', world: 'versus', genre: 'board', load: () => import('./isolation.js') },
  { id: 'amazons', title: 'あまぽん', desc: 'クイーンと矢で陣地を取る', world: 'versus', genre: 'board', load: () => import('./amazons.js') },
  { id: 'blockade', title: 'ぶろっけーぽん', desc: 'コマ2つで相手の陣地へ', world: 'versus', genre: 'board', load: () => import('./blockade.js') },
  { id: 'santorini', title: 'ぽんとりーに', desc: '積み木を登って3段目へ', world: 'versus', genre: 'board', load: () => import('./santorini.js') },
  { id: 'onitama', title: 'おにぽま', desc: 'カードの動きで師匠を狙う', world: 'versus', genre: 'board', load: () => import('./onitama.js') },
  { id: 'hex', title: 'ぽっくす', desc: '六角の盤で2辺をつなぐ', world: 'versus', genre: 'board', load: () => import('./hex.js') },
  { id: 'reversi', title: 'リバーシ', desc: '石を挟んで裏返す', world: 'versus', genre: 'board', load: () => import('./reversi.js') },
  { id: 'four', title: '四目並べ', desc: '石を落として4つ並べる', world: 'versus', genre: 'board', load: () => import('./four.js') },
  { id: 'dots', title: 'ドット囲み', desc: '線を引いて箱を取る', world: 'versus', genre: 'board', load: () => import('./dots.js') },
  { id: 'puzzle-collection', title: 'パズル集', desc: '色つき出口・色光とミラー', world: 'puzzle', genre: 'puzzle', href: 'puzzle/' },
  { id: 'deck-roguelite', title: '刻印の回廊', desc: 'カードを分解して育てるローグライト', world: 'puzzle', genre: 'strategy', href: 'deck/' },
];
