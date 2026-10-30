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
            wrong_words = [x['w'] for x in wrongs]
            final_opts = []
            for i in range(4):
                if i == correct_pos:
                    final_opts.append(w)
                else:
                    final_opts.append(wrong_words.pop(0))
            items.append({
                "no": idx, "w": w, "sent": sent, "options": final_opts,
                "answer": [chr(65 + correct_pos)], "mean": mean,
                "eg": eg, "tip": base.get('tip', ''), "cmp": cmps
            })
    return items


# ---------------- VOCAB (英语角·自动) ----------------
VOCAB_ARTICLES = [
    {"title": "The Power of Daily Habits",
     "topic": "人文哲理",
     "paras": [
        "Many people believe that great success depends on sudden inspiration or extraordinary talent. In fact, the opposite is often true: small habits, repeated day after day, shape who we become. A student who reads for twenty minutes every evening will naturally know far more than one who waits for a sudden mood to study. A runner who jogs a short distance each morning will slowly build strength and confidence. The key is not the size of each action, but the steadiness of the practice.",
        "Why do habits matter so much? Because they reduce the need for willpower. When an action becomes a routine, we no longer have to make a decision or fight against laziness every time. The energy we save can then be spent on deeper work, such as thinking carefully about a problem or planning the next step. Over months and years, this small advantage grows into a huge gap between people who keep their promises to themselves and those who do not.",
        "Of course, forming a habit is not always easy. The first few days are often the hardest, and we may want to give up. The wise approach is to start small, attach the new habit to an existing one, and never miss twice in a row. In this way, even a busy student or worker can gradually build a better version of themselves, one ordinary day at a time."
     ],
     "phrases": [
        {"p": "day after day", "cn": "日复一日"},
        {"p": "fight against", "cn": "与…作斗争；克服"},
        {"p": "give up", "cn": "放弃"},
        {"p": "miss twice in a row", "cn": "连续两次中断（习惯）"}
     ],
     "quotes": [{"en": "We are what we repeatedly do.", "cn": "我们反复做的事，塑造了我们自己。", "who": "亚里士多德"}]
    },
    {"title": "How Technology Changes Our Study",
     "topic": "科技生活",
     "paras": [
        "In the past, learning meant sitting in a classroom with a teacher, a blackboard and a pile of books. Today, a student can learn almost anything with a small device in the pocket: an online course, a dictionary that speaks, a video that explains a difficult formula in minutes. Technology has made knowledge cheaper and more accessible, which is a great gift for people in remote places and busy workers alike.",
        "However, the new tools also bring new challenges. The same screen that offers lessons also offers games and short videos that eat up our time. Many students find it harder to concentrate because information comes too fast and in too many pieces. Therefore, the most important skill in the digital age is not how to search, but how to choose: what to read, how long to focus, and when to put the phone away and think alone.",
        "The best learners, it seems, combine the old and the new. They use technology to find materials and check facts, but they still take notes by hand, ask questions in class and discuss ideas with friends. In this way, technology becomes a servant rather than a master, helping us to study better without letting it control our attention."
     ],
     "phrases": [
        {"p": "eat up", "cn": "消耗掉（时间）"},
        {"p": "put away", "cn": "收起来"},
        {"p": "take notes by hand", "cn": "手写记笔记"},
        {"p": "rather than", "cn": "而不是"}
     ],
     "quotes": [{"en": "Technology is best when it brings people together.", "cn": "技术最美好的时刻，是它把人们联系在一起的时候。", "who": "马特·穆伦维格"}]
    },
    {"title": "A Greener City",
     "topic": "生态文明",
     "paras": [
        "Cities are crowded with cars, buildings and people, and the air we breathe is often not clean enough. A greener city is not a luxury; it is a necessity for health and happiness. Parks give families a place to rest, trees cool the streets in summer, and bicycles reduce both noise and pollution. When citizens can walk to work or play in a nearby garden, they feel closer to nature even in the middle of a busy city.",
        "Building a greener city requires effort from everyone. The government can build more bike lanes, plant more trees and punish factories that pollute. Schools can teach children to sort rubbish and save water. Shops can use less plastic, and families can choose public transport instead of private cars. Every small decision, multiplied by millions of people, can change the color of a city from grey to green.",
        "Of course, green change takes time and money, and some people worry about the cost. But experience shows that clean air and green space actually save money in the long run, by reducing illness and making people happier and more productive. The cities that invest in nature today will be the most attractive places to live tomorrow."
     ],
     "phrases": [
        {"p": "in the long run", "cn": "从长远来看"},
        {"p": "sort rubbish", "cn": "垃圾分类"},
        {"p": "multiplied by", "cn": "乘以；成倍放大"},
        {"p": "invest in", "cn": "投资于"}
     ],
     "quotes": [{"en": "The earth is what we all have in common.", "cn": "地球是我们共同拥有的一切。", "who": "温德尔·贝里"}]
    }
]


def mk_article(no, gl_words):
    a = VOCAB_ARTICLES[no % len(VOCAB_ARTICLES)]
    return {"title": a["title"], "topic": a["topic"], "paras": a["paras"],
            "glossary": {"words": [{"w": x["w"], "ph": x.get("ph", ""), "cn": x.get("cn", "")}
                                   for x in gl_words[:5]],
                         "phrases": a["phrases"]},
            "quotes": a["quotes"]}


def used_vocab_words():
    s = set()
    for p in glob.glob(os.path.join(DATA, 'vocab-0*.json')) + glob.glob(os.path.join(DATA, 'vocab-[1-9]*.json')):
        try:
            o = jload(p)
            for it in o.get('words', []):
                if it.get('w'):
                    s.add(it['w'])
        except Exception:
            pass
    return s


def build_vocab(no, date):
    plan = jload(os.path.join(DATA, 'vocab-plan.json'))
    used = used_vocab_words()
    fresh = [x for x in plan if x.get('w') and x['w'] not in used]
    fresh.sort(key=lambda x: x.get('n', 0))
    picked = fresh[:50]
    words = []
    for x in picked:
        w = x.get('w', '')
        eg = x.get('eg', '') or ''
        egCn = x.get('egCn', '') or ''
        rel = x.get('rel') or {}
        core_cn = ''
        cns = (x.get('cn') or '')
        if cns:
            core_cn = cns.split('；')[0].split(';')[0].strip()
        if not (rel.get('form') or rel.get('sound') or rel.get('syn')):
            f = []
            for k in ('n', 'v', 'adj', 'adv', 'pl'):
                for v in (x.get('forms') or {}).get(k, []):
                    if v and v != w and v not in f:
                        f.append(v)
            if not f:
                for suf in ('s', 'ed', 'ing'):
                    v = w + suf
                    if v != w and v not in f:
                        f.append(v)
            rel = {"form": f[:3], "sound": [], "syn": []}
            # 自动生成的形近词 = 词形变体（中文与主词一致），relCn 同步给中文，避免前端形近无释义
            relcn = {"form": [core_cn] * len(f[:3]), "sound": [], "syn": []}
        else:
            relcn = x.get('relCn') or {}
            if not isinstance(relcn, dict): relcn = {}
            if (rel.get('form') or []) and not (relcn.get('form') or []):
                relcn['form'] = [core_cn] * len(rel.get('form') or [])
            if (rel.get('sound') or []) and not (relcn.get('sound') or []):
                relcn['sound'] = [core_cn] * len(rel.get('sound') or [])
            if (rel.get('syn') or []) and not (relcn.get('syn') or []):
                relcn['syn'] = [core_cn] * len(rel.get('syn') or [])
        words.append({
            "w": w, "ph": x.get('ph', ''), "cn": x.get('cn', ''),
            "eg": eg, "egCn": egCn,
            "rel": rel,
            "forms": x.get('forms', {"n": [], "v": [], "adj": [], "adv": [], "pl": []}),
            "relCn": relcn
        })
    obj = {"batch": no, "date": date, "session": "day", "words": words,
           "article": mk_article(no, picked[:5])}
    jdump(os.path.join(DATA, 'vocab-%03d.json' % no), obj)
    return 'vocab-%03d' % no


# ---------------- NEWS (新闻页·RSS 自动) ----------------
NEWS_RSS = 'https://www.chinanews.com.cn/rss/scroll-news.xml'
NEWS_CATS = [
    ('国际', ['美国', '俄罗斯', '乌克兰', '欧盟', '北约', '以色列', '伊朗', '联合国', '外交部', '日本', '韩国', '东盟', '非洲', '拉美', '中东', '加沙']),
    ('科技', ['AI', '人工智能', '芯片', '半导体', '航天', '卫星', '华为', '马斯克', '机器人', '大模型', '新能源', '5G', '量子']),
    ('财经', ['央行', '股市', 'A股', '人民币', '房价', '楼市', '就业', '关税', 'GDP', '进出口', '消费', '银行', '利率']),
    ('国内·民生', ['习近平', '国务院', '发改委', '人社', '教育部', '医保', '养老', '住房', '农业', '粮食', '应急', '乡村振兴']),
    ('社会', ['暴雨', '地震', '事故', '文旅', '景区', '健康', '铁路', '航空', '台风', '天气', '艺术', '文化', '体育', '篮球', '足球', '旅游', '美食', '展览', '节'])
]


def classify_news(title):
    for cat, kws in NEWS_CATS:
        if any(k in title for k in kws):
            return cat
    return '综合'


NEWS_WHY = {
    '国际': '大国外交与全球治理的鲜活案例：我国始终坚持独立自主的和平外交政策，推动构建人类命运共同体，为世界和平发展贡献中国方案。',
    '科技': '科技自立自强的生动注脚：关键核心技术攻关与产业创新，是发展新质生产力、推动高质量发展的重要支撑。',
    '财经': '经济高质量发展的观察窗口：稳预期、扩内需、促改革，事关宏观经济大局与千家万户的民生福祉。',
    '国内·民生': '基层治理与民生保障的实践样本：政策落实落细，是坚持人民至上、增进民生福祉的具体体现。',
    '社会': '社会治理与公共安全的现实课题：提升应急处置与公共服务水平，是推进国家治理体系和治理能力现代化的应有之义。',
    '综合': '时事热点与政策导向的结合点：可作为申论论述的案例素材与论据支撑。'
}


def build_news(no, date):
    import urllib.request, xml.etree.ElementTree as ET
    try:
        req = urllib.request.Request(NEWS_RSS, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode('utf-8', 'ignore')
        root = ET.fromstring(raw)
        items = []
        for it in root.iter('item'):
            t = (it.findtext('title') or '').strip()
            d = (it.findtext('description') or '').strip()
            if t:
                items.append((t, d))
        if not items:
            return None
        rng = random.Random(no * 100 + 7)
        rng.shuffle(items)
        picked = items[:4]
        news = []
        for t, d in picked:
            cat = classify_news(t)
            p = clean(d)[:180] if d else t
            news.append({"cat": cat, "h": t[:80], "p": p,
                         "why": NEWS_WHY.get(cat, NEWS_WHY['综合']), "src": "中新网滚动新闻"})
        brief = '本期收录当日要闻：' + '；'.join([n['h'][:18] for n in news[:3]]) + '。'
        top_cat = news[0]['cat']
        sl = [{"topic": top_cat + '·时事热点', "pattern": '事实描述＋政策解读＋申论落点',
               "sentence": NEWS_WHY.get(top_cat, NEWS_WHY['综合']),
               "use": '可用于「' + top_cat + '」相关大作文的分论点：以具体新闻事实论证政策导向与发展逻辑',
               "back": '反向论证：若忽视该领域发展，将影响民生福祉与高质量发展大局',
               "cases": [{"n": n['h'][:30], "d": '可作为申论论述素材'} for n in news[:2]],
               "swap": ['高质量发展', '人民至上']}]
        obj = {"id": no, "date": date, "title": "每日新闻精读 · 第 %d 期" % no,
               "brief": brief, "news": news, "shenlun": sl}
        jdump(os.path.join(DATA, 'news-%03d.json' % no), obj)
        return 'news-%03d' % no
    except Exception as e:
        print('[news warn]', str(e)[-200:])
        return None


# ---------------- WEEKEND (周末卷·仅周六) ----------------
def wk_pool():
    out = []
    for p in sorted(glob.glob(os.path.join(DATA, 'issue-0*.json')) + glob.glob(os.path.join(DATA, 'issue-[1-9]*.json'))):
        m = re.search(r'issue-(\d+)\.json', p)
        if not m:
            continue
        no = int(m.group(1))
        try:
            o = jload(p)
        except Exception:
            continue
        for it in o.get('items', []):
            q = it.get('q', {})
            tip = it.get('tip', '')
            key = (it.get('recap') or it.get('tip', ''))[:40]
            explain = clean(q.get('explain', ''))
            if not tip:
                tip = '结合题干关键词与选项差异判断。'
            if not key:
                key = '抓题干关键信息，排除绝对化选项。'
            if not explain:
                explain = '结合题干与选项逐一比对，选出最符合题意的一项。'
            out.append({"date": o.get('date', ''), "src": 'issue', "no": no,
                        "mod": '常识判断', "type": q.get('type', 'single'),
                        "stem": clean(q.get('stem', '')), "options": q.get('options', []),
                        "answer": q.get('answer', []), "explain": explain,
                        "tip": tip, "key": key})
    for p in sorted(glob.glob(os.path.join(DATA, 'xc-0*.json')) + glob.glob(os.path.join(DATA, 'xc-[1-9]*.json'))):
        m = re.search(r'xc-(\d+)\.json', p)
        if not m:
            continue
        no = int(m.group(1))
        try:
            o = jload(p)
        except Exception:
            continue
        for it in o.get('items', []):
            t = it.get('type', '')
            modmap = {'sci': '科学推理', 'math': '数量关系', 'logic': '判断推理', 'fig': '图形推理'}
            explain = clean(it.get('explain', ''))
            tip = clean(it.get('tip', ''))
            key = clean(it.get('method', ''))[:40]
            if not explain:
                explain = '图形推理：按题干图形规律作答（图形见原题）。' if t == 'fig' else '见题目解析。'
            if not tip:
                tip = '图形推理：先观察元素组成、数量与位置规律，再验证选项。' if t == 'fig' else '注意审题。'
            if not key:
                key = '图形推理：对称/数量/位置规律。' if t == 'fig' else '按规律作答。'
            out.append({"date": o.get('date', ''), "src": 'xc', "no": no,
                        "mod": modmap.get(t, '行测'), "type": 'single',
                        "stem": clean(it.get('stem', '')), "options": it.get('options', []),
                        "answer": it.get('answer', []), "explain": explain,
                        "tip": tip, "key": key})
    for p in sorted(glob.glob(os.path.join(DATA, 'idiom-0*.json')) + glob.glob(os.path.join(DATA, 'idiom-[1-9]*.json'))):
        m = re.search(r'idiom-(\d+)\.json', p)
        if not m:
            continue
        no = int(m.group(1))
        try:
            o = jload(p)
        except Exception:
            continue
        for it in o.get('items', []):
            w = it.get('w', '')
            eg = it.get('eg', '')
            sent = eg.replace(w, '____') if w and w in eg else ('语境填空：' + (it.get('mean') or ''))
            wrongs = [c['w'] for c in (it.get('cmp') or []) if c.get('w') and c['w'] != w][:3]
            opts = [w] + wrongs
            rng = random.Random(no * 100 + len(out))
            pos = rng.randrange(len(opts))
            answer = [chr(65 + pos)]
            oo = list(opts)
            oo[0], oo[pos] = oo[pos], oo[0]
            out.append({"date": o.get('date', ''), "src": 'idiom', "no": no,
                        "mod": '言语理解与表达', "type": 'single', "stem": sent,
                        "options": oo, "answer": answer,
                        "explain": clean((it.get('mean') or '')), "tip": it.get('tip', ''),
                        "key": '成语填空：' + w})
    return out


def wk_shenlun_pick(rng):
    papers = []
    for p in glob.glob(os.path.join(DATA, 'shenlun_paper', 'shenlun_paper_*.json')):
        try:
            o = jload(p)
            if isinstance(o, dict) and o.get('questions'):
                for q in o['questions']:
                    papers.append((o, q))
        except Exception:
            pass
    if not papers:
        return []
    rng.shuffle(papers)
    out = []
    for o, q in papers[:2]:
        mod = clean(q.get('type', '') or '申论')
        stem_q = clean(q.get('q', '') or q.get('req', ''))
        mats = [clean(m.get('brief', '')) for m in (o.get('materials') or [])]
        stem = (('【真题材料摘要】' + '；'.join(mats) + '\n') if mats else '') + stem_q
        ref = clean(q.get('ref', ''))
        try:
            score = int(q.get('score') or 0)
        except Exception:
            score = 20
        parts = [re.sub(r'^[\d①②③④⑤⑥⑦⑧⑨⑩、\.\s]+', '', x).strip()
                 for x in re.split(r'[；;]', ref) if x.strip()]
        parts = [x for x in parts if x][:6]
        base = max(score // max(len(parts), 1), 1)
        pts = [{"pt": x[:80], "n": base} for x in parts]
        if len(pts) < 2:
            pts = [{"pt": stem_q[:60], "n": max(score // 2, 1)},
                   {"pt": '结合材料分层作答、要点齐全', "n": max(score - max(score // 2, 1), 1)}]
        tip_kind = '归纳概括' if '概括' in mod else ('提出对策' if '对策' in mod else '综合分析')
        it = {"no": 0, "mod": mod, "from": '申论真题 · ' + (o.get('exam') or ''),
              "stem": stem, "req": stem_q,
              "limit": '不超过300字',
              "points": pts, "sample": ref[:300] if ref else stem_q[:100],
              "tip": '%s题：先分层再压缩，每条“总括句＋具体做法”，不超字数、不漏分值点。' % tip_kind}
        out.append(it)
    return out


def build_weekend(no, date):
    dt = datetime.date.fromisoformat(date)
    if dt.weekday() != 5:
        print('[weekend skip] %s not Saturday' % date)
        return None
    mon = dt - datetime.timedelta(days=dt.weekday())
    sat = mon + datetime.timedelta(days=5)
    d0, d1 = mon.isoformat(), sat.isoformat()
    pool = [x for x in wk_pool() if d0 <= x.get('date', '') <= d1]
    if not pool:
        print('[weekend warn] no week data for %s~%s' % (d0, d1))
        return None
    rng = random.Random(no * 100 + 3)
    cs = [x for x in pool if x['src'] == 'issue']
    xc = [x for x in pool if x['src'] == 'xc']
    idm = [x for x in pool if x['src'] == 'idiom']
    rng.shuffle(cs); rng.shuffle(xc); rng.shuffle(idm)
    xz = []
    picked_cs = cs[:6]
    for it in picked_cs:
        xz.append(it)
    scis = [x for x in xc if x['mod'] == '科学推理']
    maths = [x for x in xc if x['mod'] == '数量关系']
    logs = [x for x in xc if x['mod'] == '判断推理']
    picked_xc = (scis[:1] + maths[:1] + logs[:1])
    rest_xc = [x for x in xc if x not in picked_xc]
    if len(picked_xc) < 4 and rest_xc:
        picked_xc += rest_xc[:4 - len(picked_xc)]
    for it in picked_xc:
        xz.append(it)
    for it in idm[:2]:
        xz.append(it)
    rng.shuffle(xz)
    for i, it in enumerate(xz, 1):
        it['no'] = i
        if it['src'] == 'issue':
            it['from'] = '第 %d 期 · 本周常识' % it['no']
        elif it['src'] == 'xc':
            it['from'] = '第 %d 批 · 行测加练' % it['no']
        else:
            it['from'] = '第 %d 期 · 词语速记' % it['no']
    sl = wk_shenlun_pick(rng)
    for i, s in enumerate(sl, 1):
        s['no'] = i
    d_from = (d0.replace('-', '/')) + ' – ' + (d1.replace('-', '/'))
    obj = {"id": no, "date": date, "range": d_from,
           "title": "第 %d 期周末测试 · 本周串考" % no,
           "sub": "覆盖 %s 本周考公（含本期常识/行测/词语速记）" % d_from,
           "note": "行测 12 题交卷自动判分；申论 %d 题交卷后对照踩分点自评。做题过程中不给答案、不给解析。" % len(sl),
           "xz": xz, "sl": sl}
    jdump(os.path.join(DATA, 'weekend-%03d.json' % no), obj)
    return 'weekend-%03d' % no


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
        # 默认生成确定性刷题内容 + 英语角/新闻页/周末卷（全自动，不依赖本地/AI 创作）
        if only is not None:
            return k in only
        return k in ('issue', 'idiom', 'xc', 'lj', 'vocab', 'news', 'weekend')

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

    if want('vocab'):
        made.append(build_vocab(max_no('vocab') + 1, date))
    if want('news'):
        r = build_news(max_no('news') + 1, date)
        if r:
            made.append(r)
    if want('weekend'):
        r = build_weekend(max_no('weekend') + 1, date)
        if r:
            made.append(r)

    print('DATE=%s MADE=%s' % (date, ','.join(made)))


if __name__ == '__main__':
    main()
