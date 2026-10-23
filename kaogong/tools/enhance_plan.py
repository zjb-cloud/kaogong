# -*- coding: utf-8 -*-
"""enhance_plan.py — 增强 vocab-plan.json（四级核心词表）：
1) 把英语角词表(vocab-0*.json)里已有的 eg/egCn/rel/relCn/forms/ph 按词合并进 PLAN；
2) 仍缺 forms 的词调用 vocab_forms.enrich_word 补词形；
3) 写回 vocab-plan.json（保持数组结构，n 序号不变）。
不修改 w/ph/cn，不新增词，不删除词。"""
import os, io, sys, json, glob

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
DATA = os.path.join(BASE, 'data')
sys.path.insert(0, os.path.join(BASE, 'tools'))
from vocab_forms import enrich_word

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 1) 英语角词表 → w 映射
full = {}
for f in sorted(glob.glob(os.path.join(DATA, 'vocab-0*.json'))):
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        print('skip', f, e); continue
    for w in d.get('words', []):
        if w.get('w'):
            full[w['w'].lower()] = w

print('英语角词表去重后:', len(full))

# 2) PLAN 增强
plan = json.load(open(os.path.join(DATA, 'vocab-plan.json'), encoding='utf-8'))
merged = 0; forms_added = 0
for p in plan:
    w = p.get('w', '').lower()
    src = full.get(w)
    if src:
        for k in ('eg', 'egCn', 'rel', 'relCn', 'forms', 'ph'):
            if src.get(k) and not p.get(k):
                p[k] = src[k]
        merged += 1
    if not p.get('forms'):
        enrich_word(p)
        if p.get('forms'):
            forms_added += 1

json.dump(plan, open(os.path.join(DATA, 'vocab-plan.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('合并英语角字段词数:', merged)
print('补 forms 词数:', forms_added)

# 3) 覆盖率统计
n_eg = sum(1 for p in plan if p.get('eg'))
n_egcn = sum(1 for p in plan if p.get('egCn'))
n_rel = sum(1 for p in plan if p.get('rel') and (p['rel'].get('form') or p['rel'].get('sound') or p['rel'].get('syn')))
n_relcn = sum(1 for p in plan if p.get('relCn'))
n_forms = sum(1 for p in plan if p.get('forms'))
print('PLAN 总数 %d：eg=%d egCn=%d rel=%d relCn=%d forms=%d' % (
    len(plan), n_eg, n_egcn, n_rel, n_relcn, n_forms))
