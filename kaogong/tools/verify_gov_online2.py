# -*- coding: utf-8 -*-
"""精确核验本地/线上 shenlun.js、all.js 是否含本期解读（python 直读，避免编码误报）"""
import os, io, sys, json, base64, urllib.request

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
o = io.open(os.path.join(BASE, r'tools\_gov_verify2.txt'), 'w', encoding='utf-8')

def log(s):
    o.write(s + '\n'); o.flush()

# 本地
for rel in ('data/shenlun.js', 'data/all.js'):
    p = os.path.join(BASE, rel.replace('/', os.sep))
    b = open(p, 'rb').read()
    txt = b.decode('utf-8', errors='replace')
    log('LOCAL %s bytes=%d has=%s' % (rel, len(b), ('政府工作报告深度解读' in txt)))

# 线上（blob API 拿原始内容）
token = open(os.path.join(BASE, '.gh_token'), encoding='utf-8').read().strip()
def get_blob(rel):
    url = 'https://api.github.com/repos/zjb-cloud/kaogong/contents/' + rel + '?ref=main'
    req = urllib.request.Request(url)
    req.add_header('Authorization', 'token ' + token)
    req.add_header('User-Agent', 'kaogong-local')
    req.add_header('Accept', 'application/vnd.github+json')
    with urllib.request.urlopen(req, timeout=60) as r:
        g = json.loads(r.read().decode('utf-8'))
    if 'content' in g and g.get('encoding') == 'base64':
        return base64.b64decode(g['content']), g.get('sha', '')
    # >1MB：取 blob url
    if g.get('download_url'):
        with urllib.request.urlopen(g['download_url'], timeout=120) as r2:
            return r2.read(), g.get('sha', '')
    if g.get('git_url'):
        with urllib.request.urlopen(g['git_url'], timeout=120) as r3:
            bj = json.loads(r3.read().decode('utf-8'))
        return base64.b64decode(bj['content']), g.get('sha', '')
    return None, g.get('sha', '')

for rel in ('data/shenlun.js', 'data/all.js'):
    b, sha = get_blob(rel)
    if b is None:
        log('ONLINE %s bytes=? has=? sha=%s' % (rel, sha))
    else:
        txt = b.decode('utf-8', errors='replace')
        log('ONLINE %s bytes=%d has=%s sha=%s' % (rel, len(b), ('政府工作报告深度解读' in txt), sha[:10]))

log('DONE')
o.close()
