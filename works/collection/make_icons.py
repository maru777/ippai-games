"""アイコン生成（依存なし）。16x16 のドット絵（ヘリ）を拡大して PNG にする。
使い方: python make_icons.py   → app/icons/ に icon-180/192/512.png を出力
"""
import struct
import zlib
from pathlib import Path

BG = (155, 188, 15)
DK = (15, 56, 15)
MID = (48, 98, 48)

ART = [
    "................",
    "................",
    "...DDDDDDDDDDD..",
    ".......DD.......",
    ".......DD.......",
    "....DDDDDDDD....",
    "DD.DDDDDDDDDD...",
    "DD.DDDDDDDDDBBD.",
    "DDDDDDDDDDDBBDD.",
    "...DDDDDDDDDDD..",
    "....DDDDDDDD....",
    "......D..D......",
    "....DDDDDDDD....",
    "................",
    "MMMMMMMMMMMMMMMM",
    "MMMMMMMMMMMMMMMM",
]


def pixel(ch):
    if ch == "D":
        return DK
    if ch == "M":
        return MID
    return BG


def png(size, rows):
    raw = b""
    for row in rows:
        raw += b"\x00" + b"".join(bytes(c) for c in row)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def render(size):
    pad = size // 8  # 余白（マスカブル対応）
    inner = size - pad * 2
    cell = inner // 16
    art = cell * 16
    off = (size - art) // 2
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            ax, ay = x - off, y - off
            if 0 <= ax < art and 0 <= ay < art:
                row.append(pixel(ART[ay // cell][ax // cell]))
            else:
                row.append(BG)
        rows.append(row)
    return png(size, rows)


out = Path(__file__).parent / "app" / "icons"
out.mkdir(parents=True, exist_ok=True)
for s in (180, 192, 512):
    (out / f"icon-{s}.png").write_bytes(render(s))
    print("wrote", out / f"icon-{s}.png")
