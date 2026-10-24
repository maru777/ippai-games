// 収録ゲーム一覧。load が null のものはメニューで「準備中」と表示される。
// tab: 'action'（アクション）/ 'board'（ボード対戦）。メニューのタブ分けに使う。
export const GAMES = [
  { id: 'cave-heli', title: '洞窟ヘリ', desc: '長押しで上昇', tab: 'action', load: () => import('./cave-heli.js') },
  { id: 'bike-dash', title: '坂道ダッシュ', desc: 'タップでジャンプ', tab: 'action', load: () => import('./bike-dash.js') },
  { id: 'thread-needle', title: '糸通し', desc: 'タップで糸を上げる', tab: 'action', load: () => import('./thread-needle.js') },
  { id: 'poyo-jump', title: 'ポヨジャンプ', desc: 'ドラッグで足場を登る', tab: 'action', load: () => import('./poyo-jump.js') },
  { id: 'madam-fly', title: 'マダム飛行', desc: '長押しで上昇', tab: 'action', load: () => import('./madam-fly.js') },
  { id: 'beach-volley', title: '砂浜バレー', desc: '3タッチで打ち返す', tab: 'action', load: () => import('./beach-volley.js') },
  { id: 'mari-adventure', title: 'マリさんの冒険', desc: '横スクロール 全3面', tab: 'action', load: () => import('./mari-adventure.js') },
  { id: 'wall-race', title: 'かべレース', desc: 'CPU・オンライン対戦', tab: 'board', load: () => import('./wall-race.js') },
  { id: 'reversi', title: 'リバーシ', desc: '石を挟んで裏返す', tab: 'board', load: () => import('./reversi.js') },
  { id: 'four', title: '四目並べ', desc: '石を落として4つ並べる', tab: 'board', load: () => import('./four.js') },
  { id: 'dots', title: 'ドット囲み', desc: '線を引いて箱を取る', tab: 'board', load: () => import('./dots.js') },
];
