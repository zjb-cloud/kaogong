# -*- coding: utf-8 -*-
"""xcz_parse.py —— 从开源行测真题库 ERRRC/xingcezhenti 按卷拉取并解析真题

用法（在 C:\\Users\\Administrator\\.openclaw\\workspace 下执行）：
  python kaogong/tools/xcz_parse.py --paper "02-常识判断/2025年国家公务员录用考试《行测》题（行政执法卷网友回忆版）.md"
  python kaogong/tools/xcz_parse.py --paper "<path>" --out <自定义输出路径>

输出：JSONL 写到 kaogong/data/bankq/_xcz_raw/<卷名>__<模块>.jsonl
每行一个题目：{"exam","region","year","mod","qno","qid","subtype","stem","options","ans","explain","has_img"}
说明：- has_img=True 表示题干含图片引用（图推/科推图题），是否入库由下游决定
      - explain 为空表示该题无官方解析
      - 「材料 N」共用题干会自动拼到每题 stem 前
"""
import os, sys, json, base64, re, urllib.request, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # kaogong/
TOKEN_FILE = os.path.join(BASE, '.gh_token')
REPO = 'ERRRC/xingcezhenti'
RAW_DIR = os.path.join(BASE, 'data', 'bankq', '_xcz_raw')
CACHE = os.path.join(BASE, 'data', 'bankq', '_xcz_cache')
TREE = os.path.join(CACHE, 'tree.json')

HEAD = re.compile(r'^(#{2,3}) 第 (\d+) 题　<sub>qid (\d+) · (.+?)</sub>', re.M)
OPT = re.compile(r'^- \*\*([A-H])\*\*[\.\uff0e、．]?\s*(.*)$', re.M)
ANS = re.compile(r'\*\*答案\*\*[：:]\s*([A-H]+)')


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
            return urllib.request.urlopen(urllib.request.Request(url, headers=headers()), timeout=90).read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1 + i)


def get_tree():
    if os.path.exists(TREE):
        return json.load(open(TREE, encoding='utf-8'))
    d = json.loads(api('https://api.github.com/repos/%s/git/trees/main?recursive=1' % REPO))
    os.makedirs(CACHE, exist_ok=True)
    json.dump(d, open(TREE, 'w', encoding='utf-8'))
    return d


def get_blob(sha):
    p = os.path.join(CACHE, sha + '.md')
    if os.path.exists(p):
        return open(p, encoding='utf-8').read()
    d = json.loads(api('https://api.github.com/repos/%s/git/blobs/%s' % (REPO, sha)))
    txt = base64.b64decode(d['content']).decode('utf-8')
    open(p, 'w', encoding='utf-8', newline='\n').write(txt)
    return txt


def strip_tags(s):
    s = re.sub(r'<sub>.*?</sub>', '', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    for a, b in (('&nbsp;', ' '), ('\u3000', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&#39;', "'"), ('&quot;', '"')):
        s = s.replace(a, b)
    return s.strip()


def norm_blanks(s):
    """把 4+ 连续空格/全角空格压缩成 ____（选词填空的空格位）"""
    s = re.sub(r'[ \u3000]{4,}', '____', s)
    return s.strip()


def parse_frontmatter(txt):
    m = re.match(r'^---\n(.*?)\n---\n', txt, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r'^([^:：]+)[:：]\s*"?([^"]*)"?$', line.strip())
            if mm:
                meta[mm.group(1).strip()] = mm.group(2).strip()
    return meta


def parse_paper(path):
    tree = get_tree()
    sha = None
    for e in tree['tree']:
        if e['type'] == 'blob' and e['path'] == path:
            sha = e['sha']
            break
    if not sha:
        raise SystemExit('[FAIL] 仓库中找不到该卷：%s' % path)
    txt = get_blob(sha)
    meta = parse_frontmatter(txt)
    exam = meta.get('试卷') or path.split('/')[-1][:-3]
    region = meta.get('地区', '')
    year = meta.get('年份', '')
    mod = meta.get('模块', '')
    items = []
    cur_mat = ''
    for b in re.split(r'(?m)^## ', txt)[1:]:
        b2 = '## ' + b
        firstline = b2.split('\n', 1)[0].strip()
        if re.match(r'^## 材料\s*\d+', firstline):
            seg = b2.split('\n', 1)[1] if '\n' in b2 else ''
            h1 = HEAD.search(seg)
            if h1:
                seg = seg[:h1.start()]
            cur_mat = norm_blanks(re.sub(r'\s*\n\s*', '\n', strip_tags(seg)))
            # 不 continue：材料块内还包含其下的 ### 第 N 题
        # 该块内可能含多个 ### 第 N 题（材料题），也可能直接是 ## 第 N 题
        headers = list(HEAD.finditer(b2))
        for idx, h in enumerate(headers):
            hlevel, qno, qid, subtype = h.group(1), int(h.group(2)), int(h.group(3)), h.group(4).strip()
            end = headers[idx + 1].start() if idx + 1 < len(headers) else len(b2)
            body = b2[h.end():end]
            em = re.search(r'\*\*官方解析\*\*', body)
            if em:
                before, after = body[:em.start()], body[em.end():]
            else:
                before, after = body, ''
            has_img = ('图片/' in before) or ('![' in before)
            opts = [strip_tags(x.group(2)).replace('✅', '').replace('❌', '').strip()
                    for x in OPT.finditer(before)]
            am = ANS.search(before)
            qstem = norm_blanks(re.sub(r'\s*\n\s*', '\n', strip_tags(before.split('\n- **')[0])))
            stem = qstem
            explain = strip_tags(after.split('\n---')[0])
            if not stem or not am or len(opts) < 2:
                continue
            items.append({'exam': exam, 'region': region, 'year': year, 'mod': mod,
                          'qno': qno, 'qid': qid, 'subtype': subtype,
                          'stem': stem, 'mat': cur_mat if hlevel == '###' else '',
                          'options': opts,
                          'ans': list(am.group(1)), 'explain': explain, 'has_img': has_img})
    return exam, mod, items


def main():
    args = sys.argv[1:]
    paper = None
    out = None
    i = 0
    while i < len(args):
        if args[i] == '--paper':
            paper = args[i + 1]
            i += 2
        elif args[i] == '--out':
            out = args[i + 1]
            i += 2
        else:
            i += 1
    if not paper:
        print('[FAIL] 用法：python kaogong/tools/xcz_parse.py --paper "02-常识判断/xxx.md" [--out path]')
        sys.exit(1)
    exam, mod, items = parse_paper(paper)
    os.makedirs(RAW_DIR, exist_ok=True)
    safe = re.sub(r'[\\/:*?"<>|]', '_', exam)
    if not out:
        out = os.path.join(RAW_DIR, '%s__%s.jsonl' % (safe, mod or 'unknown'))
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + '\n')
    import collections
    c = collections.Counter(x['subtype'] for x in items)
    noexp = sum(1 for x in items if not x['explain'])
    img = sum(1 for x in items if x['has_img'])
    print('OK %s [%s]：%d 题（无解析 %d，含图 %d），子题型 %s' % (exam, mod, len(items), noexp, img, dict(c)))
    print('RAW -> %s' % out)


if __name__ == '__main__':
    main()
