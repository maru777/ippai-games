// マリさんの冒険: 横スクロールのアクション（全 3 ステージ）。
// 左右ボタンで移動、ジャンプボタン（長押しで高く）。敵は踏んで倒す。ゴールの旗へ。
// キーボード: ← → 移動、スペース／↑ ジャンプ。
import { C, rect, frame, text, inside } from '../core/draw.js';

const T = 16; // タイルの大きさ
const ROWS = 15; // 画面に出る行数（240px）
const VIEW_H = ROWS * T;
const GROUND_ROW = 13; // 地面の最上段（足が乗る行）
const LIVES = 3;

const BTN = {
  left: { x: 8, y: 250, w: 54, h: 60 },
  right: { x: 68, y: 250, w: 54, h: 60 },
  jump: { x: 160, y: 250, w: 72, h: 60 },
};

// ---- ステージ定義（ビルダー）----
function build(width, fn) {
  const grid = Array.from({ length: ROWS }, () => Array(width).fill('.'));
  const coins = [];
  const enemies = [];
  const api = {
    ground(x0, x1) {
      for (let x = x0; x <= x1; x++) {
        grid[GROUND_ROW][x] = '#';
        grid[GROUND_ROW + 1][x] = '#';
      }
    },
    block(x, row, n = 1, ch = 'B') {
      for (let i = 0; i < n; i++) grid[row][x + i] = ch;
    },
    coin(x, row, n = 1) {
      for (let i = 0; i < n; i++) coins.push({ x: (x + i) * T + T / 2, y: row * T + T / 2, got: false });
    },
    enemy(x, row = GROUND_ROW - 1) {
      enemies.push({ x: x * T + T / 2, y: (row + 1) * T, vx: -28, vy: 0, dir: -1, dead: false, ground: false });
    },
    stairs(x, h) {
      for (let i = 0; i < h; i++) {
        for (let k = 0; k <= i; k++) grid[GROUND_ROW - 1 - k][x + i] = '#';
      }
    },
  };
  fn(api);
  const goal = width - 4;
  for (let r = 7; r < GROUND_ROW; r++) grid[r][goal] = 'G';
  return { width, grid, coins, enemies, startX: 2 * T + T / 2 };
}

const STAGES = [
  () => build(90, (a) => {
    a.ground(0, 29); a.ground(33, 51); a.ground(55, 89);
    a.block(12, 9, 4); a.block(13, 9, 1, '?'); a.coin(12, 8, 4);
    a.coin(20, 11, 3);
    a.block(40, 9, 3); a.coin(40, 8, 3);
    a.coin(30, 10, 3); a.coin(52, 10, 3);
    a.stairs(80, 4);
    for (const x of [22, 43, 48, 62, 70]) a.enemy(x);
  }),
  () => build(110, (a) => {
    a.ground(0, 24); a.ground(28, 45); a.ground(56, 80); a.ground(84, 109);
    a.block(48, 10, 2); a.block(52, 9, 2);
    a.block(8, 9, 3); a.block(9, 9, 1, '?');
    a.block(60, 9, 5); a.block(63, 6, 3); a.coin(63, 5, 3);
    a.coin(25, 11, 3); a.coin(48, 8, 2); a.coin(52, 7, 2); a.coin(81, 11, 3);
    a.stairs(98, 5);
    for (const x of [15, 40, 44, 62, 70, 90, 95]) a.enemy(x);
    a.enemy(61, 8);
  }),
  () => build(130, (a) => {
    a.ground(0, 19); a.ground(23, 40); a.ground(53, 70); a.ground(74, 76); a.ground(80, 105); a.ground(115, 129);
    a.block(43, 10, 2); a.block(47, 8, 2); a.block(50, 10, 2);
    a.block(107, 10, 1); a.block(110, 8, 1); a.block(113, 10, 1);
    a.block(10, 9, 3); a.block(11, 9, 1, '?'); a.block(28, 9, 4); a.block(30, 9, 1, '?');
    a.block(58, 9, 3); a.block(62, 6, 4); a.coin(62, 5, 4);
    a.coin(20, 10, 3); a.coin(43, 8, 2); a.coin(47, 6, 2); a.coin(71, 10, 3); a.coin(77, 10, 3);
    a.coin(107, 8, 1); a.coin(110, 6, 1); a.coin(113, 8, 1);
    a.stairs(122, 5);
    for (const x of [14, 26, 34, 56, 66, 84, 90, 96, 101]) a.enemy(x);
    a.enemy(29, 8); a.enemy(63, 5);
  }),
];

const AWARD_CLEAR = '全ステージ制覇!';

export default function create(env) {
  const { W, H, input, sound } = env;

  let stage, lives, score, lvl, p, camX, mode, modeT, msg, held, prevJump, jumpBuf, t, cleared;

  function loadStage(i) {
    stage = i;
    lvl = STAGES[i]();
    p = { x: lvl.startX, y: GROUND_ROW * T, vx: 0, vy: 0, w: 10, h: 14, face: 1, ground: true, coyote: 0 };
    camX = 0;
    jumpBuf = 0;
    mode = 'intro';
    modeT = 1.3;
  }

  function reset() {
    lives = LIVES;
    score = 0;
    t = 0;
    cleared = false;
    msg = '';
    prevJump = false;
    loadStage(0);
    msg = `STAGE 1`;
  }

  const solidAt = (c, r) => {
    if (c < 0 || c >= lvl.width) return true;
    if (r < 0 || r >= ROWS) return false;
    const ch = lvl.grid[r][c];
    return ch === '#' || ch === 'B' || ch === '?' || ch === 'U';
  };

  // 矩形（x 中心・y 足元）を移動して地形と衝突させる。
  function moveBox(b, dt) {
    const res = { hitX: false, ground: false, headRow: -1 };
    const hw = b.w / 2;
    b.x += b.vx * dt;
    let top = Math.floor((b.y - b.h) / T);
    let bot = Math.floor((b.y - 0.01) / T);
    for (let row = top; row <= bot; row++) {
      if (b.vx > 0) {
        const c = Math.floor((b.x + hw - 0.01) / T);
        if (solidAt(c, row)) { b.x = c * T - hw - 0.01; b.vx = 0; res.hitX = true; break; }
      } else if (b.vx < 0) {
        const c = Math.floor((b.x - hw) / T);
        if (solidAt(c, row)) { b.x = (c + 1) * T + hw + 0.01; b.vx = 0; res.hitX = true; break; }
      }
    }
    b.y += b.vy * dt;
    const c0 = Math.floor((b.x - hw) / T);
    const c1 = Math.floor((b.x + hw - 0.01) / T);
    if (b.vy >= 0) {
      const row = Math.floor(b.y / T);
      for (let c = c0; c <= c1; c++) {
        if (solidAt(c, row)) {
          b.y = row * T;
          b.vy = 0;
          res.ground = true;
          break;
        }
      }
    } else {
      const row = Math.floor((b.y - b.h) / T);
      for (let c = c0; c <= c1; c++) {
        if (solidAt(c, row)) {
          b.y = (row + 1) * T + b.h;
          b.vy = 0;
          res.headRow = row;
          break;
        }
      }
    }
    return res;
  }

  function die() {
    lives--;
    sound.fall();
    if (lives <= 0) {
      env.end();
      return;
    }
    const keep = score;
    loadStage(stage);
    score = keep;
    msg = `ミス！ のこり ${lives}`;
  }

  function readControls() {
    let l = input.left;
    let r = input.right;
    let j = input.keyAction;
    for (const q of input.pointers) {
      if (inside(q.x, q.y, BTN.left)) l = true;
      else if (inside(q.x, q.y, BTN.right)) r = true;
      else if (inside(q.x, q.y, BTN.jump)) j = true;
    }
    return { l, r, j };
  }

  function updatePlay(dt) {
    const { l, r, j } = readControls();
    const target = ((r ? 1 : 0) - (l ? 1 : 0)) * 105;
    const acc = (p.ground ? 700 : 380) * dt;
    p.vx += Math.max(-acc, Math.min(acc, target - p.vx));
    if (target !== 0) p.face = Math.sign(target);

    if (j && !prevJump) jumpBuf = 0.12;
    prevJump = j;
    jumpBuf -= dt;
    p.coyote = p.ground ? 0.08 : p.coyote - dt;
    if (jumpBuf > 0 && p.coyote > 0) {
      p.vy = -280;
      p.coyote = 0;
      jumpBuf = 0;
      sound.beep(620, 0.07, 'square', 0.05);
    }
    p.vy = Math.min(420, p.vy + (p.vy < 0 && j ? 700 : 1100) * dt);

    const res = moveBox(p, dt);
    p.ground = res.ground;
    if (res.headRow >= 0) {
      const col = Math.floor(p.x / T);
      if (lvl.grid[res.headRow]?.[col] === '?') {
        lvl.grid[res.headRow][col] = 'U';
        score += 10;
        sound.beep(1320, 0.08, 'square', 0.05);
      }
    }

    camX = Math.max(0, Math.min(lvl.width * T - W, p.x - 100));
    if (p.y > VIEW_H + 40) {
      die();
      return;
    }

    // 敵
    for (const e of lvl.enemies) {
      if (e.dead || Math.abs(e.x - p.x) > W + 80) continue;
      e.vx = e.dir * 28;
      e.vy = Math.min(420, e.vy + 1100 * dt);
      const box = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, w: 12, h: 12 };
      const er = moveBox(box, dt);
      e.x = box.x; e.y = box.y; e.vy = box.vy; e.ground = er.ground;
      if (er.hitX) e.dir = -e.dir;
      if (e.ground && !solidAt(Math.floor((e.x + e.dir * 8) / T), Math.floor(e.y / T))) e.dir = -e.dir;
      if (e.y > VIEW_H + 60) e.dead = true;

      if (Math.abs(e.x - p.x) < 11 && p.y - p.h < e.y && p.y > e.y - 12) {
        if (p.vy > 0 && p.y <= e.y - 12 + 9) {
          e.dead = true;
          p.vy = -200;
          score += 20;
          sound.beep(880, 0.06, 'square', 0.06);
        } else {
          die();
          return;
        }
      }
    }

    // コイン
    for (const c of lvl.coins) {
      if (!c.got && Math.abs(c.x - p.x) < 10 && Math.abs(c.y - (p.y - 7)) < 12) {
        c.got = true;
        score += 10;
        sound.beep(1500, 0.05, 'square', 0.05);
      }
    }

    // ゴール
    const gc = lvl.width - 4;
    if (Math.abs((gc * T + T / 2) - p.x) < 10 && p.y > 7 * T) {
      score += 100;
      sound.beep(1000, 0.2, 'square', 0.06);
      if (stage + 1 >= STAGES.length) {
        cleared = true;
        env.end();
      } else {
        mode = 'clear';
        modeT = 1.4;
        msg = 'STAGE CLEAR!';
      }
    }
  }

  function update(dt) {
    t += dt;
    if (mode === 'intro') {
      modeT -= dt;
      if (modeT <= 0) mode = 'play';
      readControls();
      prevJump = true; // 開始直後のジャンプ入力を持ち越さない
      return;
    }
    if (mode === 'clear') {
      modeT -= dt;
      if (modeT <= 0) {
        const keep = score;
        loadStage(stage + 1);
        score = keep;
        msg = `STAGE ${stage + 1}`;
      }
      return;
    }
    updatePlay(dt);
  }

  // ---- 描画 ----
  function drawTile(g, ch, sx, sy) {
    if (ch === '#') {
      rect(g, sx, sy, T, T, C.mid);
      rect(g, sx, sy, T, 2, C.dark);
      rect(g, sx + 3, sy + 7, 3, 2, C.dark);
      rect(g, sx + 10, sy + 11, 3, 2, C.dark);
    } else if (ch === 'B') {
      rect(g, sx, sy, T, T, C.dark);
      rect(g, sx + 1, sy + 1, T - 2, 6, C.mid);
      rect(g, sx + 1, sy + 9, 6, 6, C.mid);
      rect(g, sx + 9, sy + 9, 6, 6, C.mid);
    } else if (ch === '?') {
      rect(g, sx, sy, T, T, C.dark);
      rect(g, sx + 1, sy + 1, T - 2, T - 2, C.light);
      text(g, '?', sx + 8, sy + 2, 12, C.dark, 'center');
    } else if (ch === 'U') {
      rect(g, sx, sy, T, T, C.dark);
      rect(g, sx + 2, sy + 2, T - 4, T - 4, C.mid);
    } else if (ch === 'G') {
      rect(g, sx + 7, sy, 2, T, C.dark);
    }
  }

  function draw(g) {
    rect(g, 0, 0, W, VIEW_H, C.bg);
    const cam = Math.round(camX);
    // 遠景の山
    for (let sx = 0; sx < W; sx += 4) {
      const wx = cam * 0.4 + sx;
      const top = 150 + 22 * Math.sin(wx / 60) + 12 * Math.sin(wx / 23);
      rect(g, sx, top, 4, VIEW_H - top, C.light);
    }
    // タイル
    const c0 = Math.max(0, Math.floor(cam / T));
    const c1 = Math.min(lvl.width - 1, Math.floor((cam + W) / T));
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = lvl.grid[r][c];
        if (ch !== '.') drawTile(g, ch, c * T - cam, r * T);
      }
    }
    // ゴールの旗
    const gx = (lvl.width - 4) * T - cam;
    rect(g, gx + 9, 7 * T, 9, 6, C.dark);
    rect(g, gx + 5, 7 * T - 3, 6, 3, C.dark);
    // コイン
    for (const c of lvl.coins) {
      if (c.got) continue;
      const sx = Math.round(c.x - cam);
      if (sx < -10 || sx > W + 10) continue;
      const w = 2 + Math.abs(Math.sin(t * 5 + c.x)) * 3;
      rect(g, sx - w, c.y - 5, w * 2, 10, C.dark);
      rect(g, sx - 1, c.y - 3, 2, 6, C.light);
    }
    // 敵
    for (const e of lvl.enemies) {
      if (e.dead) continue;
      const sx = Math.round(e.x - cam);
      if (sx < -14 || sx > W + 14) continue;
      const ey = Math.round(e.y);
      rect(g, sx - 6, ey - 10, 12, 8, C.dark);
      rect(g, sx - 4, ey - 12, 8, 3, C.dark);
      const step = Math.floor(t * 6) % 2;
      rect(g, sx - 6 + step * 2, ey - 2, 4, 2, C.dark);
      rect(g, sx + 2 - step * 2, ey - 2, 4, 2, C.dark);
      rect(g, sx - 3, ey - 8, 2, 2, C.bg);
      rect(g, sx + 1, ey - 8, 2, 2, C.bg);
    }
    // マリさん
    {
      const sx = Math.round(p.x - cam);
      const py = Math.round(p.y);
      const bow = p.face >= 0 ? sx + 3 : sx - 6;
      rect(g, sx - 5, py - 14, 10, 6, C.dark); // 髪
      rect(g, bow, py - 16, 4, 3, C.mid); // リボン
      rect(g, sx - 4, py - 11, 8, 5, C.bg); // 顔
      rect(g, sx + (p.face >= 0 ? 1 : -3), py - 10, 2, 2, C.dark);
      rect(g, sx - 5, py - 6, 10, 4, C.mid); // ワンピース
      const walk = p.ground && Math.abs(p.vx) > 5 ? Math.floor(t * 12) % 2 : 0;
      rect(g, sx - 4 + walk, py - 2, 3, 2, C.dark);
      rect(g, sx + 1 - walk, py - 2, 3, 2, C.dark);
    }
    // HUD（左上）
    text(g, `ST${stage + 1}  ×${lives}`, 4, 4, 11, C.dark);

    // 操作ボタン
    rect(g, 0, VIEW_H, W, H - VIEW_H, C.dark);
    const pressed = { left: false, right: false, jump: false };
    for (const q of input.pointers) {
      for (const k of Object.keys(BTN)) if (inside(q.x, q.y, BTN[k])) pressed[k] = true;
    }
    if (input.left) pressed.left = true;
    if (input.right) pressed.right = true;
    if (input.keyAction) pressed.jump = true;
    for (const [k, label] of [['left', '<'], ['right', '>'], ['jump', 'JUMP']]) {
      const b = BTN[k];
      rect(g, b.x, b.y, b.w, b.h, pressed[k] ? C.bg : C.mid);
      frame(g, b.x, b.y, b.w, b.h, C.bg);
      text(g, label, b.x + b.w / 2, b.y + b.h / 2 - 9, 18, pressed[k] ? C.dark : C.bg, 'center');
    }

    // ステージ表示
    if (mode === 'intro' || mode === 'clear') {
      rect(g, 40, 90, W - 80, 40, C.bg);
      frame(g, 40, 90, W - 80, 40, C.dark);
      text(g, msg, W / 2, 102, 14, C.dark, 'center');
    }
  }

  return {
    reset,
    update,
    draw,
    get score() { return score; },
    get award() { return cleared ? AWARD_CLEAR : ''; },
  };
}
