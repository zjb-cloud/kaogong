# -*- coding: utf-8 -*-
"""下载 GitHub Pages 线上 all.js，验证 KG_VOCAB_PLAN 含 egCn 增强数据 + 站点 200"""
import os, io, urllib.request

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
o = io.open(os.path.join(BASE, r'tools\_sbook_verify2.txt'), 'w', encoding='utf-8')
def log(s):
    o.write(s + '\n'); o.flush()

url = 'https://zjb-cloud.github.io/kaogong/data/all.js'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=180) as r:
        b = r.read()
    log('all.js HTTP %s bytes=%d' % (r.status, len(b)))
    txt = b.decode('utf-8', errors='replace')
    # KG_VOCAB_PLAN 段含 egCn
    i = txt.find('KG_VOCAB_PLAN')
    seg = txt[i:i+400000] if i >= 0 else ''
    log('含 KG_VOCAB_PLAN: %s' % (i >= 0))
    log('  KG_VOCAB_PLAN 段含 egCn: %s' % ('egCn' in seg))
    log('  KG_VOCAB_PLAN 段含 "forms": %s' % ('"forms"' in seg))
    # 前端页面 200
    req2 = urllib.request.Request('https://zjb-cloud.github.io/kaogong/', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req2, timeout=60) as r2:
        log('站点首页 HTTP %s' % r2.status)
except Exception as e:
    log('ERR %s' % e)
log('DONE')
o.close()
