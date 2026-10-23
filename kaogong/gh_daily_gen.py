# -*- coding: utf-8 -*-
"""GitHub Actions 每日内容生成器（确定性刷题内容）：
   - 考公政治常识 issue  am/pm 各一期（10 题：7 单 3 多，政治类 <= 2）
   - 词语速记 idiom   am/pm 各一期（10 词，全历史不重复）
   - 词语速记填空 idiomfill am/pm 同号（10 题，干扰词从词库抽真实释义）
   - 行测加练 xc      am/pm 各一期（12 题 = sci4 + math3 + logic3 + fig2）
   - 逻辑判断 lj      每日一期 9 题（全考点，调 tools/klj.py）
   期号自动推进：扫描 data/ 下已生成的最大期号 +1 / +2。
   词/题排除历史已用：idiom 排除已用词，issue/xc 排除已用题干。
   用法: python gh_daily_gen.py [--date YYYY-MM-DD] [--only issue,idiom,xc,lj]
"""
import datetime, glob, json, os, random, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')


def jload(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def jdump(p, o):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(o, f, ensure_ascii=False, indent=1)


def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def today_bj():
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).date().isoformat()


def max_no(prefix):
    nos = []
    for p in glob.glob(os.path.join(DATA, prefix + '-*.json')):
        try:
            m = re.search(r'-(0*)(\d+)\.json$', p)
            if m:
                nos.append(int(m.group(2)))
        except Exception:
            pass
    return max(nos) if nos else 0


def used_stems(prefix):
    s = set()
    for p in glob.glob(os.path.join(DATA, prefix + '-*.json')):
        try:
            o = jload(p)
            for it in o.get('items', []):
                st = clean((it.get('q') or it).get('stem', '')) if isinstance(it.get('q'), dict) else clean(it.get('stem', ''))
                if st:
                    s.add(st)
        except Exception:
            pass
    return s


def used_words():
    s = set()
    for p in glob.glob(os.path.join(DATA, 'idiom-*.json')):
        try:
            o = jload(p)
            for it in o.get('items', []):
                if it.get('w'):
                    s.add(it['w'])
        except Exception:
            pass
    return s


# ---------------- ISSUE ----------------
POL_KW = ['马原', '毛概', '中特', '习思想', '哲学', '政治经济']


def is_pol(q):
    t = q.get('topic', '')
    return any(k in t for k in POL_KW)


def build_issue(no, session, title, diff, picked, date):
    items = []
    for q in picked:
        topic = clean(q.get('topic', '常识'))
        ana = q.get('ana', {}) or {}
        sol = clean(ana.get('sol', '')).split('。')
        pts = []
        for s in sol:
            if len(s) > 8:
                pts.append(s[:80])
            if len(pts) >= 2:
                break
        if not pts:
            pts = ['掌握本题核心知识点', '注意易错点辨析']
        items.append({
            "kp": {"title": topic, "module": topic, "points": pts},
            "q": {"type": q.get('type', 'single'), "stem": clean(q.get('stem', '')),
                  "options": q.get('options', []), "answer": q.get('ans', []),
                  "explain": sol[0] if sol else ''},
            "tip": clean((ana.get('err') or ana.get('avoid') or '注意辨析'))[:60],
            "recap": '真题演练：' + ''.join(q.get('ans', [])) if q.get('src') else '',
            "kind": "real", "src": q.get('src', ''), "year": q.get('year', '')
        })
    singles = [x for x in items if x['q']['type'] == 'single'][:7]
    multis = [x for x in items if x['q']['type'] == 'multi'][:3]
    random.shuffle(singles)
    random.shuffle(multis)
    items = singles + multis
    random.shuffle(items)
    obj = {
        "issue": no, "date": date, "session": session, "title": title, "difficulty": diff,
        "items": items,
        "summary": {"oneLiners": [it['recap'] for it in items[:10]],
                    "pitfalls": [[it['kp']['title'], it['tip']] for it in items[:3]],
                    "next": "下期继续真题演练，均衡覆盖时政/法律/科技/人文/地理"}
    }
    return obj


def pick_issue_items(seed, used):
    rng = random.Random(seed)
    cs = jload(os.path.join(DATA, 'bankq', 'bankq_cs.json'))['questions']
    cs_real = [x for x in cs if x.get('kind') == 'real' and clean(x.get('stem', '')) not in used]
    backfill = [x for x in cs if x.get('kind') == 'real']
    if len(cs_real) < 12:
        cs_real = backfill
    rng.shuffle(cs_real)
    nonpol = [q for q in cs_real if not is_pol(q)]
    pol = [q for q in cs_real if is_pol(q)]
    singles_np = [q for q in nonpol if q.get('type') == 'single']
    multis_np = [q for q in nonpol if q.get('type') == 'multi']
    singles_p = [q for q in pol if q.get('type') == 'single']
    multis_p = [q for q in pol if q.get('type') == 'multi']
    picked = []
    picked += singles_np[:5]
    picked += singles_p[:2]
    picked += multis_np[:2]
    picked += multis_p[:1]
    si = 0
    while sum(1 for q in picked if q.get('type') == 'single') < 7 and si < len(singles_np):
        nq = singles_np[si]
        if nq not in picked:
            picked.append(nq)
        si += 1
    mi = 0
    while sum(1 for q in picked if q.get('type') == 'multi') < 3 and mi < len(multis_np):
        nq = multis_np[mi]
        if nq not in picked:
            picked.append(nq)
        mi += 1
    return picked[:10]


# ---------------- XC ----------------
def to_xc(q):
    ana = q.get('ana', {}) or {}
    sol = clean(ana.get('sol', '') or q.get('explain', ''))
    tip = clean(ana.get('err', '') or ana.get('avoid', ''))[:80]
    return {"type": 'sci', "level": '中等', "stem": clean(q.get('stem', '')),
            "options": q.get('options', []), "answer": q.get('ans', []),
            "explain": sol, "method": sol,
            "tip": tip, "kind": "real", "src": q.get('src', ''), "year": q.get('year', '')}


def build_xc(no, session, seed, fig_items, used, date):
    rng = random.Random(seed)
    kx_all = [q for q in jload(os.path.join(DATA, 'bankq', 'bankq_kx.json'))['questions'] if q.get('kind') == 'real']
    sl_all = [q for q in jload(os.path.join(DATA, 'bankq', 'bankq_sl.json'))['questions'] if q.get('kind') == 'real']
    pd_all = [q for q in jload(os.path.join(DATA, 'bankq', 'bankq_pd.json'))['questions'] if q.get('kind') == 'real']
    kx = [q for q in kx_all if clean(q.get('stem', '')) not in used]
    sl = [q for q in sl_all if clean(q.get('stem', '')) not in used]
    pd = [q for q in pd_all if clean(q.get('stem', '')) not in used]

    def sample(pool, allpool, n):
        if len(pool) >= n:
            return rng.sample(pool, n)
        got = pool[:]
        need = n - len(got)
        rest = [x for x in allpool if x not in got]
        rng.shuffle(rest)
        return got + rest[:need]

    sci = sample(kx, kx_all, 4)
    math_ = sample(sl, sl_all, 3)
    logic_ = sample(pd, pd_all, 3)
    items = []
    for q in sci:
        it = to_xc(q); it['type'] = 'sci'; items.append(it)
    for q in math_:
        it = to_xc(q); it['type'] = 'math'; items.append(it)
    for q in logic_:
        it = to_xc(q); it['type'] = 'logic'; items.append(it)
    for f in fig_items:
        items.append(f)
    obj = {"set": no, "date": date, "session": session,
           "title": "行测加练 · 科学推理 + 数量关系 + 判断推理（第 %d 批）" % no, "items": items}
    return obj


def kfig_next(n):
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'kfig.py'), '--next', str(n)],
                       capture_output=True, text=True, cwd=ROOT)
    out = (r.stdout or '') + (r.stderr or '')
    if r.returncode != 0:
        print('[kfig warn]', out[-300:])
    try:
        return jload(os.path.join(DATA, '_fig_pick.json'))
    except Exception:
        return []


# ---------------- IDIOM ----------------
def pick_idiom_words(seed, n=10):
    rng = random.Random(seed)
    ib = jload(os.path.join(DATA, 'bank', 'idiom_bank.json'))['items']
    used = used_words()
    fresh = [it for it in ib if it.get('w') not in used]
    fresh.sort(key=lambda x: 0 if x.get('w') and x['w'] in (x.get('eg') or '') else 1)
    rng.shuffle(fresh)
    return fresh[:n]


def mk_idiom_items(words_def, rng_seed, fill=False):
    ib = jload(os.path.join(DATA, 'bank', 'idiom_bank.json'))['items']
    by_w = {it['w']: it for it in ib}
    rng = random.Random(rng_seed)
    items = []
    for idx, base in enumerate(words_def, 1):
        w = base['w']
        mean = clean(base['mean'])
        others = [it for it in ib if it['w'] != w and clean(it.get('mean', '')) != mean]
        rng.shuffle(others)
        wrongs = others[:3]
        correct_pos = rng.randrange(4)
        options = []
        rest = list(wrongs)
        for i in range(4):
            if i == correct_pos:
                options.append(mean)
            else:
                options.append(clean(rest.pop(0)['mean']))
        cmps = []
        rest2 = list(wrongs)
        for i in range(4):
            if i == correct_pos:
                cmps.append({"self": True})
            else:
                ww = rest2.pop(0)
                cmps.append({"w": ww['w'], "mean": clean(ww.get('mean', '')),
                             "why": "语义或搭配不符", "eg": clean(ww.get('eg', ''))[:60]})
        if not fill:
            items.append({
                "w": w, "py": base.get('py', ''), "kind": base.get('kind', '成语'),
                "mean": mean, "options": options, "answer": [chr(65 + correct_pos)],
                "eg": base.get('eg', ''), "egFrom": "现代·书面语", "src": base.get('src', ''),
                "tip": base.get('tip', ''), "recap": '牢记「%s」' % w, "cmp": cmps
            })
        else:
            eg = base.get('eg', '')
            sent = eg.replace(w, '____') if w in eg else '语境填空：%s。' % mean
            if '____' not in sent:
                sent = '语境填空：%s。' % mean
            opts2 = [w] + [x['w'] for x in wrongs]
            final_opts = []
            for i in range(4):
                if i == correct_pos:
                    final_opts.append(w)
                else:
                    final_opts.append(opts2[i])
            items.append({
                "no": idx, "w": w, "sent": sent, "options": final_opts,
                "answer": [chr(65 + correct_pos)], "mean": mean,
                "eg": eg, "tip": base.get('tip', ''), "cmp": cmps
            })
    return items


# ---------------- MAIN ----------------
def main():
    args = sys.argv[1:]
    date = today_bj()
    only = None
    if '--date' in args:
        date = args[args.index('--date') + 1]
    if '--only' in args:
        only = [x.strip() for x in args[args.index('--only') + 1].split(',')]

    def want(k):
        # 默认只做确定性刷题内容（issue/idiom/idiomfill/xc/lj）；
        # vocab 精读文章需 AI 创作，由云端任务生成后聊天推送，不在此自动生成。
        if only is not None:
            return k in only
        return k in ('issue', 'idiom', 'xc', 'lj')

    issue_no = max_no('issue') + 1
    idiom_no = max_no('idiom') + 1
    xc_no = max_no('xc') + 1

    made = []
    if want('issue'):
        used = used_stems('issue')
        am = pick_issue_items(issue_no * 100 + 1, used)
        pm = pick_issue_items(issue_no * 100 + 2, used | {clean(q.get('stem', '')) for q in am})
        o1 = build_issue(issue_no, 'am', '真题演练 · 时政法律科技人文地理均衡卷', '基础+中等', am, date)
        o2 = build_issue(issue_no + 1, 'pm', '真题演练 · 法律科技地理综合卷', '基础+中等', pm, date)
        jdump(os.path.join(DATA, 'issue-%03d.json' % issue_no), o1)
        jdump(os.path.join(DATA, 'issue-%03d.json' % (issue_no + 1)), o2)
        made += ['issue-%03d' % issue_no, 'issue-%03d' % (issue_no + 1)]

    if want('idiom'):
        wa = pick_idiom_words(idiom_no * 100 + 1)
        wb = pick_idiom_words(idiom_no * 100 + 2)
        ia = mk_idiom_items(wa, idiom_no * 100 + 1)
        ib_ = mk_idiom_items(wb, idiom_no * 100 + 2)
        fa = mk_idiom_items(wa, idiom_no * 100 + 3, fill=True)
        fb = mk_idiom_items(wb, idiom_no * 100 + 4, fill=True)
        oa = {"set": idiom_no, "date": date, "session": "am",
              "title": "词语速记 · 第 %d 期" % idiom_no, "difficulty": "基础+中等", "items": ia}
        ob = {"set": idiom_no + 1, "date": date, "session": "pm",
              "title": "词语速记 · 第 %d 期" % (idiom_no + 1), "difficulty": "基础+中等", "items": ib_}
        oaf = {"set": idiom_no, "date": date, "session": "am",
               "title": "词语速记填空选词 · 第 %d 期" % idiom_no, "difficulty": "基础+中等", "items": fa}
        obf = {"set": idiom_no + 1, "date": date, "session": "pm",
               "title": "词语速记填空选词 · 第 %d 期" % (idiom_no + 1), "difficulty": "基础+中等", "items": fb}
        jdump(os.path.join(DATA, 'idiom-%03d.json' % idiom_no), oa)
        jdump(os.path.join(DATA, 'idiom-%03d.json' % (idiom_no + 1)), ob)
        jdump(os.path.join(DATA, 'idiomfill-%03d.json' % idiom_no), oaf)
        jdump(os.path.join(DATA, 'idiomfill-%03d.json' % (idiom_no + 1)), obf)
        made += ['idiom-%03d' % idiom_no, 'idiom-%03d' % (idiom_no + 1),
                 'idiomfill-%03d' % idiom_no, 'idiomfill-%03d' % (idiom_no + 1)]
        used_f = os.path.join(DATA, 'bank', '_used_idioms.txt')
        with open(used_f, 'a', encoding='utf-8', newline='\n') as f:
            for w in [x['w'] for x in wa] + [x['w'] for x in wb]:
                f.write(w + '\n')

    if want('xc'):
        used = used_stems('xc')
        fig_a = kfig_next(2)
        fig_b = kfig_next(2)
        xa = build_xc(xc_no, 'am', xc_no * 100 + 1, fig_a, used, date)
        used2 = used | {clean(i.get('stem', '')) for i in xa['items'] if i['type'] != 'fig'}
        xb = build_xc(xc_no + 1, 'pm', xc_no * 100 + 2, fig_b, used2, date)
        jdump(os.path.join(DATA, 'xc-%03d.json' % xc_no), xa)
        jdump(os.path.join(DATA, 'xc-%03d.json' % (xc_no + 1)), xb)
        made += ['xc-%03d' % xc_no, 'xc-%03d' % (xc_no + 1)]

    if want('lj'):
        r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'klj.py'), '--make', 'am'],
                           capture_output=True, text=True, cwd=ROOT)
        out = (r.stdout or '') + (r.stderr or '')
        print('[lj]', out.strip()[-200:])
        if r.returncode == 0:
            m = re.search(r'lj-(\d+)\.json', out)
            if m:
                made.append('lj-' + m.group(1))

    print('DATE=%s MADE=%s' % (date, ','.join(made)))


if __name__ == '__main__':
    main()
