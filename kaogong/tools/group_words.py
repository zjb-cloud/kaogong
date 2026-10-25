# -*- coding: utf-8 -*-
"""
分组滚动复习 · 数据生成器
把全部单词库按「同词根 / 同前后缀 / 形近 / 近义」特征聚类成固定组（每组 10-24 词），
无特征词混排兜底。组号固定、组内单词固定，供前端滚动复习。
输出 data/groups.js: window.KG_GROUPS = [{g, tag, n, words:[{w, cn}]}, ...]
"""
import json, io, os, re, glob
from collections import Counter, defaultdict

ROOT = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
DATA = os.path.join(ROOT, 'data')

def load_js(name):
    txt = io.open(os.path.join(DATA, name), encoding='utf-8').read()
    txt = re.sub(r'^window\.[A-Z_]+ = ', '', txt).rstrip().rstrip(';')
    return json.loads(txt)

# ---------- 1. 收集词表 ----------
plan = load_js('vocab_plan.js')   # 2000 词计划（含详情）
plan_by_w = {w['w']: w for w in plan}

# 实际词表（vocab-*.json 去重）+ 词素 + rel
words_meta = {}   # w -> {cn, forms, rel_form, rel_syn}
for f in sorted(glob.glob(os.path.join(DATA, 'vocab-*.json'))):
    d = json.load(io.open(f, encoding='utf-8'))
    words_list = d.get('words', []) if isinstance(d, dict) else d
    for w in words_list:
        wd = w.get('w')
        if not wd:
            continue
        rel = w.get('rel') or {}
        relCn = w.get('relCn') or {}
        words_meta.setdefault(wd, {
            'cn': w.get('cn', ''),
            'form': rel.get('form') or [],
            'formCn': relCn.get('form') or [],
            'syn': rel.get('syn') or [],
            'synCn': relCn.get('syn') or [],
        })
# 用计划补全未在 vocab 批次的词（2000 计划里的）
for wd, pw in plan_by_w.items():
    words_meta.setdefault(wd, {
        'cn': pw.get('cn', ''),
        'form': (pw.get('rel') or {}).get('form') or [],
        'formCn': ((pw.get('relCn') or {}).get('form') or []),
        'syn': (pw.get('rel') or {}).get('syn') or [],
        'synCn': ((pw.get('relCn') or {}).get('syn') or []),
    })

all_words = list(words_meta.keys())
print('word pool:', len(all_words))

# ---------- 2. 词素特征 ----------
morph = load_js('morph.js')
word_roots = {}   # w -> [(root, cn)]
word_sufs = {}    # w -> [(suf, cn)]
for wd, info in morph.items():
    for p in info.get('morph', []):
        k, pp, c = p.get('k', ''), p.get('p', ''), p.get('c', '')
        if k in ('词根', '词干'):
            word_roots.setdefault(wd, []).append((pp, c))
        elif k == '后缀':
            word_sufs.setdefault(wd, []).append((pp, c))

# ---------- 3. 聚类 ----------
assigned = set()
groups = []   # {tag, words:[w,...]}
weak = []     # 弱特征池（2 词小族/小链合流，凑大组）

def words_cn(ws):
    return [{'w': w, 'cn': words_meta[w]['cn']} for w in ws]

def add_group(tag, ws, weak_ok=True):
    ws = [w for w in ws if w not in assigned]
    if len(ws) >= 3:
        assigned.update(ws)
        groups.append({'tag': tag, 'words': ws})
        return True
    elif len(ws) == 2 and weak_ok:
        weak.append((tag, ws))
        return False
    return False

# 3.1 词根族（同词根 ≥2 词；≥3 成组，2 词进弱池）
root_map = defaultdict(list)
for wd, rs in word_roots.items():
    for r, c in rs:
        root_map[r].append(wd)
for r, ws in sorted(root_map.items(), key=lambda kv: -len(kv[1])):
    if len(ws) >= 2:
        if len(ws) <= 24:
            add_group('词根 %s 家族' % r, ws)
        else:
            ws = sorted(ws)
            for i in range(0, len(ws), 20):
                add_group('词根 %s 家族' % r, ws[i:i+20])

# 3.2 后缀族（同后缀 ≥3 词，拆 ≤20；2 词进弱池）
suf_map = defaultdict(list)
for wd, ss in word_sufs.items():
    for s, c in ss:
        suf_map[s].append(wd)
for s, ws in sorted(suf_map.items(), key=lambda kv: -len(kv[1])):
    un = [w for w in ws if w not in assigned]
    if len(un) >= 3:
        by_root = defaultdict(list)
        for w in un:
            r0 = word_roots.get(w, [])
            by_root[(r0[0][0] if r0 else '')].append(w)
        chunks = []
        for r0, wws in sorted(by_root.items(), key=lambda kv: -len(kv[1])):
            if r0 and len(wws) >= 2:
                chunks.append(('词根%s+后缀-%s' % (r0, s), wws))
        rest = [w for w in un if not any(w in ww for _, ww in chunks)]
        if rest:
            chunks.append(('后缀 -%s 家族' % s, rest))
        for tg, wws in chunks:
            wws = sorted(wws)
            for i in range(0, len(wws), 20):
                add_group(tg, wws[i:i+20])
    elif len(un) == 2:
        weak.append(('后缀 -%s 家族' % s, un))

# 3.3 形近链（rel.form 连通分量；≥3 成组，2 词链进弱池）
class UF:
    def __init__(self, keys):
        self.p = {k: k for k in keys}
    def find(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra

uf = UF(all_words)
for w, meta in words_meta.items():
    for fx in meta['form']:
        if fx in words_meta:
            uf.union(w, fx)
form_sets = defaultdict(list)
for w in all_words:
    form_sets[uf.find(w)].append(w)
for _, ws in form_sets.items():
    if len(ws) >= 3:
        add_group('形近词', ws)
    elif len(ws) == 2:
        weak.append(('形近词', ws))

# 3.4 近义链（rel.syn 连通分量；≥3 成组，2 词链进弱池）
uf2 = UF(all_words)
for w, meta in words_meta.items():
    for sx in meta['syn']:
        if sx in words_meta:
            uf2.union(w, sx)
syn_sets = defaultdict(list)
for w in all_words:
    syn_sets[uf2.find(w)].append(w)
for _, ws in syn_sets.items():
    if len(ws) >= 3:
        add_group('近义词', ws)
    elif len(ws) == 2:
        weak.append(('近义词', ws))

# 3.5 弱特征池合流：凑 10-16 词一组（保留原始 2 词小链，组内仍可配对联想）
weak_words = set()
for _, ws in weak:
    weak_words.update(ws)
weak_rest = [w for w in weak_words if w not in assigned]
if weak_rest:
    # 按字母序凑组（12/组），tag 标「形近/近义词」
    weak_rest = sorted(weak_rest, key=lambda w: (w.lower(), w))
    for i in range(0, len(weak_rest), 12):
        chunk = [w for w in weak_rest[i:i+12] if w not in assigned]
        if len(chunk) >= 2:
            add_group('形近/近义词', chunk, weak_ok=False)

# 3.6 兜底：未分组词按字母序，每 12 个一组
rest = [w for w in all_words if w not in assigned]
rest = sorted(rest, key=lambda w: (w.lower(), w))
for i in range(0, len(rest), 12):
    chunk = rest[i:i+12]
    if len(chunk) >= 2:
        add_group('综合词', chunk, weak_ok=False)
# 单条漏网之鱼并入最后一个综合组
remain = [w for w in all_words if w not in assigned]
if remain:
    groups.append({'tag': '综合词', 'words': remain})

# ---------- 4. 输出 ----------
out = []
g = 1
for grp in groups:
    ws = grp['words']
    if not ws:
        continue
    out.append({'g': g, 'tag': grp['tag'], 'n': len(ws),
                'words': [{'w': w, 'cn': words_meta[w]['cn']} for w in ws]})
    g += 1

total = sum(x['n'] for x in out)
print('groups:', len(out), 'words covered:', total)
print('size dist:', Counter(x['n'] for x in out).most_common(10))
print('sample group1:', json.dumps(out[0], ensure_ascii=False)[:220])
print('sample group2:', json.dumps(out[1], ensure_ascii=False)[:220])

js = 'window.KG_GROUPS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
outp = os.path.join(DATA, 'groups.js')
io.open(outp, 'w', encoding='utf-8').write(js)
print('written:', outp, len(js), 'bytes')

# 追加到 vocab.js 尾部（同一 script 加载，前端无需改 dataNeed；Actions 每日构建自动带上）
vj = os.path.join(DATA, 'vocab.js')
if os.path.exists(vj):
    vtxt = io.open(vj, encoding='utf-8').read()
    if 'window.KG_GROUPS' not in vtxt:
        vtxt = vtxt.rstrip() + '\n' + js
        io.open(vj, 'w', encoding='utf-8').write(vtxt)
        print('merged KG_GROUPS into vocab.js', len(vtxt), 'bytes')
    else:
        print('vocab.js already has KG_GROUPS, skip merge')
