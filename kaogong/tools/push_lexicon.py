# -*- coding: utf-8 -*-
"""补传 lexicon.js（5万词）到 GitHub Contents API，带重试"""
import os, io, json, base64, urllib.request, sys, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
TOK = open(r'C:\Users\Administrator\.openclaw\workspace\kaogong\.gh_token', encoding='utf-8').read().strip()
LOCAL = r'C:\Users\Administrator\.openclaw\workspace\kaogong\data\lexicon.js'
REPO = 'zjb-cloud/kaogong'
PATH = 'data/lexicon.js'
MSG = 'lexicon expand 50k words 2026-10-20'

b = open(LOCAL, 'rb').read()
print('local lexicon.js bytes=%d' % len(b))

# 1) GET 当前 sha
req = urllib.request.Request('https://api.github.com/repos/%s/contents/%s' % (REPO, PATH),
                             headers={'Authorization': 'token ' + TOK, 'User-Agent': 'kaogong'})
try:
    cur = json.loads(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'))
    sha = cur.get('sha')
    print('remote sha=%s size=%d' % (sha, cur.get('size')))
except urllib.error.HTTPError as e:
    if e.code == 404:
        sha = None
    else:
        raise

body = {
    'message': MSG,
    'content': base64.b64encode(b).decode('ascii'),
    'branch': 'main',
}
if sha:
    body['sha'] = sha

ok = False
for i in range(1, 6):
    try:
        req = urllib.request.Request('https://api.github.com/repos/%s/contents/%s' % (REPO, PATH),
                                     data=json.dumps(body).encode('utf-8'),
                                     headers={'Authorization': 'token ' + TOK, 'User-Agent': 'kaogong',
                                              'Content-Type': 'application/json'},
                                     method='PUT')
        r = urllib.request.urlopen(req, timeout=300)
        g = json.loads(r.read().decode('utf-8'))
        print('PUT OK attempt=%d commit=%s' % (i, g.get('commit', {}).get('sha', '?')))
        ok = True
        break
    except Exception as e:
        print('PUT fail attempt=%d: %s' % (i, e))
        time.sleep(5)
print('RESULT', 'OK' if ok else 'FAIL')
