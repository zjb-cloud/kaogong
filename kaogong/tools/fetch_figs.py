# -*- coding: utf-8 -*-
"""图形推理真题池：本地取题、每周补池，日常不联网。

  来源（都能下到「题图 + 答案」）：
   - quizsim   : lawson2019/quizsim  —— 76 道，每题一句『能看懂的规律解析』（首选）
   - gktuxing  : Cha551/gk-tuxing    —— 354 道，只有答案 + 该类的通用思路（备选）

  用法：
   python tools\\fetch_figs.py            # topup：未用库存 < 目标(默认28) 才联网补差额
   python tools\\fetch_figs.py --init     # 首次/重建：清空后重建（quizsim 全部 + 不预先塞备选）
   python tools\\fetch_figs.py --status
   python tools\\fetch_figs.py --target 28 [--force N]
"""
import io, os, sys, re, json, shutil, zipfile, tempfile, urllib.request, ssl, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).rstrip('\\/')
DATA = os.path.join(ROOT, 'data')
FIGDIR = os.path.join(DATA, 'figs')
POOL = os.path.join(DATA, 'figure_pool.json')
USED = os.path.join(DATA, 'bank', '_used_figs.txt')
QUIZ = ('lawson2019/quizsim', 'https://codeload.github.com/lawson2019/quizsim/zip/refs/heads/main')
GK = ('Cha551/gk-tuxing', 'https://codeload.github.com/Cha551/gk-tuxing/zip/refs/heads/main')

CAT_CN = {'symmetry': '对称性', 'position': '位置规律', 'style': '样式规律', 'face': '面数量',
          'quzhi': '曲直性', 'line': '线数量', 'stroke': '笔画数', 'space': '空间重构',
          'element': '元素', 'other': '其他规律', 'point': '点数量', 'angle': '角', 'special': '特殊规律'}


def load_json(p, d=None):
    return json.load(io.open(p, encoding='utf-8')) if os.path.exists(p) else d


def used_ids():
    if not os.path.exists(USED):
        return set()
    return set(l.strip() for l in io.open(USED, encoding='utf-8') if l.strip())


def download(url, dest):
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    last = None
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})
            io.open(dest, 'wb').write(urllib.request.urlopen(req, timeout=300, context=ctx).read())
            return os.path.getsize(dest)
        except Exception as e:
            last = e; time.sleep(4)
    raise RuntimeError('下载失败 %s：%s' % (url, last))


def fetch_repo(url, tmp):
    zp = os.path.join(tmp, 'r.zip')
    download(url, zp)
    with zipfile.ZipFile(zp) as z:
        z.extractall(tmp)
    for d in os.listdir(tmp):
        p = os.path.join(tmp, d)
        if os.path.isdir(p) and (os.path.isdir(os.path.join(p, 'assets')) or os.path.exists(os.path.join(p, 'test.md'))):
            return p
    raise RuntimeError('解压后找不到仓库目录')


def parse_quizsim(base):
    t = io.open(os.path.join(base, 'test.md'), encoding='utf-8').read()
    seg = t[t.find('# 图形推理 #'):]
    qs, cur, mode = [], None, None
    for ln in seg.split('\n'):
        m = re.match(r'^# (\d+)\s*$', ln)
        if m:
            if cur:
                qs.append(cur)
            cur = {'no': int(m.group(1)), 'stem': [], 'imgs': [], 'nopt': 0, 'ans': '', 'exp': []}
            mode = 'stem'; continue
        if cur is None:
            continue
        s = ln.strip()
        mi = re.match(r'^!\[[^\]]*\]\(([^)]+)\)$', s)
        if mi:
            cur['imgs'].append(mi.group(1)); mode = 'x'; continue
        mo = re.match(r'^([A-H])\s*[:：]\s', ln)
        if mo:
            cur['nopt'] = max(cur['nopt'], ord(mo.group(1)) - ord('A') + 1); mode = 'x'; continue
        ma = re.match(r'^答案\s*[:：]\s*([A-H])', s)
        if ma:
            cur['ans'] = ma.group(1); mode = 'x'; continue
        me = re.match(r'^解析\s*[:：]\s*(.*)$', s)
        if me:
            cur['exp'].append(me.group(1)); mode = 'exp'; continue
        if not s:
            continue
        if mode == 'stem':
            cur['stem'].append(s)
        elif mode == 'exp':
            cur['exp'].append(s)
    if cur:
        qs.append(cur)
    out = []
    for q in qs:
        if not (q['imgs'] and q['ans']):
            continue
        q['nopt'] = q['nopt'] if q['nopt'] >= 2 else 4   # 有些题选项画在图里、未逐条列出，按 4 个处理
        out.append(q)
    return out


def parse_gktuxing(base):
    raw = io.open(os.path.join(base, 'assets', 'data.js'), encoding='utf-8').read()
    return json.loads(raw[raw.index('['):].rstrip().rstrip(';').rstrip())


def save_pool(items):
    json.dump({'v': 2,
               'note': '图形推理真题本地池。quizsim 带逐题解析（首选）；gktuxing 只有答案+通用思路（备选）。仅供个人学习。',
               'items': items},
              io.open(POOL, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)


def add_quizsim(items, base, limit=None):
    have = set(x.get('from') for x in items)
    n = 0
    for q in parse_quizsim(base):
        frm = 'quizsim#%d' % q['no']
        if frm in have:
            continue
        fid = 'figq_%03d' % q['no']
        imgs = []
        for k, rel in enumerate(q['imgs'], 1):
            s = os.path.join(base, rel.replace('/', os.sep))
            if not os.path.exists(s):
                continue
            d = os.path.join(FIGDIR, '%s_%d.png' % (fid, k))
            shutil.copyfile(s, d)
            imgs.append('data/figs/%s_%d.png' % (fid, k))
        if not imgs:
            continue
        stem = ' '.join(q['stem']).strip() or '观察图形的变化规律，选出符合规律的一项。'
        exp = ' '.join(q['exp']).strip() or '（题源未附解析，可对照答案自行归纳规律）'
        items.append({'id': fid, 'from': frm, 'imgs': imgs, 'src': '', 'cat': '', 'catCn': '', 'fmt': '',
                      'stem': stem, 'nopt': q['nopt'], 'ans': q['ans'],
                      'exp': exp, 'trap': ''})
        have.add(frm); n += 1
        if limit and n >= limit:
            break
    print('  quizsim +%d' % n)
    return n


def add_gktuxing(items, base, limit=None):
    have = set(x.get('from') for x in items)
    used_n = collections.Counter()
    for x in items:
        m = re.match(r'^figk_(\d+)$', x['id'])
        if m:
            used_n['k'] = max(used_n['k'], int(m.group(1)))
    n = 0
    for q in parse_gktuxing(base):
        frm = 'gk#%s' % q['id']
        if frm in have:
            continue
        s = os.path.join(base, q['img'].replace('/', os.sep))
        if not os.path.exists(s):
            continue
        used_n['k'] += 1
        fid = 'figk_%03d' % used_n['k']
        shutil.copyfile(s, os.path.join(FIGDIR, fid + '.png'))
        items.append({'id': fid, 'from': frm, 'imgs': ['data/figs/%s.png' % fid],
                      'src': q.get('src', ''), 'cat': q.get('cat', ''), 'catCn': CAT_CN.get(q.get('cat', ''), ''),
                      'fmt': q.get('fmt', ''), 'stem': '', 'nopt': 4, 'ans': q.get('ans', 'A'),
                      'exp': q.get('exp', ''), 'trap': q.get('trap', '')})
        have.add(frm); n += 1
        if limit and n >= limit:
            break
    print('  gktuxing +%d' % n)
    return n


def main():
    a = sys.argv[1:]
    items = [] if '--init' in a else (load_json(POOL, {}) or {}).get('items', [])
    if '--status' in a:
        u = used_ids()
        left = len([x for x in items if x['id'] not in u])
        print('题池 %d 道，未用 %d 道，图片 %d 个' % (len(items), left,
              len(os.listdir(FIGDIR)) if os.path.isdir(FIGDIR) else 0))
        return
    target = int(a[a.index('--target') + 1]) if '--target' in a else 28
    force = int(a[a.index('--force') + 1]) if '--force' in a else None

    if '--init' in a:
        if os.path.isdir(FIGDIR):
            shutil.rmtree(FIGDIR)
        os.makedirs(FIGDIR, exist_ok=True)
    else:
        u = used_ids()
        left = len([x for x in items if x['id'] not in u])
        if force is None and left >= target:
            print('ok 库存充足（未用 %d ≥ %d），不联网' % (left, target))
            return

    tmp = tempfile.mkdtemp(prefix='figfetch_')
    try:
        if '--init' in a:
            print('重建题池…')
            add_quizsim(items, fetch_repo(QUIZ[1], os.path.join(tmp, 'a')))
        else:
            print('补池…')
            add_quizsim(items, fetch_repo(QUIZ[1], os.path.join(tmp, 'a')))
            u = used_ids()
            need = force if force is not None else (target - len([x for x in items if x['id'] not in u]))
            if need > 0:
                add_gktuxing(items, fetch_repo(GK[1], os.path.join(tmp, 'b')), limit=need)
        save_pool(items)
        print('池子共 %d 道' % len(items))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
