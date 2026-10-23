# -*- coding: utf-8 -*-
"""验证线上仓库关键文件完整性 + 补传缺失文件（输出写文件避免被吞）"""
import base64, json, sys, io, urllib.request, os, traceback

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
out = io.open(os.path.join(BASE, r'tools\_gov_verify.txt'), 'w', encoding='utf-8')

def log(s):
    out.write(s + '\n')
    out.flush()

token = open(os.path.join(BASE, '.gh_token'), encoding='utf-8').read().strip()
REPO = 'zjb-cloud/kaogong'
BRANCH = 'main'

def api(method, url, body=None):
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', 'token ' + token)
    req.add_header('User-Agent', 'kaogong-local')
    req.add_header('Accept', 'application/vnd.github+json')
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, data=data, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))

def get_content(rel):
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, rel)
    try:
        g = api('GET', url + '?ref=' + BRANCH)
        return base64.b64decode(g['content']).decode('utf-8', errors='replace')
    except Exception as e:
        return None

def put_file(rel, msg):
    p = os.path.join(BASE, rel.replace('/', os.sep))
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, rel)
    sha = None
    try:
        g = api('GET', url + '?ref=' + BRANCH)
        sha = g.get('sha')
    except Exception:
        sha = None
    b64 = base64.b64encode(open(p, 'rb').read()).decode('ascii')
    body = {'message': msg, 'content': b64, 'branch': BRANCH}
    if sha:
        body['sha'] = sha
    api('PUT', url, body)
    return True

# 1) shenlun.js / all.js 内容核验
for rel in ('data/shenlun.js', 'data/all.js'):
    c = get_content(rel)
    if c is None:
        log('MISSING(无法获取): ' + rel)
    else:
        has = '政府工作报告深度解读' in c and '十五五' in c
        log('CHECK %s 长度=%d 含本期解读=%s' % (rel, len(c), has))

# 2) 关键文件存在性
for rel in ('data/figs/figq_011_1.png', 'data/xc.js', 'data/ljdrill.js'):
    c = get_content(rel)
    log('EXIST %s = %s' % (rel, 'YES' if c is not None else 'NO'))

# 3) 补传缺失文件
missing = []
for rel in ('data/figs/figq_011_1.png', 'data/xc.js', 'data/ljdrill.js'):
    c = get_content(rel)
    if c is None:
        missing.append(rel)
for rel in missing:
    try:
        put_file(rel, 'gov report 2026-10-20 fill-missing')
        log('FILLED: ' + rel)
    except Exception as e:
        log('FILL FAIL: %s %s' % (rel, e))

log('DONE')
out.close()
