# -*- coding: utf-8 -*-
# 把 10/1 提前冒出来的「晚间」内容挪回 9/30 晚上，并把 10/1 早间内容接回正确的期号
import json, os

D = r'C:\Users\Administrator\.openclaw\workspace\kaogong\data'

def load(p):
    with open(os.path.join(D, p), encoding='utf-8') as f:
        return json.load(f)

def save(p, o):
    with open(os.path.join(D, p), 'w', encoding='utf-8') as f:
        json.dump(o, f, ensure_ascii=False, indent=1)

# ---- 考公：008 <-> 009 互换 ----
pm = load('issue-009.json')   # 现在存的是 10/1 pm（矛盾/社会存在…）→ 归位为 9/30 pm
am = load('issue-008.json')   # 现在存的是 10/1 am（意识能动性…）→ 期号变 009
pm['issue'], pm['date'], pm['session'] = 8, '2026-09-30', 'pm'
am['issue'], am['date'], am['session'] = 9, '2026-10-01', 'am'
save('issue-008.json', pm)
save('issue-009.json', am)

# ---- 词语：007 <-> 008 互换 ----
pm2 = load('idiom-008.json')  # 首当其冲… → 9/30 pm（set 7）
am2 = load('idiom-007.json')  # 望尘莫及… → 10/1 am（set 8）
pm2['set'], pm2['date'], pm2['session'] = 7, '2026-09-30', 'pm'
am2['set'], am2['date'], am2['session'] = 8, '2026-10-01', 'am'
save('idiom-007.json', pm2)
save('idiom-008.json', am2)

# ---- 填空选词：同步互换 ----
pm3 = load('idiomfill-008.json')
am3 = load('idiomfill-007.json')
pm3['set'], pm3['date'], pm3['session'] = 7, '2026-09-30', 'pm'
am3['set'], am3['date'], am3['session'] = 8, '2026-10-01', 'am'
save('idiomfill-007.json', pm3)
save('idiomfill-008.json', am3)

# ---- 删掉提前写好的 10/1 晚间推送文案/回执（今晚 19:55 会重新生成）----
for name in ('push-2026-10-01-pm.txt', 'push-2026-10-01-pm.sent'):
    p = os.path.join(D, name)
    if os.path.exists(p):
        os.remove(p)
        print('removed', name)

print('done')
