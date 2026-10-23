# -*- coding: utf-8 -*-
"""仅推送本次 gov 变更涉及的两个文件：data/shenlun.js + data/all.js（Contents API 最小请求，避免限流）"""
import base64, json, sys, io, urllib.request, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
token = open(os.path.join(BASE, '.gh_token'), encoding='utf-8').read().strip()
REPO = 'zjb-cloud/kaogong'
BRANCH = 'main'
MSG = 'gov report 2026-10-20 shenlun'

def api(method, url, body=None):
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', 'token ' + token)
    req.add_header('User-Agent', 'kaogong-local')
    req.add_header('Accept', 'application/vnd.github+json')
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    else:
        data = None
    with urllib.request.urlopen(req, data=data, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))

for rel in ('data/shenlun.js', 'data/all.js'):
    p = os.path.join(BASE, rel.replace('/', os.sep))
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, rel)
    sha = None
    try:
        g = api('GET', url + '?ref=' + BRANCH)
        sha = g.get('sha')
    except Exception as e:
        print('GET sha fail', rel, e)
    b64 = base64.b64encode(open(p, 'rb').read()).decode('ascii')
    body = {'message': MSG, 'content': b64, 'branch': BRANCH}
    if sha:
        body['sha'] = sha
    try:
        r = api('PUT', url, body)
        print('OK', rel, r.get('commit', {}).get('sha', '')[:10])
    except Exception as e:
        print('FAIL', rel, e)
