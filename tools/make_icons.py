#!/usr/bin/env python3
"""
    favicon.svg 的几何 → 多尺寸 PNG / ICO（纯标准库，无 PIL / cairosvg）

    图标构成（64 viewBox）：
      - 圆角矩形底 rx=14，左上 #2a2c33 → 右下 #101114 斜向渐变（RVC / IMC 同一套）
      - 坐标轴两条（灰），一条白色上升曲线（三次贝塞尔）
    光栅化：圆角矩形 SDF 判定底色与透明角， glyph 用「点到折线的最短距离」求覆盖率，
    每个逻辑像素 3×3 超采样做抗锯齿。apple-touch-icon（180）单独走直角整幅不透明分支——
    iOS 会自己套圆角 mask，预先裁圆会被二次裁切、透明角还会透出用户桌面壁纸。
"""
import base64
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')

BG_A = (42, 44, 51)      # #2a2c33 左上
BG_B = (16, 17, 20)      # #101114 右下
GLYPH = (242, 243, 246)   # #f2f3f6
AXIS = (107, 114, 128)   # #6b7280
SQUARE_BG = (10, 10, 12)  # #0a0a0c（apple-touch-icon 的整幅不透明底）

RADIUS = 14.0
CURVE = ((10, 47), (22, 47), (26, 17), (54, 17))  # 三次贝塞尔控制点
AXES = (((10, 55), (10, 10)), ((6, 54), (54, 54)))
CURVE_W = 4.5
AXES_W = 3.2
AXES_ALPHA = 0.8

SIZES = [16, 32, 48, 192, 512, 180]


# ---------- 几何 ----------

def sd_rounded_rect(x, y, half, r):
    dx = abs(x) - (half - r)
    dy = abs(y) - (half - r)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    outside = math.hypot(ax, ay) + min(max(dx, dy), 0.0) - r
    return outside


def dist_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(wx, wy)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - bx, py - by)
    t = c1 / c2
    return math.hypot(wx - t * vx, wy - t * vy)


def bezier_points(p0, p1, p2, p3, steps=24):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


CURVE_POLY = bezier_points(*CURVE)


def dist_polyline(px, py, pts):
    best = float('inf')
    for i in range(len(pts) - 1):
        d = dist_segment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
        if d < best:
            best = d
    return best


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def coverage(d, w):
    """笔画覆盖率：距中线距离 d、半宽 w 时的抗锯齿覆盖"""
    return clamp(0.5 - (d - w) / 1.0, 0.0, 1.0)


# ---------- 渲染 ----------

def render(size, square_opaque=False):
    ss = 4 if size <= 32 else 3
    half = 32.0
    px = bytearray(size * size * 4)
    scale = 64.0 / size
    for j in range(size):
        for i in range(size):
            acc_r = acc_g = acc_b = acc_a = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x = (i + (sx + 0.5) / ss) * scale
                    y = (j + (sy + 0.5) / ss) * scale
                    gx = x - half  # 以中心为原点
                    gy = y - half
                    d_rect = sd_rounded_rect(gx, gy, half, RADIUS)
                    if square_opaque:
                        # 直角不透明分支（apple-touch-icon 专用）：底色用站点深色
                        rect_aa = 1.0
                        base = SQUARE_BG
                    else:
                        rect_aa = clamp(0.5 - d_rect, 0.0, 1.0)
                        inside = 1.0
                        if rect_aa <= 0.0:
                            continue
                        t = (x + y) / 128.0
                        base = (
                            BG_A[0] + (BG_B[0] - BG_A[0]) * t,
                            BG_A[1] + (BG_B[1] - BG_A[1]) * t,
                            BG_A[2] + (BG_B[2] - BG_A[2]) * t,
                        )
                    r, g, b = base
                    # 轴（先画，垫底）
                    ca = 0.0
                    for (ax, ay), (bx, by) in AXES:
                        d = dist_segment(x, y, ax, ay, bx, by)
                        ca = max(ca, coverage(d, AXES_W / 2.0) * AXES_ALPHA)
                    r = r + (AXIS[0] - r) * ca
                    g = g + (AXIS[1] - g) * ca
                    b = b + (AXIS[2] - b) * ca
                    # 曲线（后画，压在最上）
                    dc = dist_polyline(x, y, CURVE_POLY)
                    cc = coverage(dc, CURVE_W / 2.0)
                    r = r + (GLYPH[0] - r) * cc
                    g = g + (GLYPH[1] - g) * cc
                    b = b + (GLYPH[2] - b) * cc
                    alpha = rect_aa
                    acc_r += r * alpha
                    acc_g += g * alpha
                    acc_b += b * alpha
                    acc_a += alpha
            n = ss * ss
            if acc_a > 0:
                # premultiplied 还原 + 平均（抗锯齿边缘）
                a = acc_a / n
                px[(j * size + i) * 4 + 0] = int(round(acc_r / acc_a))
                px[(j * size + i) * 4 + 1] = int(round(acc_g / acc_a))
                px[(j * size + i) * 4 + 2] = int(round(acc_b / acc_a))
                px[(j * size + i) * 4 + 3] = int(round(clamp(a) * 255))
            else:
                px[(j * size + i) * 4 + 3] = 0
    return bytes(px)


# ---------- 编码 ----------

def write_png(w, h, rgba, path):
    def chunk(typ, data):
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)

    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * w * 4:(y + 1) * w * 4]
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    return png


def write_ico(pngs, path):
    n = len(pngs)
    offset = 6 + 16 * n
    entries = b''
    blobs = b''
    for size, blob in pngs:
        entries += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(blob), offset + len(blobs))
        blobs += blob
    with open(path, 'wb') as f:
        f.write(struct.pack('<HHH', 0, 1, n) + entries + blobs)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2a2c33"/>
      <stop offset="1" stop-color="#101114"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <path d="M10 55V10M6 54h48" fill="none" stroke="#6b7280" stroke-width="3.2" stroke-linecap="round" opacity=".8"/>
  <path d="M10 47C22 47 26 17 54 17" fill="none" stroke="#f2f3f6" stroke-width="4.5" stroke-linecap="round"/>
</svg>
"""


def main():
    with open(os.path.join(ASSETS, 'favicon.svg'), 'w') as f:
        f.write(SVG)

    blobs = {}
    for size in SIZES:
        square = size == 180  # apple-touch-icon：直角整幅不透明
        rgba = render(size, square_opaque=square)
        name = 'icon-%d.png' % size
        blob = write_png(size, size, rgba, os.path.join(ASSETS, name))
        blobs[size] = blob
        print('%-14s %5d bytes' % (name, len(blob)))

    ico = [(s, blobs[s]) for s in (16, 32, 48)]
    write_ico(ico, os.path.join(ASSETS, 'favicon.ico'))
    print('favicon.ico   %5d bytes（16/32/48 三合一）' % os.path.getsize(os.path.join(ASSETS, 'favicon.ico')))

    # 校验：32px 主图应为 rgba、四角透明、中心不透明
    rgba = render(32)
    center_alpha = rgba[(16 * 32 + 16) * 4 + 3]
    corner_alpha = rgba[(0 * 32 + 0) * 4 + 3]
    assert center_alpha > 200, '中心不透明校验失败: %d' % center_alpha
    assert corner_alpha < 60, '圆角透明校验失败: %d' % corner_alpha
    print('自检通过：32px 圆角（角 alpha=%d，心 alpha=%d）' % (corner_alpha, center_alpha))

    # 主图标 base64，供 HTML 内联（规避 favicon 缓存）
    print('---- 32px PNG base64 长度：%d ----' % len(base64.b64encode(blobs[32])))


if __name__ == '__main__':
    main()
