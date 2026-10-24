// シェル: メニュー → 開始待ち → プレイ → ゲームオーバー を管理する。
import { GAMES } from './games/registry.js';
import { Input } from './core/input.js';
import { Sound } from './core/sound.js';
import { Store } from './core/storage.js';
import { C, text, rect, frame, inside } from './core/draw.js';

const W = 240;
const H = 320;
const canvas = document.getElementById('screen');
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = false;

// 解像度の切り替え。ゲームが hiRes（倍率）を持つときは高解像度で描く（光の表現用）。論理座標は常に 240×320。
function setRes(scale) {
  canvas.width = W * scale;
  canvas.height = H * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.imageSmoothingEnabled = scale > 1;
  canvas.style.imageRendering = scale > 1 ? 'auto' : '';
}

const input = new Input(canvas, W, H);
input.onFirstGesture = () => Sound.unlock();

const env = {
  W,
  H,
  sound: Sound,
  input,
  end: () => finish(),
};

// menu | loading | ready | play | over
let state = 'menu';
let def = null;
let game = null;
let best = 0;
let newBest = false;
let finalScore = 0;
let overAge = 0;

// メニューは「アクション」「ボード」の 2 タブ。各ゲームは registry の tab で振り分ける。
const TABS = [
  { id: 'action', label: 'アクション', rect: { x: 12, y: 42, w: 106, h: 22 } },
  { id: 'board', label: 'ボード（対戦）', rect: { x: 122, y: 42, w: 106, h: 22 } },
];
let menuTab = 'action';
const tabItems = () => GAMES.filter((it) => it.tab === menuTab);
const menuRow = (i) => ({ x: 12, y: 70 + i * 33, w: 216, h: 30 });
const BTN_RETRY = { x: 30, y: 196, w: 180, h: 30 };
const BTN_MENU = { x: 30, y: 234, w: 180, h: 30 };

async function startGame(item) {
  state = 'loading';
  const mod = await item.load();
  def = item;
  game = mod.default(env);
  best = Store.best(item.id);
  setRes(game.hiRes || 1);
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
  setRes(1);
  state = 'menu';
  game = null;
  def = null;
}

function updateMenu() {
  if (!input.pressed) return;
  for (const t of TABS) if (inside(input.x, input.y, t.rect)) menuTab = t.id;
  tabItems().forEach((item, i) => {
    if (!inside(input.x, input.y, menuRow(i))) return;
    if (item.href) location.href = item.href; // 別ページのゲーム（パズル集など）へ移動
    else if (item.load) startGame(item);
  });
}

function drawMenu() {
  rect(g, 0, 0, W, H, C.bg);
  rect(g, 0, 0, W, 38, C.dark);
  text(g, 'ケータイゲーム集', W / 2, 11, 16, C.bg, 'center');
  for (const t of TABS) {
    const on = t.id === menuTab;
    rect(g, t.rect.x, t.rect.y, t.rect.w, t.rect.h, on ? C.dark : C.bg);
    frame(g, t.rect.x, t.rect.y, t.rect.w, t.rect.h, C.dark);
    text(g, t.label, t.rect.x + t.rect.w / 2, t.rect.y + 5, 11, on ? C.bg : C.dark, 'center');
  }
  tabItems().forEach((item, i) => {
    const r = menuRow(i);
    const on = !!(item.load || item.href);
    rect(g, r.x, r.y, r.w, r.h, on ? C.light : C.bg);
    frame(g, r.x, r.y, r.w, r.h, on ? C.dark : C.mid);
    text(g, `${i + 1}`, r.x + 6, r.y + 8, 14, on ? C.dark : C.mid);
    text(g, item.title, r.x + 24, r.y + 3, 13, on ? C.dark : C.mid);
    const sub = !on ? '準備中' : item.tab === 'board' ? item.desc : `${item.desc}  ベスト ${Store.best(item.id)}`;
    text(g, sub, r.x + 24, r.y + 17, 10, on ? C.mid : C.mid);
  });
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
    updateMenu();
    drawMenu();
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
    if (state === 'play') {
      game.draw(g);
      drawHud();
    } else {
      drawOver();
    }
  } else if (state === 'over') {
    updateOver(dt);
    if (state === 'over') drawOver();
  }

  if (input.keys.has('Escape') && state !== 'menu') toMenu();
  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
