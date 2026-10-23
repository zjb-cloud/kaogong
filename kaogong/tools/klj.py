# -*- coding: utf-8 -*-
"""逻辑判断真题 · 取题工具
   题库：kaogong/data/bank/lj_pool.json（从 ERRRC/xingcezhenti 抽出的历年国省考「逻辑判断」真题 + 官方解析）
   用法：
     python kaogong/tools/klj.py --make am        生成一期（**全考点 · 每个考点 1 题 = 9 题**）→ 写 data/lj-NNN.json
     python kaogong/tools/klj.py --make pm --n 2   只抽 2 题（旧口径）
     python kaogong/tools/klj.py --next 2          抽 2 题 → 只写 data/_lj_pick.json（不建期）
     python kaogong/tools/klj.py --drill [--per 15]  生成「专项挑战」包（每个考点 15 题）→ 写 data/ljdrill.json
     python kaogong/tools/klj.py --status          看池子剩多少
     python kaogong/tools/klj.py --reset           清空已用记录
"""
import os, sys, json, random, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # kaogong/
POOL = os.path.join(BASE, 'data', 'bank', 'lj_pool.json')
USED = os.path.join(BASE, 'data', 'bank', '_used_lj.txt')
OUT = os.path.join(BASE, 'data', '_lj_pick.json')

# 考点 → 「背后考的是什么」/解题方法/易错点（统一口径，站点上逐题展示）
CATINFO = {
    '\u7ffb\u8bd1\u63a8\u7406': (
        '\u8003\u7684\u662f\u628a\u65e5\u5e38\u8bed\u8a00\u7ffb\u8bd1\u6210\u903b\u8f91\u7b26\u53f7\uff08\u2192\u3001\u4e14\u3001\u6216\u3001\u975e\uff09\u518d\u505a\u63a8\u7406\u3002'
        '\u6838\u5fc3\u662f\u56db\u7ec4\u7ffb\u8bd1\u89c4\u5219\uff1a\u300c\u5982\u679c\u2026\u90a3\u4e48\u2026\u300d\u524d\u63a8\u540e\u3001\u300c\u53ea\u6709\u2026\u624d\u2026\u300d\u540e\u63a8\u524d\uff08B\u2192A\uff09\u3001'
        '\u300c\u9664\u975e\u2026\u5426\u5219\u2026\u300d\u5426\u524d\u63a8\u540e\uff0c\u4ee5\u53ca\u9006\u5426\u7b49\u4ef7\uff08A\u2192B \u7b49\u4ef7\u4e8e \u00acB\u2192\u00acA\uff09\u3002',
        '\u7b2c\u4e00\u6b65\u5148\u628a\u9898\u5e72\u201c\u7ffb\u8bd1\u201d\u6210\u7bad\u5934\u5f0f\uff08A\u2192B\uff09\uff1b\u7b2c\u4e8c\u6b65\u770b\u9009\u9879\u54ea\u4e2a\u4e0e\u9898\u5e72\u540c\u4e00\u4e2a\u63a8\u7406\u5f62\u5f0f\u3002'
        '\u80af\u524d\u5fc5\u80af\u540e\u3001\u5426\u540e\u5fc5\u5426\u524d\uff1b\u80af\u540e\u3001\u5426\u524d\u90fd\u4e0d\u5fc5\u7136\u6210\u7acb\u3002',
        '\u6700\u5bb9\u6613\u9519\u7684\u662f\u628a\u300c\u53ea\u6709A\u624dB\u300d\u5f53\u6210 A\u2192B\uff08\u5b9e\u9645\u662f B\u2192A\uff09\uff0c\u4ee5\u53ca\u8bef\u7528\u300c\u5426\u524d\u63a8\u5426\u540e\u300d\u3002',
    ),
    '\u771f\u5047\u63a8\u7406': (
        '\u8003\u77db\u76fe\u5173\u7cfb\u4e0e\u63a8\u51fa\u5173\u7cfb\uff1a\u9898\u5e72\u7ed9\u82e5\u5e72\u65ad\u5b9a\u3001\u544a\u77e5\u6709\u51e0\u771f\u51e0\u5047\uff0c\u7528\u300c\u77db\u76fe\u547d\u9898\u5fc5\u4e00\u771f\u4e00\u5047\u300d\u5148\u9501\u5b9a\u8303\u56f4\u3002',
        '\u5148\u627e\u77db\u76fe\u547d\u9898\uff08\u5982\u300c\u6240\u6709\u662f\u300dvs\u300c\u6709\u4e9b\u4e0d\u662f\u300d\u3001\u300cA\u4e14B\u300dvs\u300c\u975eA\u6216\u975eB\u300d\uff09\uff1b'
        '\u77db\u76fe\u4e4b\u5916\u7684\u4fe1\u606f\u5b9a\u771f\u5047\uff1b\u518d\u9010\u4e00\u4ee3\u5165\u9a8c\u8bc1\u3002',
        '\u522b\u5fd8\u4e86\u300c\u53ea\u6709\u4e00\u771f\u300d\u8fd9\u7c7b\u786c\u6761\u4ef6\uff1b\u77db\u76fe\u5173\u7cfb\u7684\u4e24\u4e2a\u547d\u9898\u5fc5\u7136\u4e00\u771f\u4e00\u5047\uff0c\u5176\u4f59\u4f9d\u6b64\u63a8\u65ad\uff0c'
        '\u4e0d\u8981\u4e00\u4e0a\u6765\u5c31\u5047\u8bbe\u3002',
    ),
    '\u5206\u6790\u63a8\u7406': (
        '\u8003\u628a\u96f6\u6563\u6761\u4ef6\u7ec4\u7ec7\u6210\u6709\u5e8f\u5bf9\u5e94\uff08\u8c01\u662f\u8c01\u3001\u8c01\u5750\u54ea\u513f\uff09\uff0c\u5e38\u7528\u5217\u8868\u6cd5\u3001'
        '\u5047\u8bbe\u6cd5\u3001\u4ee3\u5165\u6392\u9664\u6cd5\u3002',
        '\u4fe1\u606f\u786e\u5b9a\u7684\u5148\u6392\u5b9a\uff1b\u4fe1\u606f\u4e0d\u786e\u5b9a\uff08\u771f\u5047\u4e0d\u660e\uff09\u5c31\u7528\u5047\u8bbe\u6cd5\u6216\u76f4\u63a5\u4ee3\u5165\u9009\u9879\u9a8c\u8bc1\u3002',
        '\u9009\u9879\u7ed9\u51fa\u5b8c\u6574\u5bf9\u5e94\u65f6\uff0c\u4f18\u5148\u300c\u4ee3\u5165\u6392\u9664\u300d\uff0c\u6bd4\u6b63\u5411\u786c\u63a8\u5feb\u5f97\u591a\u3002',
    ),
    '\u52a0\u5f3a\u8bba\u8bc1': (
        '\u8003\u8bba\u70b9\u4e0e\u8bba\u636e\u4e4b\u95f4\u7684\u63a8\u7406\u80fd\u4e0d\u80fd\u7acb\u4f4f\uff1b\u52a0\u5f3a = \u8ba9\u7ed3\u8bba\u66f4\u53ef\u80fd\u6210\u7acb\u3002'
        '\u6700\u5f3a\u7684\u624b\u6bb5\u662f\u300c\u642d\u6865\u300d\u2014\u2014\u5728\u8bba\u636e\u548c\u8bba\u70b9\u4e4b\u95f4\u5efa\u7acb\u5fc5\u7136\u8054\u7cfb\u3002',
        '\u5148\u627e\u8bba\u70b9\u548c\u8bba\u636e\uff1b\u770b\u9009\u9879\u662f\u642d\u6865\u3001\u8865\u5145\u8bba\u636e\u8fd8\u662f\u4e3e\u4f8b\uff1a\u642d\u6865 > \u8865\u5145\u8bba\u636e > \u4e3e\u4f8b\u3002',
        '\u8bdd\u9898\u8dd1\u504f\u7684\u4e00\u5f8b\u662f\u65e0\u5173\u9879\uff1b\u300c\u6709\u4e9b\u300d\u7684\u529b\u5ea6\u5f31\u4e8e\u300c\u6240\u6709\u300d\u3002',
    ),
    '\u524a\u5f31\u8bba\u8bc1': (
        '\u8003\u8bba\u70b9\u4e0e\u8bba\u636e\u4e4b\u95f4\u7684\u7f3a\u53e3\uff1b\u524a\u5f31 = \u8ba9\u7ed3\u8bba\u66f4\u4e0d\u53ef\u80fd\u6210\u7acb\u3002'
        '\u6700\u5f3a\u7684\u662f\u300c\u62c6\u6865\u300d\u2014\u2014\u5207\u65ad\u8bba\u636e\u4e0e\u8bba\u70b9\u4e4b\u95f4\u7684\u8054\u7cfb\u3002',
        '\u5148\u627e\u8bba\u70b9\u548c\u8bba\u636e\uff1b\u4f18\u5148\u770b\u80fd\u4e0d\u80fd\u5207\u65ad\u4e8c\u8005\u8054\u7cfb\uff0c\u5176\u6b21\u770b\u80fd\u4e0d\u80fd\u4e3e\u53cd\u4f8b\u3001\u5426\u5b9a\u8bba\u636e\u3002',
        '\u6ce8\u610f\u5206\u6e05\u300c\u524a\u5f31\u8bba\u70b9\u300d\u4e0e\u300c\u524a\u5f31\u8bba\u636e\u300d\uff1b\u8bdd\u9898\u4e0d\u4e00\u81f4\u7684\u9009\u9879\u662f\u65e0\u5173\u9879\uff0c\u4e0d\u80fd\u9009\u3002',
    ),
    '\u524d\u63d0\u5047\u8bbe': (
        '\u524d\u63d0\u5047\u8bbe\u662f\u52a0\u5f3a\u7684\u7279\u6b8a\u9898\u578b\uff1a\u95ee\u300c\u8fd8\u9700\u5047\u8bbe\u4ec0\u4e48\u300d\uff0c\u6b63\u786e\u7b54\u6848\u662f\u8bba\u8bc1\u6210\u7acb\u5fc5\u9700\u7684'
        '\u300c\u9690\u542b\u524d\u63d0\u300d\uff08\u5f80\u5f80\u662f\u642d\u6865\uff09\u3002',
        '\u7528\u300c\u5426\u5b9a\u4ee3\u5165\u6cd5\u300d\uff1a\u628a\u9009\u9879\u5426\u5b9a\u540e\u4ee3\u5165\uff0c\u82e5\u7ed3\u8bba\u4e0d\u6210\u7acb\uff0c\u5219\u8be5\u9009\u9879\u5c31\u662f\u5fc5\u8981\u524d\u63d0\u3002',
        '\u524d\u63d0\u4e0d\u7b49\u4e8e\u52a0\u5f3a\uff0c\u524d\u63d0\u5fc5\u987b\u300c\u6ca1\u5b83\u4e0d\u884c\u300d\uff1b\u592a\u5f3a\u6216\u592a\u5f31\u7684\u9009\u9879\u90fd\u6392\u9664\u3002',
    ),
    '\u539f\u56e0\u89e3\u91ca': (
        '\u8003\u7528\u5e38\u8bc6\u548c\u903b\u8f91\u627e\u300c\u8868\u9762\u4e0a\u77db\u76fe\u300d\u73b0\u8c61\u80cc\u540e\u7684\u5408\u7406\u539f\u56e0\u3002',
        '\u5148\u660e\u786e\u77db\u76fe\u7684\u4e24\u7aef\uff08\u4e3a\u4ec0\u4e48A\u5374B\uff09\uff1b\u6b63\u786e\u9009\u9879\u987b\u80fd\u540c\u65f6\u89e3\u91ca\u4e24\u7aef\uff0c'
        '\u53ea\u89e3\u91ca\u4e00\u7aef\u7684\u76f4\u63a5\u6392\u9664\u3002',
        '\u9009\u9879\u5fc5\u987b\u80fd\u89e3\u91ca\u300c\u5168\u90e8\u7684\u4e8b\u5b9e\u300d\uff1b\u53ea\u8bf4\u660e\u4e00\u534a\u7684\u662f\u5178\u578b\u9677\u9631\u3002',
    ),
    '\u7ed3\u8bba\u63a8\u51fa': (
        '\u8003\u4ece\u9898\u5e72\u4fe1\u606f\u4e25\u683c\u63a8\u51fa\u5fc5\u7136\u7ed3\u8bba\uff08\u5f52\u7eb3\u63a8\u7406\uff09\uff0c\u6b63\u786e\u7b54\u6848\u5fc5\u987b\u7531\u9898\u5e72\u76f4\u63a5\u63a8\u51fa\u3001'
        '\u4e0d\u9700\u989d\u5916\u5047\u8bbe\u3002',
        '\u9010\u9879\u6bd4\u5bf9\uff0c\u770b\u662f\u4e0d\u662f\u300c\u4e00\u5b9a\u6210\u7acb\u300d\uff1b\u8d8a\u8d34\u8fd1\u9898\u5e72\u3001\u8d8a\u4fdd\u5b88\u7684\u8868\u8ff0\u8d8a\u5bf9\u3002',
        '\u522b\u9009\u300c\u63a8\u5f97\u8fc7\u8fdc\u300d\u6216\u52a0\u4e86\u9898\u5e72\u6ca1\u6709\u7684\u4fe1\u606f\u7684\u9009\u9879\uff1b\u6ce8\u610f\u300c\u6240\u6709/\u6709\u4e9b\u300d\u7684\u91cf\u8bcd\u8303\u56f4\u3002',
    ),
}
DEFAULT_INFO = (
    '\u8003\u8bba\u70b9\u3001\u8bba\u636e\u4e0e\u7ed3\u8bba\u4e4b\u95f4\u7684\u63a8\u7406\u5173\u7cfb\u662f\u5426\u6210\u7acb\u3002',
    '\u5148\u6293\u8bba\u70b9\u548c\u8bba\u636e\uff0c\u518d\u5224\u65ad\u9009\u9879\u5728\u52a0\u5f3a\u3001\u524a\u5f31\u8fd8\u662f\u65e0\u5173\u3002',
    '\u8bdd\u9898\u662f\u5426\u4e00\u81f4\uff0c\u662f\u5224\u65ad\u9009\u9879\u80fd\u5426\u6210\u7acb\u7684\u7b2c\u4e00\u5173\u3002',
)


def load_pool():
    if not os.path.exists(POOL):
        print('[FAIL] \u9898\u5e93\u4e0d\u5b58\u5728\uff1a' + POOL)
        sys.exit(1)
    return json.load(open(POOL, encoding='utf-8'))['items']


def load_used():
    if not os.path.exists(USED):
        return set()
    return set(x.strip() for x in open(USED, encoding='utf-8') if x.strip())


def save_used(s):
    with open(USED, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(sorted(s)) + '\n')


def clean_explain(t):
    t = t.replace('\u6545\u6b63\u786e\u7b54\u6848\u4e3a', '\u21d2 \u6b63\u786e\u7b54\u6848\u4e3a')
    return t.strip()


def to_site(it):
    point, method, tip = CATINFO.get(it['cat'], DEFAULT_INFO)
    return {
        'type': it['cat'],
        'from': it['exam'] + ' \u7b2c' + str(it['qno']) + ' \u9898',
        'qid': it['qid'],
        'level': '\u4e2d\u7b49',
        'stem': it['stem'],
        'options': it['options'],
        'answer': it['answer'],
        'explain': clean_explain(it['explain']),
        'point': point,
        'method': method,
        'tip': tip,
    }


def pick(n):
    pool = load_pool()
    used = load_used()
    fresh = [x for x in pool if str(x['qid']) not in used]
    if len(fresh) < n:
        print('[WARN] \u6c60\u5b50\u53ea\u5269 %d \u9898\uff08\u8981 %d\uff09\uff0c\u5148\u7d27\u7740\u5269\u4e0b\u7684\u7528' % (len(fresh), n))
    random.seed()
    by_cat = {}
    for x in fresh:
        by_cat.setdefault(x['cat'], []).append(x)
    for k in by_cat:
        random.shuffle(by_cat[k])
    cats = list(by_cat.keys())
    random.shuffle(cats)
    chosen, seen_exam = [], set()
    # 先轮流从各考点取，尽量考点不重复
    while len(chosen) < n and cats:
        progressed = False
        for c in list(cats):
            if len(chosen) >= n:
                break
            lst = by_cat[c]
            # 优先选没出现过的试卷
            pickit = None
            for x in lst:
                if x['exam'] not in seen_exam:
                    pickit = x; break
            if pickit is None:
                pickit = lst[0]
            lst.remove(pickit)
            chosen.append(pickit)
            seen_exam.add(pickit['exam'])
            progressed = True
            if not lst:
                cats.remove(c)
        if not progressed:
            break
    items = [to_site(x) for x in chosen]
    json.dump({'v': 1, 'items': items}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    used |= set(str(x['qid']) for x in chosen)
    save_used(used)
    print('\u5df2\u9009 %d \u9898\uff1a' % len(items))
    for x in items:
        print('  [%s] %s | %s' % (x['type'], x['from'], x['stem'][:30].replace('\n', ' ')))
    print('\u5199\u5165 ' + OUT)


CAT_ORDER = [
    '\u7ffb\u8bd1\u63a8\u7406', '\u771f\u5047\u63a8\u7406', '\u5206\u6790\u63a8\u7406', '\u52a0\u5f3a\u8bba\u8bc1', '\u524a\u5f31\u8bba\u8bc1',
    '\u524d\u63d0\u5047\u8bbe', '\u539f\u56e0\u89e3\u91ca', '\u7ed3\u8bba\u63a8\u51fa', '\u8bba\u8bc1\u63a8\u7406',
]


def pick_all(seed_cats=None):
    """每个考点各抽 1 题（西瓜 2026-10-16：一期 = 全考点 9 题，每考点 1 题）。"""
    pool = load_pool()
    used = load_used()
    fresh = [x for x in pool if str(x['qid']) not in used]
    random.seed()
    by_cat = {}
    for x in fresh:
        by_cat.setdefault(x['cat'], []).append(x)
    for k in by_cat:
        random.shuffle(by_cat[k])
    cats = [c for c in (seed_cats or CAT_ORDER) if by_cat.get(c)]
    # 补充：池子里有、但不在 CAT_ORDER 里的考点也带上
    for c in sorted(by_cat):
        if c not in cats:
            cats.append(c)
    chosen, seen_exam = [], set()
    for c in cats:
        lst = by_cat[c]
        pickit = None
        for x in lst:
            if x['exam'] not in seen_exam:
                pickit = x; break
        if pickit is None:
            pickit = lst[0]
        lst.remove(pickit)
        chosen.append(pickit)
        seen_exam.add(pickit['exam'])
    items = [to_site(x) for x in chosen]
    json.dump({'v': 1, 'items': items}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    used |= set(str(x['qid']) for x in chosen)
    save_used(used)
    print('\u5df2\u9009 %d \u9898\uff08\u6bcf\u8003\u70b9 1 \u9898\uff09\uff1a' % len(items))
    for x in items:
        print('  [%s] %s | %s' % (x['type'], x['from'], x['stem'][:30].replace('\n', ' ')))
    print('\u5199\u5165 ' + OUT)
    return len(items)


DRILL_OUT = os.path.join(BASE, 'data', 'ljdrill.json')


def make_drill(per=15):
    """专项挑战：每个考点各抽 per 题，打包成 data/ljdrill.json（西瓜 2026-10-16 要的按考点刷）。"""
    pool = load_pool()
    used = load_used()
    fresh = [x for x in pool if str(x['qid']) not in used]
    random.seed()
    by_cat = {}
    for x in fresh:
        by_cat.setdefault(x['cat'], []).append(x)
    cats = [c for c in CAT_ORDER if by_cat.get(c)] + [c for c in sorted(by_cat) if c not in CAT_ORDER]
    sets, sid = [], 101
    for c in cats:
        lst = by_cat.get(c) or []
        if not lst:
            continue
        random.shuffle(lst)
        take = lst[:per]
        items = [to_site(x) for x in take]
        for x in take:
            used.add(str(x['qid']))
        sets.append({'set': sid, 'cat': c, 'title': '\u4e13\u9879\u6311\u6218 \u00b7 ' + c,
                     'date': '', 'session': '', 'items': items})
        sid += 1
    json.dump({'v': 1, 'sets': sets}, open(DRILL_OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    save_used(used)
    print('\u4e13\u9879\u6311\u6218\uff1a%d \u4e2a\u8003\u70b9 / %d \u9898' % (len(sets), sum(len(s['items']) for s in sets)))
    for s in sets:
        print('  [%s] %d \u9898' % (s['cat'], len(s['items'])))
    print('\u5199\u5165 ' + DRILL_OUT)


def next_set():
    nums = []
    for fn in os.listdir(os.path.join(BASE, 'data')):
        m = re.match(r'lj-(\d+)\.json$', fn)
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def make(session, full=True, n=2):
    import datetime
    k = pick_all() if full else (pick(n) or n)
    items = json.load(open(OUT, encoding='utf-8'))['items']
    num = next_set()
    title = ('\u903b\u8f91\u5224\u65ad \u00b7 \u56fd\u7701\u8003\u771f\u9898\u7cbe\u7ec3\uff08\u7b2c %d \u671f\u00b7\u5168\u8003\u70b9 %d \u9898\uff09' % (num, len(items))) if full \
        else ('\u903b\u8f91\u5224\u65ad \u00b7 \u56fd\u7701\u8003\u771f\u9898\u7cbe\u7ec3\uff08\u7b2c %d \u671f\uff09' % num)
    obj = {
        'set': num,
        'date': datetime.date.today().isoformat(),
        'session': session,
        'title': title,
        'items': items,
    }
    path = os.path.join(BASE, 'data', 'lj-%03d.json' % num)
    json.dump(obj, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\u5199\u5165 ' + path)
    return num


def main():
    a = sys.argv[1:]
    if '--status' in a:
        pool = load_pool()
        used = load_used()
        fresh = [x for x in pool if str(x['qid']) not in used]
        print('\u9898\u5e93 %d \u9898\uff0c\u5df2\u7528 %d\uff0c\u5269 %d' % (len(pool), len(used), len(fresh)))
        c = {}
        for x in fresh:
            c[x['cat']] = c.get(x['cat'], 0) + 1
        for k in sorted(c, key=lambda k: -c[k]):
            print('   %s %d' % (k, c[k]))
        return
    if '--reset' in a:
        save_used(set())
        print('\u5df2\u6e05\u7a7a\u5df2\u7528\u8bb0\u5f55')
        return
    if '--drill' in a:
        per = 15
        if '--per' in a:
            try:
                per = int(a[a.index('--per') + 1])
            except Exception:
                per = 15
        make_drill(per)
        return
    if '--make' in a:
        i = a.index('--make')
        s = a[i + 1] if i + 1 < len(a) and a[i + 1] in ('am', 'pm') else 'am'
        n = 2
        if '--n' in a:
            j = a.index('--n')
            try:
                n = int(a[j + 1])
            except Exception:
                n = 2
        make(s, full=('--n' not in a), n=n)
        return
    if '--next' in a:
        i = a.index('--next')
        n = int(a[i + 1]) if i + 1 < len(a) else 2
        pick(n)
        return
    print(__doc__)


if __name__ == '__main__':
    main()
