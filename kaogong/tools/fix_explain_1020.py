# -*- coding: utf-8 -*-
"""补 issue-047/048 的 q.explain（从 bankq_cs 真题池按 src 匹配取解析）"""
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
cs = json.load(open(BASE + r'\data\bankq\bankq_cs.json', encoding='utf-8'))
qs = cs.get('questions', [])
# 按 (src, stem前30字) 建索引
from collections import defaultdict
idx = defaultdict(list)
for q in qs:
    if q.get('kind') == 'real':
        key = (q.get('src', ''), q.get('stem', '')[:30])
        idx[key].append(q)

def clean_sol(s):
    if not s:
        return ''
    s = s.strip()
    s = re.sub(r'^解析[:：]?\s*', '', s)
    return s

for no in (47, 48):
    path = BASE + r'\data\issue-%03d.json' % no
    d = json.load(open(path, encoding='utf-8'))
    fixed = 0
    for it in d['items']:
        src = it.get('src', '')
        stem30 = it.get('q', {}).get('stem', '')[:30]
        cands = idx.get((src, stem30)) or []
        if not cands:
            # 放宽：按 stem 前30字匹配
            cands = [q for q in qs if q.get('stem', '')[:30] == stem30]
        if cands:
            sol = clean_sol((cands[0].get('ana') or {}).get('sol', ''))
            if sol:
                it['q']['explain'] = sol
                fixed += 1
        else:
            print('NO MATCH issue', no, src[:40], stem30[:20])
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('issue', no, 'fixed explain:', fixed, '/', len(d['items']))

# vocab-024 第17词 orphan 补 syn（rel.form 被清洗后非空兜底）
vp = BASE + r'\data\vocab-024.json'
vd = json.load(open(vp, encoding='utf-8'))
w17 = vd['words'][16]
if w17['w'] == 'orphan':
    w17['rel']['syn'] = ['waif']
    w17['relCn']['syn'] = ['n. 流浪儿，无家可归者']
json.dump(vd, open(vp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('vocab-024 orphan rel:', w17['rel'])
