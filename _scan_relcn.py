# -*- coding: utf-8 -*-
"""扫描 KG_VOCAB / KG_VOCAB_PLAN 中 rel 与 relCn 数量不一致（形近/音近/近义缺中文）的词条"""
import re, sys, io, json

def load_js_array(path, varname):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        s = f.read()
    m = re.search(varname + r'\s*=\s*\[(.*?)\];', s, re.S)
    if not m:
        return None, s
    arr = json.loads('[' + m.group(1) + ']')
    return arr, s

def check(words, tag):
    total = 0; rel_no_cn = []; len_mismatch = []; rel_missing_cn_block = []
    for b in words:
        for w in (b.get('words') or []):
            rel = w.get('rel') or {}
            relCn = w.get('relCn') or {}
            for k in ('form', 'sound', 'syn'):
                arr = rel.get(k) or []
                cn = relCn.get(k) or []
                if not arr:
                    continue
                total += 1
                if not cn:
                    rel_no_cn.append((w.get('w'), k, arr[:5]))
                elif len(arr) != len(cn):
                    len_mismatch.append((w.get('w'), k, len(arr), len(cn), arr[:5], cn[:5]))
            if rel and not relCn:
                rel_missing_cn_block.append(w.get('w'))
    print(f'== {tag} ==')
    print(f'rel 有词条的分组维度数 total={total}')
    print(f'rel 有词但 relCn 该维度完全为空: {len(rel_no_cn)}')
    for x in rel_no_cn[:15]:
        print('  NO_CN:', x)
    print(f'rel/relCn 长度不一致: {len(len_mismatch)}')
    for x in len_mismatch[:15]:
        print('  LEN:', x)
    print(f'rel 有内容但整个 relCn 缺失的词条数: {len(rel_missing_cn_block)}')
    for x in rel_missing_cn_block[:10]:
        print('  BLOCK:', x)

vocab, _ = load_js_array(r'C:\Users\Administrator\kgpages\data\vocab.js', 'window.KG_VOCAB')
if vocab is None:
    print('vocab.js KG_VOCAB parse failed')
else:
    check(vocab, 'vocab.js KG_VOCAB')

plan, _ = load_js_array(r'C:\Users\Administrator\kgpages\data\vocab_plan.js', 'window.KG_VOCAB_PLAN')
if plan is None:
    print('vocab_plan.js parse failed, try alt pattern')
    s2 = open(r'C:\Users\Administrator\kgpages\data\vocab_plan.js', encoding='utf-8', errors='replace').read()
    print(s2[:300])
else:
    check(plan, 'vocab_plan.js KG_VOCAB_PLAN')
