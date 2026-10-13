// ハイスコア保存。localStorage が使えない環境（プライベートモード等）では
// そのセッション中だけメモリに保持する（保存できない旨は握りつぶさず mem に切り替える）。
const KEY = 'keitai-games:v1';
let mem = {};

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('localStorage 読み込み不可。メモリのみで保持します:', err);
    return mem;
  }
}

function write(data) {
  mem = data;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('localStorage 書き込み不可。メモリのみで保持します:', err);
  }
}

export const Store = {
  best(id) {
    return read().best?.[id] ?? 0;
  },
  // 更新したら true
  submit(id, score) {
    const data = read();
    data.best = data.best || {};
    if (score > (data.best[id] ?? 0)) {
      data.best[id] = score;
      write(data);
      return true;
    }
    return false;
  },
};
