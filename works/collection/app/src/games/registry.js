// 収録ゲーム一覧。load が null のものはメニューで「準備中」と表示される。
export const GAMES = [
  { id: 'cave-heli', title: '洞窟ヘリ', desc: '長押しで上昇', load: () => import('./cave-heli.js') },
  { id: 'bike-dash', title: '坂道ダッシュ', desc: 'タップでジャンプ', load: () => import('./bike-dash.js') },
  { id: 'thread-needle', title: '糸通し', desc: 'タップで糸を上げる', load: null },
  { id: 'poyo-jump', title: 'ポヨジャンプ', desc: '左右で足場を登る', load: null },
  { id: 'madam-fly', title: 'マダム飛行', desc: 'タップで上昇', load: null },
  { id: 'beach-volley', title: '砂浜バレー', desc: '3タッチで打ち返す', load: null },
];
