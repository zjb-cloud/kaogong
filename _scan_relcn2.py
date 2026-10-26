# -*- coding: utf-8 -*-
"""精确扫描 KG_VOCAB：rel 有词但 relCn 缺失的明细 + 批次分布"""
import re, json, io, sys

path = r'C:\Users\Administrator\kgpages\data\vocab.js'
s = open(path, encoding='utf-8', errors='replace').read()
print('file len:', len(s))
# 找到 KG_VOCAB 定义范围
m = re.search(r'window\.KG_VOCAB\s*=\s*(\[.*?\]);', s, re.S)
if not m:
    print('KG_VOCAB not found'); sys.exit()
arr = json.loads(m.group(1))
print('KG_VOCAB batches:', len(arr))
print('first batch keys:', list(arr[0].keys()))
print('last batch date:', arr[-1].get('date'), 'words:', len(arr[-1].get('words', [])))

# 每批次缺 relCn.form 的词条
total_words = 0; missing_words = []
by_batch = {}
for b in arr:
    bno = b.get('batch')
    for w in b.get('words', []):
        total_words += 1
        rel = w.get('rel') or {}
        relcn = w.get('relCn') or {}
        for k in ('form', 'sound', 'syn'):
            ra = rel.get(k) or []
            ca = relcn.get(k) or []
            if ra and not ca:
                missing_words.append((bno, w.get('w'), k, ra))
                by_batch.setdefault(bno, 0)
                by_batch[bno] += 1
print('total words:', total_words)
print('missing entries:', len(missing_words))
print('by batch:', dict(sorted(by_batch.items())))
for x in missing_words[:40]:
    print('  batch', x[0], x[1], x[2], x[3])
# relation 词条
for b in arr:
    for w in b.get('words', []):
        if w.get('w') == 'relation':
            print('RELATION full:', json.dumps(w, ensure_ascii=False)[:1200])
