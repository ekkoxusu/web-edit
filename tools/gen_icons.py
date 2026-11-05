#!/usr/bin/env python3
"""生成扩展图标：深蓝圆角底 + 白色选中框 + 四角手柄点（选框主题，贴合插件功能）。
仅用标准库，无文件写入：PNG 输出到 stdout，由 shell 重定向到目标路径。
用法: python3 gen_icons.py <尺寸> > icon.png
"""
import struct, zlib, sys

BG = (79, 107, 255)      # 品牌蓝
FG = (255, 255, 255)     # 白色选框

def in_round_rect(x, y, size, radius):
    """判断点是否在圆角矩形内（矩形铺满整个画布）"""
    r = radius
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r or (r <= x <= size - r) or (r <= y <= size - r)

def pixel(x, y, size):
    """返回 (x,y) 处像素颜色：底色 / 框线 / 角点；None 为透明"""
    s = size
    a, b = int(s * 0.28), int(s * 0.72)  # 框左上/右下边界
    lw = max(2, int(s * 0.055))          # 框线宽
    if a <= x < b and a <= y < b:
        hs = max(3, int(s * 0.10))       # 手柄边长
        half = hs // 2
        for hx, hy in ((a, a), (b - 1, a), (a, b - 1), (b - 1, b - 1)):
            if abs(x - hx) <= half and abs(y - hy) <= half:
                return FG
        if (x < a + lw) or (x >= b - lw) or (y < a + lw) or (y >= b - lw):
            return FG
    if in_round_rect(x, y, size, int(size * 0.22)):
        return BG
    return None

def build_png(size):
    """逐像素光栅化并编码为 PNG 字节串"""
    rows = []
    for y in range(size):
        row = b"\x00"  # filter type 0
        for x in range(size):
            c = pixel(x, y, size)
            row += bytes(c) + b"\xff" if c else b"\x00\x00\x00\x00"
        rows.append(row)
    raw = b"".join(rows)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))

if __name__ == "__main__":
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 128
    sys.stdout.buffer.write(build_png(size))
