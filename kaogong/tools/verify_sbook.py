# -*- coding: utf-8 -*-
"""验证线上 app.js 修复代码 + vocab_plan.js 增强数据"""
import os, io, json, base64, urllib.request

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
o = io.open(os.path.join(BASE, r'tools\_sbook_verify.txt'), 'w', encoding='utf-8')
def log(s):
    o.write(s + '\n'); o.flush()

token = open(os.path.join(BASE, '.gh_token'), encoding='utf-8').read().strip()
def get_text(rel):
    url = 'https://api.github.com/repos/zjb-cloud/kaogong/contents/' + rel + '?ref=main'
    req = urllib.request.Request(url)
    req.add_header('Authorization', 'token ' + token)
    req.add_header('User-Agent', 'kaogong-local')
    req.add_header('Accept', 'application/vnd.github+json')
    with urllib.request.urlopen(req, timeout=60) as r:
        g = json.loads(r.read().decode('utf-8'))
    if 'content' in g and g.get('encoding') == 'base64':
        return base64.b64decode(g['content']).decode('utf-8', errors='replace')
    return None

# app.js
a = get_text('app.js')
if a is None:
    log('app.js 无法获取（可能超1MB）')
else:
    log('app.js bytes=%d' % len(a.encode('utf-8')))
    for k in ['planWord(e.w) || {}', 'Object.keys(v.rel).length ? v.rel : e.rel',
              'v.egCn || e.egCn', 'p.egCn || \'\'', 'p.rel || {}, relCn: p.relCn || {}']:
        log('  kw[%s]=%s' % (k, k in a))

# vocab_plan.js
v = get_text('data/vocab_plan.js')
if v is None:
    log('vocab_plan.js 无法获取')
else:
    log('vocab_plan.js bytes=%d' % len(v.encode('utf-8')))
    log('  kw[egCn]=%s' % ('egCn' in v))
    log('  kw[rel]=%s' % ('"rel"' in v))
    log('  kw[forms]=%s' % ('"forms"' in v))

log('DONE')
o.close()
