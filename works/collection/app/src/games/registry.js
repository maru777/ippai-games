// 収録ゲーム一覧。load が null のものはメニューで「準備中」と表示される。
export const GAMES = [
  { id: 'cave-heli', title: '洞窟ヘリ', desc: '長押しで上昇', load: () => import('./cave-heli.js') },
  { id: 'bike-dash', title: '坂道ダッシュ', desc: 'タップでジャンプ', load: () => import('./bike-dash.js') },
  { id: 'thread-needle', title: '糸通し', desc: 'タップで糸を上げる', load: () => import('./thread-needle.js') },
  { id: 'poyo-jump', title: 'ポヨジャンプ', desc: 'ドラッグで足場を登る', load: () => import('./poyo-jump.js') },
  { id: 'madam-fly', title: 'マダム飛行', desc: '長押しで上昇', load: () => import('./madam-fly.js') },
  { id: 'beach-volley', title: '砂浜バレー', desc: '3タッチで打ち返す', load: () => import('./beach-volley.js') },
  { id: 'mari-adventure', title: 'マリさんの冒険', desc: '横スクロール 全3面', load: () => import('./mari-adventure.js') },
  { id: 'wall-race', title: 'かべレース', desc: 'オンライン 2 人対戦', load: () => import('./wall-race.js') },
];
