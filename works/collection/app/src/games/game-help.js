// ゲーム画面の中の「？」ボタンと、遊び方の紹介画面（ポータルと同じ紹介画面を使う）。
// 使い方: const help = createHelp(id, title, rect?); 押したとき help.press(x, y)（true なら入力を使った）、描画で help.drawButton(g) / help.drawOverlay(g)
import { inside } from '../core/draw.js';
import { drawIntroCard } from '../portal.js';

export const NEON_PAL = { card: 'rgba(8, 12, 40, 0.97)', line: '#00e5ff', ink: '#ffffff', dim: '#8e97b5', accent: '#00e5ff', onAccent: '#02060f', radius: 8 };
export const LCD_PAL = { card: '#9bbc0f', line: '#0f380f', ink: '#0f380f', dim: '#306230', accent: '#0f380f', onAccent: '#9bbc0f', radius: 0 };

export function createHelp(id, title, rect = { x: 210, y: 4, w: 26, h: 26 }, pal = NEON_PAL, modern = true) {
  let open = false;
  return {
    get open() { return open; },
    close() { open = false; },
    press(x, y) {
      if (open) {
        open = false; // どこをタップしても閉じる
        return true;
      }
      if (inside(x, y, rect)) {
        open = true;
        return true;
      }
      return false;
    },
    drawButton(g) {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      g.save();
      g.beginPath();
      g.arc(cx, cy, Math.min(rect.w, rect.h) / 2 - 2, 0, Math.PI * 2);
      g.strokeStyle = pal.accent;
      g.lineWidth = 1.3;
      g.stroke();
      g.font = `bold 11px ${modern ? '"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif' : '"MS Gothic", monospace'}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = pal.accent;
      g.fillText('？', cx, cy + 0.5);
      g.restore();
    },
    drawOverlay(g) {
      if (open) drawIntroCard(g, { id, title }, pal, modern);
    },
  };
}
