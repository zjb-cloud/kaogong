"""生成 PWA 图标（纯 Python，不依赖任何图像库）
   画一个圆角方底 + 白色书本（书脊 + 两页），再输出 192 / 512 / 180(apple-touch) 三种尺寸。"""
import zlib, struct, os

BG = (74, 108, 247)      # #4a6cf7
BG2 = (122, 162, 255)    # 渐变顶端
WHITE = (255, 255, 255)
SPINE = (74, 108, 247)


def blend(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def rounded(x, y, w, h, r):
    """点 (x,y) 是否在圆角矩形内"""
    if x < 0 or y < 0 or x > w or y > h:
        return False
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def render(size, pad_ratio=0.11):
    """画一张 size×size 的图，返回像素行列表"""
    pad = size * pad_ratio
    box = size - 2 * pad
    R = box * 0.24
    rows = []
    # 书本几何（相对 box 的比例）
    bgx, bgy = pad + box * 0.20, pad + box * 0.26
    bgw, bgh = box * 0.60, box * 0.48
    br = box * 0.05
    spine_w = max(2.0, box * 0.035)
    cx = bgx + bgw / 2
    for y in range(size):
        row = []
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            if not rounded(px, py, size, size, R):
                row.append((0, 0, 0, 0))
                continue
            # 底色：竖向渐变
            t = py / size
            col = blend(BG2, BG, t)
            # 书本两页
            if rounded(px, py, bgx + bgw, bgy + bgh, br) and px >= bgx and px <= bgx + bgw:
                if abs(px - cx) <= spine_w / 2:
                    col = blend(col, WHITE, 0.55)   # 书脊稍暗
                else:
                    col = WHITE
            row.append((col[0], col[1], col[2], 255))
        rows.append(row)
    return rows


def write_png(path, rows):
    h = len(rows)
    w = len(rows[0])
    raw = b''.join(b'\x00' + b''.join(struct.pack('BBBB', *p) for p in r) for r in rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


here = os.path.dirname(os.path.abspath(__file__))
for size, name in ((192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')):
    n = write_png(os.path.join(here, name), render(size))
    print('OK %s %dx%d %d bytes' % (name, size, size, n))
