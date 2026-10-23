# -*- coding: utf-8 -*-
"""从 bankq_pd.json 导入『真假推理』真题进 lj_pool.json（2026-10-20，池耗尽补题）"""
import json, re

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
PD = BASE + r'\data\bankq\bankq_pd.json'
POOL = BASE + r'\data\bank\lj_pool.json'

pd = json.load(open(PD, encoding='utf-8'))
qs = pd.get('questions', [])
zj = [q for q in qs if q.get('kind') == 'real' and q.get('topic') == '真假推理']
print('pd 真假推理 real:', len(zj))

pool = json.load(open(POOL, encoding='utf-8'))
items = pool['items']
existing_ids = {str(x['qid']) for x in items}
print('pool 现有 items:', len(items))

pat = re.compile(r'^(.*?)\s*第\s*(\d+)\s*题\s*$')
added = 0
for q in zj:
    new_id = 'PD' + str(q['id'])
    if new_id in existing_ids:
        continue
    m = pat.match(q.get('src', ''))
    exam = m.group(1) if m else q.get('src', '')
    qno = int(m.group(2)) if m else 0
    ana = q.get('ana', {}) or {}
    explain = (ana.get('sol') or '').strip()
    items.append({
        'qid': new_id,
        'exam': exam,
        'qno': qno,
        'cat': '真假推理',
        'stem': q['stem'],
        'options': q['options'],
        'answer': q['ans'],
        'explain': explain,
    })
    existing_ids.add(new_id)
    added += 1

json.dump(pool, open(POOL, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('追加真假推理:', added, '→ pool 总 items:', len(items))

# 删除本轮 8 题版 lj-005（将重做为 9 题版）
import os
p5 = BASE + r'\data\lj-005.json'
if os.path.exists(p5):
    os.remove(p5)
    print('已删除 lj-005.json（8题版，待重做9题版）')
