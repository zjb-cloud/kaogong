# -*- coding: utf-8 -*-
"""补池：从公开真题库 ERRRC/xingcezhenti 拉「判断推理」各卷 md → 抽出逻辑判断真题 → 合并进 kaogong/data/bank/lj_pool.json
用法：
  python kaogong/tools/fetch_lj.py           增量补池（已下载的 md 不重复下载）
  python kaogong/tools/fetch_lj.py --rebuild 清掉本地 md 缓存，全部重下重抽
  python kaogong/tools/fetch_lj.py --status  只看池子现状
注意：联网操作，一周最多跑一次；日常生成只读本地池（tools/klj.py）。
"""
import os, sys, json, base64, urllib.request, shutil, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # kaogong/
CACHE = os.path.join(BASE, 'data', 'bank', '_xcz05')
POOL = os.path.join(BASE, 'data', 'bank', 'lj_pool.json')
TOKEN_FILE = os.path.join(BASE, '.gh_token')
REPO = 'ERRRC/xingcezhenti'
PREFIX = '05-\u5224\u65ad\u63a8\u7406/'
SUBTYPE = '\u903b\u8f91\u5224\u65ad'   # 逻辑判断


def headers():
    h = {'User-Agent': 'xcz-fetch', 'Accept': 'application/vnd.github+json'}
    if os.path.exists(TOKEN_FILE):
        tok = open(TOKEN_FILE, encoding='utf-8').read().strip()
        if tok:
            h['Authorization'] = 'token ' + tok
    return h


def api(url, tries=4):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=headers()), timeout=60).read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1 + i)


def list_files():
    d = json.loads(api('https://api.github.com/repos/%s/git/trees/main?recursive=1' % REPO))
    fs = [e for e in d['tree'] if e['path'].startswith(PREFIX) and e['type'] == 'blob']
    fs.sort(key=lambda e: e['path'])
    return fs


def download(files):
    os.makedirs(CACHE, exist_ok=True)
    got = 0
    for i, e in enumerate(files):
        fn = os.path.join(CACHE, '%04d.md' % i)
        if os.path.exists(fn) and os.path.getsize(fn) > 0:
            continue
        try:
            d = json.loads(api('https://api.github.com/repos/%s/git/blobs/%s' % (REPO, e['sha'])))
            open(fn, 'w', encoding='utf-8', newline='\n').write(base64.b64decode(d['content']).decode('utf-8'))
            got += 1
        except Exception as ex:
            print('  [skip] %s %s' % (e['path'], ex))
    print('\u65b0\u4e0b\u8f7d %d \u4efd\uff0c\u5171 %d \u4efd\u7f13\u5b58\u5728 %s' % (got, len(files), CACHE))
    return files


# ---------- 抽取 ----------
import re
HEAD = re.compile(r'^## \u7b2c (\d+) \u9898\u3000<sub>qid (\d+) \u00b7 ([^<]+)</sub>')


def strip_tags(s):
    s = re.sub(r'<sub>.*?</sub>', '', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    for a, b in (('&nbsp;', ' '), ('\u3000', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>')):
        s = s.replace(a, b)
    return s.strip()


def classify(e):
    if '\u5206\u6790\u9898\u5e72\u6761\u4ef6' in e or '\u9898\u5e72\u6761\u4ef6' in e or '\u9898\u5e72\u4e2d\u201c' in e:
        return '\u5206\u6790\u63a8\u7406'
    if '\u7ffb\u8bd1\u4e3a' in e or '\u7ffb\u8bd1\u63a8\u7406' in e:
        return '\u7ffb\u8bd1\u63a8\u7406'
    if '\u771f\u5047' in e:
        return '\u771f\u5047\u63a8\u7406'
    if '\u642d\u6865' in e or '\u5426\u5b9a\u4ee3\u5165' in e or '\u5fc5\u8981\u6761\u4ef6' in e:
        return '\u524d\u63d0\u5047\u8bbe'
    if '\u524a\u5f31' in e:
        return '\u524a\u5f31\u8bba\u8bc1'
    if '\u52a0\u5f3a' in e:
        return '\u52a0\u5f3a\u8bba\u8bc1'
    if '\u524d\u63d0' in e:
        return '\u524d\u63d0\u5047\u8bbe'
    if '\u89e3\u91ca' in e:
        return '\u539f\u56e0\u89e3\u91ca'
    if '\u63a8\u51fa' in e:
        return '\u7ed3\u8bba\u63a8\u51fa'
    return '\u8bba\u8bc1\u63a8\u7406'


def extract(files):
    items, seen = [], set()
    for i, e in enumerate(files):
        path = os.path.join(CACHE, '%04d.md' % i)
        if not os.path.exists(path):
            continue
        exam = e['path'].split('/', 1)[1][:-3]
        txt = open(path, encoding='utf-8').read()
        for b in re.split(r'(?m)^## ', txt)[1:]:
            m = HEAD.match('## ' + b)
            if not m or m.group(3).strip() != SUBTYPE:
                continue
            qid = int(m.group(2))
            if qid in seen:
                continue
            body = b.split('\n', 1)[1]
            em = re.search(r'\*\*\u5b98\u65b9\u89e3\u6790\*\*', body)
            if not em:
                continue
            before, after = body[:em.start()], body[em.end():]
            if '\u56fe\u7247/' in before:
                continue
            opts = [strip_tags(x.group(2)).replace('\u2705', '').strip()
                    for x in re.finditer(r'^- \*\*([A-H])\*\*[\.\uff0e]?\s*(.*)$', before, flags=re.M)]
            am = re.search(r'\*\*\u7b54\u6848\*\*\uff1a\s*([A-H]+)', before)
            if len(opts) < 4 or not am or len(am.group(1)) != 1:
                continue
            stem = re.sub(r'\s*\n\s*', '\n', strip_tags(before.split('\n- **')[0])).strip()
            if not stem:
                continue
            explain = strip_tags(after.split('\n---')[0])
            it = {'qid': qid, 'exam': exam, 'qno': int(m.group(1)),
                  'stem': stem, 'options': opts, 'answer': list(am.group(1)), 'explain': explain}
            it['cat'] = classify(explain)
            seen.add(qid)
            items.append(it)
    return items


def status():
    if not os.path.exists(POOL):
        print('\u4e0d\u5b58\u5728\uff1a' + POOL)
        return
    d = json.load(open(POOL, encoding='utf-8'))
    print('\u6c60\u5b50 %d \u9898' % d['count'])
    c = {}
    for x in d['items']:
        c[x['cat']] = c.get(x['cat'], 0) + 1
    for k in sorted(c, key=lambda k: -c[k]):
        print('   %s %d' % (k, c[k]))


def main():
    a = sys.argv[1:]
    if '--status' in a:
        status()
        return
    if '--rebuild' in a and os.path.isdir(CACHE):
        shutil.rmtree(CACHE, ignore_errors=True)
    files = list_files()
    print('\u8fdc\u7a0b %d \u4efd\u3002' % len(files))
    download(files)
    items = extract(files)
    old = {}
    if os.path.exists(POOL):
        try:
            for x in json.load(open(POOL, encoding='utf-8'))['items']:
                old[x['qid']] = x
        except Exception:
            pass
    for x in items:
        old[x['qid']] = x
    allit = list(old.values())
    json.dump({'v': 1, 'count': len(allit), 'items': allit},
              open(POOL, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\u65b0\u62bd\u5230 %d \u9898\uff0c\u5408\u5e76\u540e\u6c60\u5b50 %d \u9898 -> %s' % (len(items), len(allit), POOL))


if __name__ == '__main__':
    main()
