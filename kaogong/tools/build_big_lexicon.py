# -*- coding: utf-8 -*-
"""build_big_lexicon.py — 用 ECDICT(63MB) 扩充预备词库 lexicon.json
规则：
- 保留现有 14,625 词（优先，释义不动）；
- 从 ecdict.csv 补充：纯英文单词 + 中文释义非空；
  优先级①带考试标签(zk/gk/cet4/cet6/ky/toefl/ielts/gre/gaokao/ielts)的词 ②frq 词频高的词；
- 目标总量约 50,000 词；按字母排序输出 {w, cn, ph}。
"""
import csv, io, json, os, sys, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
DATA = os.path.join(BASE, 'data')
SRC = r'C:\Users\Administrator\.openclaw\workspace\kaogong\tools\_dict_dl\_unzip\ECDICT-master\ecdict.csv'
TARGET = 50000

# 现有词
old = json.load(open(os.path.join(DATA, 'lexicon.json'), encoding='utf-8'))
old_map = {}
for x in old:
    k = (x.get('w') or '').lower()
    if k and k not in old_map:
        old_map[k] = x
print('现有词库:', len(old_map))

WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z'\-]*$")
TAG_OK = {'zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre', 'gaokao'}

new_exam = []   # 带考试标签
new_common = [] # 无标签但高频
seen = set(old_map.keys())

def clean_trans(t):
    t = (t or '').strip()
    if not t:
        return ''
    t = t.replace('\r', ' ').replace('\n', '；').replace('；；', '；')
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) > 260:
        t = t[:260] + '…'
    return t

n = 0
with open(SRC, 'r', encoding='utf-8', errors='replace') as f:
    r = csv.DictReader(f)
    for row in r:
        w = (row.get('word') or '').strip().lower()
        if not WORD_RE.match(w) or len(w) > 25 or len(w) < 2:
            continue
        if w in seen:
            continue
        cn = clean_trans(row.get('translation'))
        if not cn:
            continue
        ph = (row.get('phonetic') or '').strip()
        tag = row.get('tag') or ''
        frq = row.get('frq') or ''
        try:
            frq_v = int(frq) if frq.strip().isdigit() else 0
        except Exception:
            frq_v = 0
        has_tag = any(t in tag for t in TAG_OK)
        rec = {'w': w, 'cn': cn, 'ph': ph, '_frq': frq_v}
        (new_exam if has_tag else new_common).append(rec)
        seen.add(w)
        n += 1
        if n % 100000 == 0:
            print('... 扫描 %d' % n)

print('扫描候选: 带标签 %d / 普通 %d' % (len(new_exam), len(new_common)))

# 排序：带标签的按 frq 降序；普通也按 frq 降序
new_exam.sort(key=lambda x: -x['_frq'])
new_common.sort(key=lambda x: -x['_frq'])

# 组装：现有 + 带标签 + 普通，直到 5 万
out = []
for x in old_map.values():
    out.append({'w': x['w'], 'cn': x.get('cn', ''), 'ph': x.get('ph', '')})
remain = TARGET - len(out)
for x in new_exam:
    if remain <= 0:
        break
    out.append({'w': x['w'], 'cn': x['cn'], 'ph': x['ph']})
    remain -= 1
for x in new_common:
    if remain <= 0:
        break
    out.append({'w': x['w'], 'cn': x['cn'], 'ph': x['ph']})
    remain -= 1

out.sort(key=lambda x: x['w'].lower())
json.dump(out, open(os.path.join(DATA, 'lexicon.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('最终词库: %d 词' % len(out))
print('样例:', json.dumps(out[1000:1003], ensure_ascii=False)[:300])
