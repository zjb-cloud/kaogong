# -*- coding: utf-8 -*-
"""用正确关键词复核线上 shenlun.js / all.js 是否含本期解读"""
import os, io, json, base64, urllib.request

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
o = io.open(os.path.join(BASE, r'tools\_gov_verify3.txt'), 'w', encoding='utf-8')

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

kws = ['行动路线图', '财政金融协同促内需', '140.19万亿', '新增城镇就业1200万人']
for rel in ('data/shenlun.js',):
    txt = get_text(rel)
    if txt is None:
        log(rel + ' 无法获取')
        continue
    log('ONLINE %s bytes=%d' % (rel, len(txt.encode('utf-8'))))
    for k in kws:
        log('  kw[%s] = %s' % (k, k in txt))

# 线上 shenlun.js 里 economy 条数
try:
    import re
    m = re.search(r'"cats":\s*\[', txt)
    log('has cats array: ' + str(bool(m)))
    # 数 items
    n_items = len(re.findall(r'"date":\s*"2026-10-20"', txt))
    log('date=2026-10-20 条数: ' + str(n_items))
except Exception as e:
    log('regex err ' + str(e))

log('DONE')
o.close()
