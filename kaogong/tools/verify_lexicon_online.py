# -*- coding: utf-8 -*-
"""验证线上：lexicon.js 5万词 + all.js + 站点 + 抽词"""
import os, io, re, json, urllib.request

o = io.open(r'C:\Users\Administrator\.openclaw\workspace\kaogong\tools\_dict_dl\_verify.txt', 'w', encoding='utf-8')
def log(s):
    o.write(s + '\n'); o.flush()

H = {'User-Agent': 'Mozilla/5.0'}
def get(url, timeout=180):
    return urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=timeout).read()

# 1) 站点
try:
    r = urllib.request.urlopen(urllib.request.Request('https://zjb-cloud.github.io/kaogong/', headers=H), timeout=60)
    log('站点首页 HTTP %s' % r.status)
except Exception as e:
    log('站点 ERR %s' % e)

# 2) lexicon.js 词数
b = get('https://zjb-cloud.github.io/kaogong/data/lexicon.js')
log('lexicon.js bytes=%d' % len(b))
t = b.decode('utf-8', errors='replace')
m = re.search(r'window\.KG_LEXICON = (\[.*?\]);\s*$', t, re.S)
lx = json.loads(m.group(1))
log('lexicon.js 词数=%d' % len(lx))

# 3) 抽词验证
words = ['babble', 'bubble', 'thread', 'abortifacients', 'butylcellosolve', 'persevere', 'surreptitious']
mp = {x['w']: x for x in lx}
for w in words:
    hit = mp.get(w)
    log('  抽词 %-18s => %s' % (w, (hit.get('cn') or '')[:60] if hit else '未收录'))

# 4) all.js 含 KG_LEXICON 且词数一致
b2 = get('https://zjb-cloud.github.io/kaogong/data/all.js')
log('all.js bytes=%d' % len(b2))
t2 = b2.decode('utf-8', errors='replace')
m2 = re.search(r'window\.KG_LEXICON = (\[.*?\]);\s*$', t2, re.S)
lx2 = json.loads(m2.group(1))
log('all.js 内 KG_LEXICON 词数=%d' % len(lx2))
log('DONE')
o.close()
