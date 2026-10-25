// シェル: メニュー → 開始待ち → プレイ → ゲームオーバー を管理する。
import { GAMES } from './games/registry.js';
import { Input } from './core/input.js';
import { Sound } from './core/sound.js';
import { Store } from './core/storage.js';
import { Music } from './core/music.js';
import { createPortal } from './portal.js';
import { C, text, rect, frame, inside } from './core/draw.js';

const W = 240;
const BASE_H = 320;
const MAX_H = 520; // 縦長モードの論理高さの上限（さらに細長い端末は上下に細い帯が出る）
let H = BASE_H;
let resScale = 2;
const canvas = document.getElementById('screen');
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;

// 解像度の切り替え。ゲームが hiRes（倍率）を持つときは高解像度で描く（光の表現用）。論理座標は幅 240、高さ H（固定表示は 320）。
function setRes(scale) {
  resScale = scale;
  canvas.width = W * scale;
  canvas.height = H * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.imageSmoothingEnabled = scale > 1;
  canvas.style.imageRendering = scale > 1 ? 'auto' : '';
}

const input = new Input(canvas, W, H);
input.onFirstGesture = () => Sound.unlock();
setRes(2); // 最初はポータル（高解像度）
document.addEventListener('visibilitychange', () => (document.hidden ? Music.suspend() : Music.resume()));

const env = {
  W,
  H,
  sound: Sound,
  input,
  end: () => finish(),
  exit: () => { wantMenu = true; }, // 結果画面を出さずに、そのままメニューへ戻る（更新の終わりで戻る）
};

// menu | loading | ready | play | over
let state = 'menu';
let def = null;
let game = null;
let best = 0;
let newBest = false;
let finalScore = 0;
let overAge = 0;
let wantMenu = false;

// ポータル（メニュー）: 世界タブとスクロールできる一覧。高解像度（×2）で描く。
const portal = createPortal({
  games: GAMES,
  store: Store,
  best: (item) => (item.scored ? `ベスト ${Store.best(item.id)}` : null),
  onSelect: (item) => {
    if (item.href) location.href = item.href; // 別ページのゲーム（パズル集など）へ移動
    else if (item.load) startGame(item);
  },
});
// 画面の上下の余白（縦長のスマホで 3:4 の画面に収めたときの帯）を、画面の最上部・最下部の色に合わせて、全画面っぽく見せる。
// 点滅しないよう、横に数点を読んで中央値を取り（目立つ部品や点滅を無視）、ゆっくり追いかける。
const themeMeta = document.querySelector('meta[name="theme-color"]');
const bar = { top: null, bot: null };
let barFrame = 0;
const median = (v) => v.sort((p, q) => p - q)[v.length >> 1];
function sampleRow(y) {
  const xs = [4, 0.25, 0.5, 0.75, 0.96].map((x) => Math.min(canvas.width - 1, Math.round(x < 1 ? canvas.width * x : x * (canvas.width / W))));
  const px = xs.map((x) => g.getImageData(x, y, 1, 1).data);
  return [0, 1, 2].map((c) => median(px.map((d) => d[c])));
}
function syncBars() {
  if (barFrame++ % 4) return;
  try {
    const now = { top: sampleRow(1), bot: sampleRow(canvas.height - 2) };
    for (const k of ['top', 'bot']) {
      // 初回はそのまま、以後は約 0.4 秒かけて近づく（ポータルのテーマ補間とも合う）
      bar[k] = bar[k] ? bar[k].map((v, i) => v + (now[k][i] - v) * 0.2) : now[k];
    }
    const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
    const bg = `linear-gradient(to bottom, ${css(bar.top)} 50%, ${css(bar.bot)} 50%)`;
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    if (themeMeta) themeMeta.content = css(bar.top);
  } catch (e) {
    // 読み取れない環境では、帯の色は既定のままにする
  }
}
const BTN_RETRY = { x: 30, y: 196, w: 180, h: 30 };
const BTN_MENU = { x: 30, y: 234, w: 180, h: 30 };

// 表示モード: 'fixed' は 240×320（3:4）のまま、'tall' は縦長スマホ向けに論理高さ H を画面の比率に合わせて伸ばし、全画面で使う。
const tallHeight = () => Math.max(BASE_H, Math.min(MAX_H, Math.round((W * window.innerHeight) / Math.max(1, window.innerWidth))));
function setHeight(h) {
  if (h === H && canvas.style.getPropertyValue('--ar-h')) return false;
  H = h;
  env.H = h;
  input.H = h;
  canvas.style.setProperty('--ar-h', String(h));
  BTN_RETRY.y = h - 124; // 結果のボタンは下端起点（320 のとき 196 / 234）
  BTN_MENU.y = h - 86;
  setRes(resScale);
  return true;
}
// 今の状態（メニューか、ゲームの viewMode）に合わせて高さを決める。変わったらゲームへ知らせる。
function applyView() {
  const tall = state !== 'menu' && game && game.viewMode === 'tall';
  if (setHeight(tall ? tallHeight() : BASE_H) && game && game.resize) game.resize(W, H);
}
window.addEventListener('resize', () => {
  if (game && game.viewMode === 'tall') applyView();
});

async function startGame(item) {
  state = 'loading';
  const mod = await item.load();
  def = item;
  game = mod.default(env);
  if (game.bgm) Music.start(`game-${game.bgm}`); // ゲームが専用の BGM（スキンごとなど）を持つなら鳴らす
  else Music.stop();
  best = Store.best(item.id);
  setRes(game.hiRes || 1);
  applyView();
  game.reset();
  input.pressed = false; // メニューで押したタップをゲーム側に渡さない
  state = game.skipReady ? 'play' : 'ready';
}

function finish() {
  if (state !== 'play') return;
  finalScore = game.score;
  newBest = Store.submit(def.id, finalScore);
  best = Store.best(def.id);
  overAge = 0;
  state = 'over';
  if (!game.silentOver) Sound.fall();
}

function toMenu() {
  if (game && game.dispose) game.dispose(); // 通信などの後始末
  setRes(2);
  state = 'menu';
  game = null;
  def = null;
  applyView();
  portal.enter();
}

function drawHud() {
  if (game.noHud) return;
  text(g, `${game.score}`, W - 6, 4, 14, C.dark, 'right');
}

function overlayBox(y, h) {
  rect(g, 20, y, W - 40, h, C.bg);
  frame(g, 20, y, W - 40, h, C.dark);
  frame(g, 22, y + 2, W - 44, h - 4, C.dark);
}

function drawReady() {
  game.draw(g);
  drawHud();
  overlayBox(120, 70);
  text(g, def.title, W / 2, 130, 16, C.dark, 'center');
  text(g, def.desc, W / 2, 152, 11, C.mid, 'center');
  text(g, 'タップでスタート', W / 2, 168, 12, C.dark, 'center');
}

function updateOver(dt) {
  overAge += dt;
  if (game.tick) game.tick(dt); // 結果画面でも演出を動かす
  if (!input.pressed || overAge < 0.6) return;
  if (inside(input.x, input.y, BTN_RETRY)) {
    game.reset();
    input.pressed = false;
    state = game.skipReady ? 'play' : 'ready';
  } else if (inside(input.x, input.y, BTN_MENU)) {
    toMenu();
  }
}

function drawOver() {
  game.draw(g);
  if (game.drawOver) {
    game.drawOver(g, { retry: BTN_RETRY, menu: BTN_MENU, score: finalScore, best, newBest, age: overAge });
    return;
  }
  overlayBox(70, 210);
  text(g, 'GAME OVER', W / 2, 84, 18, C.dark, 'center');
  text(g, `スコア ${finalScore}`, W / 2, 118, 16, C.dark, 'center');
  text(g, `ベスト ${best}`, W / 2, 142, 12, C.mid, 'center');
  if (newBest) text(g, 'NEW RECORD!', W / 2, 162, 12, C.dark, 'center');
  if (game.award) text(g, `表彰: ${game.award}`, W / 2, 178, 11, C.mid, 'center');
  for (const [r, label] of [[BTN_RETRY, 'もう一度'], [BTN_MENU, 'メニュー']]) {
    rect(g, r.x, r.y, r.w, r.h, C.dark);
    text(g, label, r.x + r.w / 2, r.y + 8, 14, C.bg, 'center');
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;

  if (state === 'menu') {
    portal.update(dt, input);
    portal.draw(g);
  } else if (state === 'loading') {
    rect(g, 0, 0, W, H, C.bg);
    text(g, 'LOADING...', W / 2, H / 2 - 8, 14, C.dark, 'center');
  } else if (state === 'ready') {
    if (input.pressed) {
      input.pressed = false; // 開始のタップをゲーム側に渡さない
      state = 'play';
    }
    drawReady();
  } else if (state === 'play') {
    game.update(dt);
    if (wantMenu) {
      wantMenu = false;
      toMenu();
    } else if (state === 'play') {
      game.draw(g);
      drawHud();
    } else {
      drawOver();
    }
  } else if (state === 'over') {
    updateOver(dt);
    if (state === 'over') drawOver();
  }

  syncBars();
  if (game && game.bgm && state !== 'menu') Music.setChannel(`game-${game.bgm}`); // スキンを変えたら曲も変わる
  if (input.keys.has('Escape') && state !== 'menu') toMenu();
  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
