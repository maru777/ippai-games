// 対戦・ボードのゲームの線画アイコン。画像ファイルは使わず、すべてコードで描く（24×24 の枠の中心が (0, 0)）。
// 使い方: drawIcon(g, 'hex', cx, cy, size, color)
const ICONS = {
  // こりぽーる: 3×3 のマス、コマ、1 本の壁
  'wall-race': (g) => {
    for (const x of [-7, 0, 7]) for (const y of [-7, 0, 7]) g.strokeRect(x - 3, y - 3, 6, 6);
    g.beginPath();
    g.arc(0, 7, 2.2, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-10, -3.5);
    g.lineTo(3.5, -3.5);
    g.stroke();
  },
  // あいぽれーしょん: マスの床が崩れて 1 マス消え、コマが立つ
  isolation: (g) => {
    for (const [x, y] of [[-7, -7], [0, -7], [7, -7], [-7, 0], [7, 0], [-7, 7], [7, 7]]) g.strokeRect(x - 3, y - 3, 6, 6);
    g.save();
    g.setLineDash([1.5, 2]);
    g.strokeRect(-3, 4, 6, 6);
    g.restore();
    g.beginPath();
    g.arc(0, 0, 2.6, 0, Math.PI * 2);
    g.stroke();
  },
  // あまぽん: 王冠（クイーン）と矢
  amazons: (g) => {
    g.beginPath();
    g.moveTo(-8, 3);
    g.lineTo(-9, -5);
    g.lineTo(-4, -1);
    g.lineTo(0, -7);
    g.lineTo(4, -1);
    g.lineTo(9, -5);
    g.lineTo(8, 3);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(-8, 7);
    g.lineTo(8, 7);
    g.stroke();
    g.beginPath();
    g.moveTo(-8, 10);
    g.lineTo(9, 10);
    g.moveTo(6, 8);
    g.lineTo(9, 10);
    g.lineTo(6, 12);
    g.stroke();
  },
  // ぶろっけーぽん: 2 つのコマと、それを隔てる壁
  blockade: (g) => {
    for (const x of [-6, 6]) {
      g.beginPath();
      g.arc(x, 6, 3.4, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(x, -7, 3.4, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-10, -0.5);
    g.lineTo(10, -0.5);
    g.stroke();
  },
  // ぽんとりーに: 階段状に積んだ積み木と、てっぺんのドーム
  santorini: (g) => {
    g.strokeRect(-10, 2, 8, 8);
    g.strokeRect(-2, -2, 8, 12);
    g.strokeRect(6, 2, 5, 8);
    g.beginPath();
    g.arc(2, -3, 4.2, Math.PI, 0);
    g.stroke();
  },
  // おにぽま: 動きのカード（5×5 の点で動く先を示す）
  onitama: (g) => {
    g.strokeRect(-9, -11, 18, 22);
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const on = (x === 0 && y === -2) || (x === -1 && y === 1) || (x === 1 && y === 1);
        g.beginPath();
        g.arc(x * 3.4, y * 3.6, on ? 1.4 : 0.4, 0, Math.PI * 2);
        if (on) g.fill();
        else g.stroke();
      }
    }
  },
  // ぽっくす: 3 つの六角形
  hex: (g) => {
    const h = (cx, cy) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        g.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      }
      g.closePath();
      g.stroke();
    };
    h(-5.2, -4.5);
    h(5.2, -4.5);
    h(0, 4.6);
  },
  // リバーシ: 重なる 2 つの石（一方は半分だけ塗る）
  reversi: (g) => {
    g.beginPath();
    g.arc(-4, 0, 7, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(4, 0, 7, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(4, 0, 7, -Math.PI / 2, Math.PI / 2);
    g.lineTo(4, -7);
    g.fill();
  },
  // 四目並べ: 格子のなかの、斜めに並ぶ 4 つの石
  four: (g) => {
    g.strokeRect(-10, -10, 20, 20);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(-6 + k * 4, 6 - k * 4, 1.9, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(-6, -6, 1.2, 0, Math.PI * 2);
    g.arc(6, 6, 1.2, 0, Math.PI * 2);
    g.stroke();
  },
  // ドット囲み: 点と、完成した 1 つの箱
  dots: (g) => {
    for (const x of [-8, 0, 8]) {
      for (const y of [-8, 0, 8]) {
        g.beginPath();
        g.arc(x, y, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.beginPath();
    g.rect(-8, -8, 8, 8);
    g.stroke();
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(8, 0);
    g.stroke();
  },
};

export const hasIcon = (id) => id in ICONS;

export function drawIcon(g, id, cx, cy, size, color, width = 1.5) {
  const f = ICONS[id];
  if (!f) return;
  g.save();
  g.translate(cx, cy);
  g.scale(size / 24, size / 24);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  f(g);
  g.restore();
}
