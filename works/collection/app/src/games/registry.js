// 収録ゲーム一覧。load が null のものはメニューで「準備中」と表示される。
export const GAMES = [
  { id: 'cave-heli', title: '洞窟ヘリ', desc: '長押しで上昇', load: () => import('./cave-heli.js') },
  { id: 'bike-dash', title: '自転車ダッシュ', desc: 'タップでジャンプ', load: () => import('./bike-dash.js') },
  { id: 'shooter', title: '縦シューティング', desc: 'ドラッグで移動', load: null },
  { id: 'irairabou', title: 'イライラ棒', desc: '指でなぞる', load: null },
  { id: 'chain-puzzle', title: '連鎖パズル', desc: '落ちる玉をそろえる', load: null },
  { id: 'loop-puzzle', title: 'ループパズル', desc: '線をつないで輪を作る', load: null },
  { id: 'climb', title: 'ひたすら登る', desc: '足場をジャンプ', load: null },
];
