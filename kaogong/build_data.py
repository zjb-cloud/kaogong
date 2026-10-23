# -*- coding: utf-8 -*-
"""
把 kaogong/data/issue-*.json 合并成 kaogong/data/issues.js（前端用 file:// 打开也能读）。
用法：
    python kaogong/build_data.py            # 目录里所有期
    python kaogong/build_data.py 4          # 只校验/合并到第 4 期（不删其他）
"""
import glob
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
OUT = os.path.join(DATA, "issues.js")

REQUIRED_ITEM = ("kp", "q")


def load_all():
    issues = []
    for path in sorted(glob.glob(os.path.join(DATA, "issue-*.json"))):
        with open(path, "r", encoding="utf-8") as f:
            try:
                obj = json.load(f)
            except Exception as e:
                print("[FAIL] %s 不是合法 JSON: %s" % (os.path.basename(path), e))
                continue
        problems = validate(obj)
        if problems:
            print("[WARN] %s 存在问题：" % os.path.basename(path))
            for p in problems:
                print("       - " + p)
        issues.append(obj)
    issues.sort(key=lambda x: x.get("issue", 0))
    return issues


def validate(obj):
    bad = []
    if not isinstance(obj.get("issue"), int):
        bad.append("缺少 issue(int)")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    for i, it in enumerate(items, 1):
        if not isinstance(it.get("kp"), dict) or not it["kp"].get("title"):
            bad.append("第 %d 题缺 kp.title" % i)
        q = it.get("q")
        if not isinstance(q, dict):
            bad.append("第 %d 题缺 q" % i)
            continue
        if q.get("type") not in ("single", "multi"):
            bad.append("第 %d 题 type 必须是 single/multi" % i)
        opts = q.get("options") or []
        ans = q.get("answer") or []
        if len(opts) < 2:
            bad.append("第 %d 题选项不足" % i)
        letters = "ABCDEFGH"[: len(opts)]
        for a in ans:
            if a not in letters:
                bad.append("第 %d 题答案 %s 超出选项范围" % (i, a))
        if q.get("type") == "single" and len(ans) != 1:
            bad.append("第 %d 题单选却有 %d 个答案" % (i, len(ans)))
        if q.get("type") == "multi" and len(ans) < 2:
            bad.append("第 %d 题多选却只有 %d 个答案" % (i, len(ans)))
        if not q.get("explain"):
            bad.append("第 %d 题缺解析" % i)
    return bad


def next_issue():
    nums = []
    for path in glob.glob(os.path.join(DATA, "issue-*.json")):
        m = re.search(r"issue-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


""" ---------------- 背单词部分 ---------------- """

PLAN_JSON = os.path.join(DATA, "vocab-plan.json")
PLAN_OUT = os.path.join(DATA, "vocab_plan.js")
VB_OUT = os.path.join(DATA, "vocab.js")
VPER = 50


def build_plan():
    if not os.path.exists(PLAN_JSON):
        print("[WARN] 没有 vocab-plan.json，跳过词表")
        return 0
    rows = json.load(open(PLAN_JSON, "r", encoding="utf-8"))
    js = "window.KG_VOCAB_PLAN = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(PLAN_OUT, "w", encoding="utf-8", newline="\n").write(js)
    return len(rows)


def load_batches():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "vocab-*.json"))):
        base = os.path.basename(path)
        if base.startswith("vocab-plan"):
            continue
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_batch(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("batch", 0))
    return out


def validate_batch(obj):
    bad = []
    if not isinstance(obj.get("batch"), int):
        bad.append("缺 batch(int)")
    ws = obj.get("words")
    if not isinstance(ws, list) or not ws:
        bad.append("words 为空")
        return bad
    if len(ws) != VPER:
        bad.append("词数 %d，期望 %d" % (len(ws), VPER))
    for i, w in enumerate(ws, 1):
        if not w.get("w"):
            bad.append("第 %d 个词缺 w" % i)
        if not w.get("cn"):
            bad.append("第 %d 个词缺 cn（中文释义）" % i)
        if not w.get("eg"):
            bad.append("第 %d 个词缺 eg（例句）" % i)
        rel = w.get("rel") or {}
        if not (rel.get("form") or rel.get("sound") or rel.get("syn")):
            bad.append("第 %d 个词缺 rel（形近/音近/近义）" % i)
        for rk in ("form", "sound", "syn"):
            rv = rel.get(rk)
            if rv is None:
                continue
            if not isinstance(rv, list) or not all(isinstance(x, str) and x.strip() for x in rv):
                bad.append("第 %d 个词 rel.%s 必须是字符串数组（前端按数组渲染）" % (i, rk))
    bad += validate_article(obj)
    return bad


def validate_article(obj):
    """每天配 1 篇四级风格精读：正文 + 重点难点词汇/短语 + 可选名言/长难句"""
    bad = []
    a = obj.get("article")
    if not isinstance(a, dict):
        bad.append("缺 article（每日精读文章）")
        return bad
    if not a.get("title"):
        bad.append("article 缺 title")
    if not a.get("topic"):
        bad.append("article 缺 topic（题材，如 人文历史）")
    paras = a.get("paras")
    if not isinstance(paras, list) or len(paras) < 2:
        bad.append("article.paras 至少 2 段（英文正文）")
    else:
        wc = sum(len(str(p).split()) for p in paras)
        if wc < 200:
            bad.append("article 正文约 %d 词，建议 ≥200 词（四级阅读体量）" % wc)
    g = a.get("glossary") or {}
    gw = g.get("words") or []
    gp = g.get("phrases") or []
    if len(gw) < 5:
        bad.append("article.glossary.words 至少 5 个重点词")
    for i, x in enumerate(gw, 1):
        if not x.get("w"):
            bad.append("glossary.words 第 %d 个缺 w" % i)
        if not x.get("cn"):
            bad.append("glossary.words 第 %d 个缺 cn" % i)
    if len(gp) < 3:
        bad.append("article.glossary.phrases 至少 3 个重点短语")
    for i, x in enumerate(gp, 1):
        if not x.get("p"):
            bad.append("glossary.phrases 第 %d 个缺 p" % i)
        if not x.get("cn"):
            bad.append("glossary.phrases 第 %d 个缺 cn" % i)
    for i, x in enumerate(a.get("quotes") or [], 1):
        if not x.get("en"):
            bad.append("quotes 第 %d 条缺 en" % i)
        if not x.get("who"):
            bad.append("quotes 第 %d 条缺 who（出处/作者）" % i)
    return bad


def build_vocab():
    plan_n = build_plan()
    batches = load_batches()
    js = "window.KG_VOCAB = " + json.dumps(batches, ensure_ascii=False) + ";\n"
    open(VB_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nwords = sum(len(b.get("words", [])) for b in batches)
    nart = sum(1 for b in batches if b.get("article"))
    print("OK  英语角 %d 词 · 已生成 %d 天 / %d 词（每天 %d）+ %d 篇精读" % (plan_n, len(batches), nwords, VPER, nart))


""" ---------------- 每日新闻 + 申论素材 ---------------- """

NEWS_OUT = os.path.join(DATA, "news.js")


def load_news():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "news-*.json"))):
        base = os.path.basename(path)
        if base.startswith("news-plan"):
            continue
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_news(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("id", 0))
    return out


def validate_news(obj):
    bad = []
    if not isinstance(obj.get("id"), int):
        bad.append("缺 id(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    news = obj.get("news")
    if not isinstance(news, list) or not news:
        bad.append("news 为空")
    else:
        if not (2 <= len(news) <= 4):
            bad.append("news 应为 2~4 条精读（当前 %d 条）" % len(news))
        for i, n in enumerate(news, 1):
            for k in ("cat", "h", "p", "why"):
                if not n.get(k):
                    bad.append("第 %d 条新闻缺 %s" % (i, k))
    sl = obj.get("shenlun")
    if not isinstance(sl, list) or not sl:
        bad.append("shenlun 为空（申论金句至少要 1 条）")
    else:
        for i, s in enumerate(sl, 1):
            for k in ("topic", "pattern", "sentence", "use", "back"):
                if not s.get(k):
                    bad.append("第 %d 条申论金句缺 %s" % (i, k))
            cs = s.get("cases")
            if not isinstance(cs, list) or len(cs) < 2:
                bad.append("第 %d 条申论金句的 cases 至少 2 个案例（一句话套多个案例）" % i)
            else:
                for j, c in enumerate(cs, 1):
                    if not (c.get("n") and c.get("d")):
                        bad.append("第 %d 条金句第 %d 个案例缺 n/d" % (i, j))
    return bad


def next_news():
    nums = []
    for path in glob.glob(os.path.join(DATA, "news-*.json")):
        m = re.search(r"news-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_news():
    rows = load_news()
    js = "window.KG_NEWS = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(NEWS_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nitems = sum(len(r.get("news", [])) for r in rows)
    nsl = sum(len(r.get("shenlun", [])) for r in rows)
    print("OK  新闻 %d 期 / %d 条精读 / 申论金句 %d 条" % (len(rows), nitems, nsl))


""" ---------------- 词语速记（成语 · 四字词语） ---------------- """

IDIOM_OUT = os.path.join(DATA, "idioms.js")
IPER = 10


def load_idioms():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "idiom-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_idiom(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("set", 0))
    return out


def validate_idiom(obj):
    bad = []
    if not isinstance(obj.get("set"), int):
        bad.append("缺 set(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    if obj.get("session") not in ("am", "pm", "day"):
        bad.append("session 必须是 am/pm（day 仅用于早期补录那一期）")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    if len(items) != IPER:
        bad.append("词语数 %d，期望 %d" % (len(items), IPER))
    seen = set()
    for i, it in enumerate(items, 1):
        for k in ("w", "mean", "eg", "tip"):
            if not it.get(k):
                bad.append("第 %d 个词语缺 %s" % (i, k))
        if not it.get("py"):
            bad.append("第 %d 个词语缺 py（拼音）" % i)
        if it.get("w") in seen:
            bad.append("第 %d 个词语「%s」在本期内重复" % (i, it.get("w")))
        seen.add(it.get("w"))
        opts = it.get("options") or []
        ans = it.get("answer")
        if not isinstance(ans, list):
            bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
            ans = []
        if len(opts) != 4:
            bad.append("第 %d 个词语选项数 %d，期望 4（四选一）" % (i, len(opts)))
        if len(ans) != 1 or ans[0] not in "ABCD":
            bad.append("第 %d 个词语 answer 必须是 1 个字母（A-D）" % i)
        cmp = it.get("cmp")
        if not isinstance(cmp, list) or len(cmp) != len(opts):
            bad.append("第 %d 个词语缺 cmp（四选项对应词，长度需等于选项数）" % i)
        else:
            ai = "ABCD".index(ans[0]) if (len(ans) == 1 and ans[0] in "ABCD") else -1
            for k, c in enumerate(cmp):
                if not isinstance(c, dict):
                    bad.append("第 %d 个词语 cmp[%d] 不是对象" % (i, k))
                    continue
                if c.get("self"):
                    if k != ai:
                        bad.append("第 %d 个词语 cmp 的 self 位置(%s)与 answer(%s)不一致" % (i, "ABCD"[k], ans[0]))
                elif not c.get("w"):
                    bad.append("第 %d 个词语 cmp[%d] 缺 w" % (i, k))
    return bad


def next_idiom():
    nums = []
    for path in glob.glob(os.path.join(DATA, "idiom-*.json")):
        m = re.search(r"idiom-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_idioms():
    rows = load_idioms()
    js = "window.KG_IDIOMS = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(IDIOM_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nitems = sum(len(r.get("items", [])) for r in rows)
    print("OK  词语速记 %d 期 / %d 个词语" % (len(rows), nitems))


""" ---------------- 填空选词（词语速记的反向模式） ----------------

    玩法：给一句挖空的话 → 从 4 个易混词语里挑能填进去的 → 判定后给释义/例句 +
    「每个选项为什么不行」。数据：kaogong/data/idiomfill-NNN.json（期号跟 idiom 对齐）。
"""

FILL_OUT = os.path.join(DATA, "idiomfill.js")


def load_idiomfills():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "idiomfill-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_idiomfill(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("set", 0))
    return out


def validate_idiomfill(obj):
    bad = []
    if not isinstance(obj.get("set"), int):
        bad.append("缺 set(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    if obj.get("session") not in ("am", "pm", "day"):
        bad.append("session 必须是 am/pm（day 仅用于早期补录那一期）")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    if len(items) != IPER:
        bad.append("填空数 %d，期望 %d" % (len(items), IPER))
    seen = set()
    for i, it in enumerate(items, 1):
        for k in ("w", "sent", "mean", "eg", "tip"):
            if not it.get(k):
                bad.append("第 %d 题缺 %s" % (i, k))
        if u"____" not in (it.get("sent") or u""):
            bad.append(u"第 %d 题句子没有挖空（应为 ____）" % i)
        if it.get("w") in seen:
            bad.append("第 %d 题「%s」在本期内重复" % (i, it.get("w")))
        seen.add(it.get("w"))
        opts = it.get("options") or []
        ans = it.get("answer")
        if not isinstance(ans, list):
            bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
            ans = []
        if len(opts) != 4:
            bad.append("第 %d 题选项数 %d，期望 4" % (i, len(opts)))
        if len(set(opts)) != len(opts):
            bad.append("第 %d 题选项里有重复词语" % i)
        if it.get("w") and it.get("w") not in opts:
            bad.append("第 %d 题正确词「%s」不在选项里" % (i, it.get("w")))
        if len(ans) != 1 or ans[0] not in "ABCD":
            bad.append("第 %d 题 answer 必须是 1 个字母（A-D）" % i)
        elif len(opts) == 4 and opts["ABCD".index(ans[0])] != it.get("w"):
            bad.append("第 %d 题 answer(%s) 指向的不是正确词「%s」" % (i, ans[0], it.get("w")))
        cmp_ = it.get("cmp")
        if not isinstance(cmp_, list) or len(cmp_) != len(opts):
            bad.append("第 %d 题缺 cmp（四选项对应词，长度需等于选项数）" % i)
        else:
            ai = "ABCD".index(ans[0]) if (len(ans) == 1 and ans[0] in "ABCD") else -1
            for k, c in enumerate(cmp_):
                if not isinstance(c, dict):
                    bad.append("第 %d 题 cmp[%d] 不是对象" % (i, k))
                    continue
                if c.get("self"):
                    if k != ai:
                        bad.append("第 %d 题 cmp 的 self 位置(%s)与 answer(%s)不一致" % (i, "ABCD"[k], ans[0]))
                elif not (c.get("w") and c.get("mean") and c.get("why")):
                    bad.append("第 %d 题 cmp[%d] 缺 w/mean/why（要说明这个干扰词为什么不行）" % (i, k))
    return bad


def build_idiomfill():
    rows = load_idiomfills()
    js = "window.KG_IDIOMFILL = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(FILL_OUT, "w", encoding="utf-8", newline="\n").write(js)
    n = sum(len(r.get("items", [])) for r in rows)
    print("OK  填空选词 %d 期 / %d 题" % (len(rows), n))


""" ---------------- 速算训练（资料分析速算） ---------------- """

CALC_OUT = os.path.join(DATA, "calc.js")
CPER = 20


def load_calcs():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "calc-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_calc(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("set", 0))
    return out


def validate_calc(obj):
    bad = []
    if not isinstance(obj.get("set"), int):
        bad.append("缺 set(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    if len(items) != CPER:
        bad.append("题数 %d，期望 %d" % (len(items), CPER))
    for i, it in enumerate(items, 1):
        if it.get("type") not in ("pure", "applied"):
            bad.append("第 %d 题 type 必须是 pure/applied" % i)
        for k in ("stem", "explain", "method", "tip"):
            if not it.get(k):
                bad.append("第 %d 题缺 %s" % (i, k))
        tp = it.get("topic")
        if tp is not None and (not isinstance(tp, str) or not tp.strip() or len(tp) > 20):
            bad.append("第 %d 题 topic 要写成 20 字以内的题型标签（如「化同法」），可留空" % i)
        if it.get("type") == "applied" and not it.get("data"):
            bad.append("第 %d 题是应用题却缺 data（材料）" % i)
        opts = it.get("options") or []
        ans = it.get("answer")
        if not isinstance(ans, list):
            bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
            ans = []
        if len(opts) < (3 if tp == "fig" else 4):
            bad.append("第 %d 题选项数 %d，至少 4 个" % (i, len(opts)))
        if len(ans) != 1:
            bad.append("第 %d 题 answer 必须是 1 个字母（单选）" % i)
        elif ans[0] not in "ABCDEFGH"[: len(opts)]:
            bad.append("第 %d 题答案 %s 超出选项范围" % (i, ans[0]))
    return bad


def next_calc():
    nums = []
    for path in glob.glob(os.path.join(DATA, "calc-*.json")):
        m = re.search(r"calc-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_calc():
    rows = load_calcs()
    js = "window.KG_CALC = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(CALC_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nitems = sum(len(r.get("items", [])) for r in rows)
    napp = sum(1 for r in rows for it in r.get("items", []) if it.get("type") == "applied")
    print("OK  速算训练 %d 批 / %d 题（其中资料分析应用题 %d 题）" % (len(rows), nitems, napp))


""" ---------------- 行测加练（科学推理 / 数量关系 / 判断推理） ---------------- """

XC_OUT = os.path.join(DATA, "xc.js")
XC_TYPES = ("sci", "math", "logic", "fig")


def load_xcs():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "xc-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_xc(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("set", 0))
    return out


def validate_xc(obj):
    bad = []
    if not isinstance(obj.get("set"), int):
        bad.append("缺 set(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    for i, it in enumerate(items, 1):
        tp = it.get("type")
        if tp not in XC_TYPES:
            bad.append("第 %d 题 type 必须是 sci/math/logic/fig" % i)
        if tp == "fig" and not (it.get("imgs") or it.get("img")):
            bad.append("第 %d 题（图形推理）缺 img" % i)
        for k in (("stem", "explain") if tp == "fig" else ("stem", "explain", "tip")):
            if not it.get(k):
                bad.append("第 %d 题缺 %s" % (i, k))
        opts = it.get("options") or []
        ans = it.get("answer")
        if not isinstance(ans, list):
            bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
            ans = []
        if len(opts) < (3 if tp == "fig" else 4):
            bad.append("第 %d 题选项数 %d，至少 4 个" % (i, len(opts)))
        if len(ans) != 1:
            bad.append("第 %d 题 answer 必须是 1 个字母（单选）" % i)
        elif ans[0] not in "ABCDEFGH"[: len(opts)]:
            bad.append("第 %d 题答案 %s 超出选项范围" % (i, ans[0]))
    return bad


def next_xc():
    nums = []
    for path in glob.glob(os.path.join(DATA, "xc-*.json")):
        m = re.search(r"xc-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_xc():
    rows = load_xcs()
    js = "window.KG_XC = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(XC_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nitems = sum(len(r.get("items", [])) for r in rows)
    c = {}
    for r in rows:
        for it in r.get("items", []):
            c[it.get("type")] = c.get(it.get("type"), 0) + 1
    print("OK  行测加练 %d 批 / %d 题（科学推理 %d · 数量关系 %d · 判断推理 %d · 图形推理 %d）"
          % (len(rows), nitems, c.get("sci", 0), c.get("math", 0), c.get("logic", 0), c.get("fig", 0)))


""" ---------------- 逻辑判断（国省考真题） ---------------- """

LJ_OUT = os.path.join(DATA, "lj.js")


def load_ljs():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "lj-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_lj(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("set", 0))
    return out


def validate_lj(obj):
    bad = []
    if not isinstance(obj.get("set"), int):
        bad.append("缺 set(int)")
    if not obj.get("date"):
        bad.append("缺 date")
    items = obj.get("items")
    if not isinstance(items, list) or not items:
        bad.append("items 为空")
        return bad
    for i, it in enumerate(items, 1):
        for k in ("type", "stem", "explain", "point"):
            if not it.get(k):
                bad.append("第 %d 题缺 %s" % (i, k))
        opts = it.get("options") or []
        ans = it.get("answer")
        if not isinstance(ans, list):
            bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
            ans = []
        if len(opts) < 4:
            bad.append("第 %d 题选项数 %d，至少 4 个" % (i, len(opts)))
        if len(ans) != 1:
            bad.append("第 %d 题 answer 必须是 1 个字母（单选）" % i)
        elif ans[0] not in "ABCDEFGH"[: len(opts)]:
            bad.append("第 %d 题答案 %s 超出选项范围" % (i, ans[0]))
        if not it.get("from"):
            bad.append("第 %d 题缺 from（真题出处）" % i)
    return bad


def next_lj():
    nums = []
    for path in glob.glob(os.path.join(DATA, "lj-*.json")):
        m = re.search(r"lj-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_lj():
    rows = load_ljs()
    js = "window.KG_LJ = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(LJ_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nitems = sum(len(r.get("items", [])) for r in rows)
    print("OK  逻辑判断 %d 期 / %d 题" % (len(rows), nitems))


LJDRILL_OUT = os.path.join(DATA, "ljdrill.js")


def build_ljdrill():
    """专项挑战包：按考点分组的题库（data/ljdrill.json → ljdrill.js）"""
    path = os.path.join(DATA, "ljdrill.json")
    if not os.path.exists(path):
        open(LJDRILL_OUT, "w", encoding="utf-8", newline="\n").write("window.KG_LJDRILL = [];\n")
        print("OK  逻辑判断专项挑战 0 个考点（未初始化）")
        return
    try:
        obj = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        print("[FAIL] ljdrill.json 不是合法 JSON: %s" % e)
        return
    sets = obj.get("sets") or []
    nq = 0
    for s in sets:
        items = s.get("items") or []
        nq += len(items)
        if not s.get("cat") or not isinstance(s.get("set"), int):
            print("[WARN] 专项挑战某组缺 set/cat")
        bad = validate_lj({"set": s.get("set"), "date": s.get("date") or "drill", "items": items})
        if bad:
            print("[WARN] 专项挑战 · %s：" % s.get("cat"))
            for b in bad[:6]:
                print("       - " + b)
    open(LJDRILL_OUT, "w", encoding="utf-8", newline="\n").write(
        "window.KG_LJDRILL = " + json.dumps(sets, ensure_ascii=False) + ";\n")
    print("OK  逻辑判断专项挑战 %d 个考点 / %d 题" % (len(sets), nq))


def build_figure_pool():
    """校验图形推理真题池（每道至少一张图、图片存在、ans 为字母、选项数合理）"""
    path = os.path.join(DATA, "figure_pool.json")
    if not os.path.exists(path):
        print("OK  \u56fe\u5f62\u63a8\u7406\u771f\u9898\u6c60 0 \u9898\uff08\u672a\u521d\u59cb\u5316\uff09")
        return
    pool = json.load(open(path, encoding="utf-8"))
    items = pool.get("items", [])
    miss = 0
    for it in items:
        imgs = it.get("imgs") or ([it["img"]] if it.get("img") else [])
        if not imgs:
            miss += 1
            continue
        for rel in imgs:
            if not rel or not os.path.exists(os.path.join(DATA, "..", rel)):
                miss += 1
                break
        if it.get("ans", "") not in "ABCDEFGH":
            print("[WARN] \u9898\u6c60 %s \u7b54\u6848\u5f02\u5e38\uff1a%r" % (it.get("id"), it.get("ans")))
    nq = len([x for x in items if x.get("from", "").startswith("quizsim")])
    print("OK  \u56fe\u5f62\u63a8\u7406\u771f\u9898\u6c60 %d \u9898\uff08\u542b\u9010\u9898\u89e3\u6790 %d\uff0c\u56fe\u7247\u7f3a\u5931 %d\uff09" % (len(items), nq, miss))


""" ---------------- 周末测试（行测 + 申论，一周一张卷） ---------------- """

WK_OUT = os.path.join(DATA, "weekend.js")


def load_weekends():
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "weekend-*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] %s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_weekend(obj)
        if bad:
            print("[WARN] %s：" % base)
            for b in bad:
                print("       - " + b)
        out.append(obj)
    out.sort(key=lambda x: x.get("id", 0))
    return out


def validate_weekend(obj):
    bad = []
    if not isinstance(obj.get("id"), int):
        bad.append("缺 id(int)")
    for k in ("date", "title", "range"):
        if not obj.get(k):
            bad.append("缺 %s" % k)
    xz = obj.get("xz")
    if not isinstance(xz, list) or not xz:
        bad.append("xz（行测）为空")
    else:
        for i, it in enumerate(xz, 1):
            for k in ("mod", "stem", "explain", "tip", "key"):
                if not it.get(k):
                    bad.append("行测第 %d 题缺 %s" % (i, k))
            if it.get("type") not in ("single", "multi"):
                bad.append("行测第 %d 题 type 必须是 single/multi" % i)
            opts = it.get("options") or []
            ans = it.get("answer")
            if not isinstance(ans, list):
                bad.append("第 %d 题：answer 必须是数组（如 [\"B\"]），不能写成字符串" % i)
                ans = []
            if len(opts) < 2:
                bad.append("行测第 %d 题选项不足" % i)
            letters = "ABCDEFGH"[: len(opts)]
            for a in ans:
                if a not in letters:
                    bad.append("行测第 %d 题答案 %s 超出选项范围" % (i, a))
            if it.get("type") == "single" and len(ans) != 1:
                bad.append("行测第 %d 题是单选却 %d 个答案" % (i, len(ans)))
            if it.get("type") == "multi" and len(ans) < 2:
                bad.append("行测第 %d 题是多选却只有 %d 个答案" % (i, len(ans)))
    sl = obj.get("sl")
    if not isinstance(sl, list) or not sl:
        bad.append("sl（申论）为空")
    else:
        for i, it in enumerate(sl, 1):
            for k in ("mod", "stem", "req", "sample", "tip"):
                if not it.get(k):
                    bad.append("申论第 %d 题缺 %s" % (i, k))
            pts = it.get("points") or []
            if len(pts) < 2:
                bad.append("申论第 %d 题踩分点至少 2 条" % i)
            for j, p in enumerate(pts, 1):
                if not p.get("pt"):
                    bad.append("申论第 %d 题第 %d 个踩分点缺 pt" % (i, j))
                if not isinstance(p.get("n"), int) or p["n"] <= 0:
                    bad.append("申论第 %d 题第 %d 个踩分点分值 n 必须是正整数" % (i, j))
    return bad


def next_weekend():
    nums = []
    for path in glob.glob(os.path.join(DATA, "weekend-*.json")):
        m = re.search(r"weekend-(\d+)\.json$", os.path.basename(path))
        if m:
            nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def build_weekend():
    rows = load_weekends()
    js = "window.KG_WEEKEND = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(WK_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nx = sum(len(r.get("xz", [])) for r in rows)
    ns = sum(len(r.get("sl", [])) for r in rows)
    nm = sum(len(it.get("points", [])) for r in rows for it in r.get("sl", []))
    print("OK  周末测试 %d 期 / 行测 %d 题 + 申论 %d 题（踩分点 %d 条）" % (len(rows), nx, ns, nm))


""" ---------------- 常识提纲（考点全景，只查看不做题） ----------------

    数据：kaogong/data/outline/*.json，每个文件一个大类（按文件名排序）。
    目的：把出题会涉及的全部知识点列出来，方便回查、串联不同模块。
"""

OL_DIR = os.path.join(DATA, "outline")
OL_OUT = os.path.join(DATA, "outline.js")


def validate_outline(obj, base):
    bad = []
    for k in ("id", "name", "icon"):
        if not obj.get(k):
            bad.append("缺 %s" % k)
    if not isinstance(obj.get("desc"), str):
        bad.append("缺 desc")
    groups = obj.get("groups")
    if not isinstance(groups, list) or not groups:
        bad.append("groups 为空")
        return bad
    for gi, g in enumerate(groups, 1):
        if not g.get("g"):
            bad.append("第 %d 组缺 g（组名）" % gi)
        items = g.get("items")
        if not isinstance(items, list) or not items:
            bad.append("第 %d 组 items 为空" % gi)
            continue
        for ii, it in enumerate(items, 1):
            if not it.get("t"):
                bad.append("第 %d 组第 %d 条缺 t（标题）" % (gi, ii))
            pts = it.get("pts")
            if not isinstance(pts, list) or not pts:
                bad.append("第 %d 组第 %d 条缺 pts（知识点数组）" % (gi, ii))
            elif not all(isinstance(x, str) and x.strip() for x in pts):
                bad.append("第 %d 组第 %d 条 pts 有空白项" % (gi, ii))
            src = it.get("src")
            if src is not None and (not isinstance(src, list) or not all(isinstance(x, int) for x in src)):
                bad.append("第 %d 组第 %d 条 src 必须是期号数组(int)" % (gi, ii))
            rel = it.get("rel")
            if rel is not None and (not isinstance(rel, list) or not all(isinstance(x, str) for x in rel)):
                bad.append("第 %d 组第 %d 条 rel 必须是条目名数组" % (gi, ii))
            lv = it.get("lv")
            if lv is not None and lv not in ("hot", "mid"):
                bad.append("第 %d 组第 %d 条 lv 只能是 hot/mid" % (gi, ii))
    return bad


def load_outline():
    cats = []
    seen = {}
    for path in sorted(glob.glob(os.path.join(OL_DIR, "*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] outline/%s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_outline(obj, base)
        if bad:
            print("[WARN] outline/%s：" % base)
            for b in bad:
                print("       - " + b)
        for g in obj.get("groups") or []:
            for it in g.get("items") or []:
                t = it.get("t")
                if t in seen:
                    print("[WARN] outline/%s：条目「%s」与 %s 重复" % (base, t, seen[t]))
                seen[t] = base
        cats.append(obj)
    return cats


def build_outline(quiet=False):
    if not os.path.isdir(OL_DIR):
        if not quiet:
            print("[WARN] 没有 outline 目录，跳过提纲")
        return []
    cats = load_outline()
    payload = {"v": 1, "title": "常识提纲 · 考点全景", "cats": cats}
    js = "window.KG_OUTLINE = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    open(OL_OUT, "w", encoding="utf-8", newline="\n").write(js)
    ng = sum(len(c.get("groups") or []) for c in cats)
    ni = sum(len(g.get("items") or []) for c in cats for g in (c.get("groups") or []))
    ntested = sum(1 for c in cats for g in (c.get("groups") or []) for it in (g.get("items") or []) if it.get("src"))
    print("OK  常识提纲 %d 大类 / %d 组 / %d 条（已考过 %d 条）" % (len(cats), ng, ni, ntested))
    return cats


PH_OUT = os.path.join(DATA, "phrases.js")


def _sent_with(paras, ph):
    """从英文段落里找出包含该短语的句子，返回 (句子, 段落下标)"""
    core = re.sub(r"\([^)]*\)", " ", ph)
    core = re.sub(r"\b(sth|sb|someone|something|oneself)\b", " ", core, flags=re.I)
    toks = [re.escape(t) for t in re.split(r"[\s.…、/]+", core) if len(t) > 1]
    if not toks:
        return "", -1
    gap = r"(?:\s+\S+){0,3}\s+"
    pat = re.compile(r"[^.!?]*?" + gap.join(toks[:3]) + r"[^.!?]*[.!?]", re.I)
    for i, para in enumerate(paras or []):
        m = pat.search(str(para))
        if m:
            return m.group(0).strip(), i
    for i, para in enumerate(paras or []):
        if toks[0].replace("\\", "") and re.search(toks[0], str(para), re.I):
            return "", i
    return "", -1


def build_phrases():
    """从各期精读文章的 glossary.phrases 汇总出「背短语」题库（含例句 + 原段落译文）"""
    rows = []
    for b in load_batches():
        if not isinstance(b, dict):
            continue
        art = b.get("article") or {}
        ph = ((art.get("glossary") or {}).get("phrases")) or []
        paras = art.get("paras") or []
        zh = art.get("zh")
        if not ph:
            continue
        items = []
        for x in ph:
            p = (x.get("p") or "").strip()
            cn = (x.get("cn") or "").strip()
            if not p or not cn:
                continue
            eg, pi = _sent_with(paras, p)
            egcn = ""
            if pi >= 0 and isinstance(zh, list) and pi < len(zh):
                egcn = str(zh[pi]).strip()
            elif isinstance(zh, str):
                egcn = zh.strip()
            items.append({"p": p, "cn": cn, "eg": eg, "egcn": egcn, "src": art.get("title") or ""})
        if items:
            rows.append({
                "set": b.get("batch"),
                "date": b.get("date"),
                "topic": art.get("topic") or "",
                "title": art.get("title") or "",
                "items": items,
            })
    rows.sort(key=lambda r: r.get("set") or 0)
    js = "window.KG_PHRASES = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(PH_OUT, "w", encoding="utf-8", newline="\n").write(js)
    n = sum(len(r["items"]) for r in rows)
    ne = sum(1 for r in rows for i in r["items"] if i["eg"])
    print("OK  [phrases] %d batch / %d phrase (with eg %d)" % (len(rows), n, ne))
    if n < 4:
        print("[WARN] phrases total < 4, quiz distractors may be short")
    for b in validate_phrases():
        print("[WARN] phrases: " + b)


def validate_phrases():
    bad = []
    for b in load_batches():
        if not isinstance(b, dict):
            continue
        ph = ((b.get("article") or {}).get("glossary") or {}).get("phrases") or []
        for i, x in enumerate(ph, 1):
            if not (x.get("p") or "").strip():
                bad.append("batch %s phrase #%d missing p" % (b.get("batch"), i))
            if not (x.get("cn") or "").strip():
                bad.append("batch %s phrase #%d missing cn" % (b.get("batch"), i))
    return bad


""" ---------------- 静态全量真题题库（bankq） ----------------
    数据：kaogong/data/bankq/bankq_<mod>.json，统一题结构：
    {"id","mod","topic","src","year","type","stem","options","ans",
     "ana":{"err","sol","avoid"},"extra"?,"fig"?}
    前端：window.KG_BANK = {v, modules:[{mod,name,topics}], questions:[...]}
"""

BANKQ_DIR = os.path.join(DATA, "bankq")
BANKQ_OUT = os.path.join(DATA, "bankq.js")


def validate_bankq(obj, base):
    bad = []
    if not obj.get("mod"):
        bad.append("缺 mod")
    if not obj.get("name"):
        bad.append("缺 name")
    qs = obj.get("questions")
    if not isinstance(qs, list) or not qs:
        bad.append("questions 为空")
        return bad
    for i, q in enumerate(qs, 1):
        if not q.get("id"):
            bad.append("第 %d 题缺 id" % i)
        if not q.get("stem"):
            bad.append("第 %d 题缺 stem" % i)
        opts = q.get("options") or []
        if len(opts) < 2:
            bad.append("第 %d 题选项不足" % i)
        ans = q.get("ans") or []
        letters = "ABCDEFGH"[: max(len(opts), 1)]
        for a in ans:
            if a not in letters:
                bad.append("第 %d 题答案 %s 超出选项范围" % (i, a))
        if q.get("type") == "multi" and len(ans) < 2:
            bad.append("第 %d 题多选却只有 %d 个答案" % (i, len(ans)))
        ana = q.get("ana") or {}
        for k in ("err", "sol", "avoid"):
            if not ana.get(k):
                bad.append("第 %d 题缺 ana.%s（三段式）" % (i, k))
        fig = q.get("fig")
        if fig:
            if not (fig.get("imgs") or fig.get("desc")):
                bad.append("第 %d 题图形题缺图片或文字兜底 desc" % i)
    return bad


def load_bankq():
    qs, mods = [], []
    for path in sorted(glob.glob(os.path.join(BANKQ_DIR, "bankq_*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] bankq/%s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_bankq(obj, base)
        if bad:
            print("[WARN] bankq/%s：" % base)
            for b in bad:
                print("       - " + b)
        mods.append({"mod": obj.get("mod"), "name": obj.get("name"),
                     "n": sum((t.get("n") or 0) for t in (obj.get("topics") or [])),
                     "topics": obj.get("topics") or []})
        qs.extend(obj.get("questions") or [])
    return mods, qs


def build_bank(quiet=False):
    if not os.path.isdir(BANKQ_DIR):
        if not quiet:
            print("[WARN] 没有 bankq 目录，跳过静态题库")
        return
    mods, qs = load_bankq()
    payload = {"v": 1, "modules": mods, "questions": qs}
    js = "window.KG_BANK = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    open(BANKQ_OUT, "w", encoding="utf-8", newline="\n").write(js)
    nfig = sum(1 for q in qs if q.get("fig"))
    print("OK  静态真题题库 %d 个模块 / %d 题（图形题 %d，含文字兜底）" % (len(mods), len(qs), nfig))


""" ---------------- 申论时事素材库（shenlun） ----------------
    数据：kaogong/data/shenlun/shenlun_<id>.json（8 大主题）+ shenlun_calendar.json（纪念日）
    结构：cat {id,name,icon,desc,items:[{date,title,brief,angles[],quotes[],src}]}
          calendar {kind:"calendar",items:[{date,name,desc,angles[]}]}
    前端：window.KG_SHENLUN = {v, cats, calendar, updated}
"""

SL_DIR = os.path.join(DATA, "shenlun")
SL_OUT = os.path.join(DATA, "shenlun.js")


def validate_shenlun(obj, base):
    bad = []
    if obj.get("kind") == "calendar":
        for i, it in enumerate((obj.get("items") or []), 1):
            for k in ("date", "name"):
                if not it.get(k):
                    bad.append("纪念日第 %d 条缺 %s" % (i, k))
        return bad
    for k in ("id", "name"):
        if not obj.get(k):
            bad.append("缺 %s" % k)
    for i, it in enumerate((obj.get("items") or []), 1):
        for k in ("date", "title", "brief"):
            if not it.get(k):
                bad.append("第 %d 条缺 %s" % (i, k))
        if not isinstance(it.get("angles") or [], list) or not it.get("angles"):
            bad.append("第 %d 条缺 angles（申论切入方向）" % i)
        if not isinstance(it.get("quotes") or [], list) or not it.get("quotes"):
            bad.append("第 %d 条缺 quotes（规范金句）" % i)
    return bad


def load_shenlun():
    cats, cal = [], []
    for path in sorted(glob.glob(os.path.join(SL_DIR, "*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] shenlun/%s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_shenlun(obj, base)
        if bad:
            print("[WARN] shenlun/%s：" % base)
            for b in bad:
                print("       - " + b)
        if obj.get("kind") == "calendar":
            cal = obj.get("items") or []
        else:
            cats.append(obj)
    return cats, cal


def build_shenlun(quiet=False):
    if not os.path.isdir(SL_DIR):
        if not quiet:
            print("[WARN] 没有 shenlun 目录，跳过申论素材库")
        return
    cats, cal = load_shenlun()
    payload = {"v": 1, "cats": cats, "calendar": cal, "updated": ""}
    js = "window.KG_SHENLUN = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    open(SL_OUT, "w", encoding="utf-8", newline="\n").write(js)
    n = sum(len(c.get("items") or []) for c in cats)
    print("OK  申论素材库 %d 个主题 / %d 条素材 / 纪念日节点 %d 条" % (len(cats), n, len(cal)))


""" ---------------- 申论真题套卷（shenlun_paper） ----------------
    数据：kaogong/data/shenlun_paper/shenlun_paper_<id>.json（近5年国考/广东省考申论）
    结构：{id, exam, year, level, title, src, materials:[{no,title,brief}], questions:[{no,type,score,q,ref}]}
    前端：window.KG_PAPER = {v, papers}
"""
PAPER_DIR = os.path.join(DATA, "shenlun_paper")
PAPER_OUT = os.path.join(DATA, "shenlun_paper.js")


def validate_shenlun_paper(obj, base):
    bad = []
    for k in ("id", "title", "exam", "year"):
        if not obj.get(k):
            bad.append("缺 %s" % k)
    if not isinstance(obj.get("questions") or [], list) or not obj.get("questions"):
        bad.append("缺 questions（至少一题）")
    for i, it in enumerate((obj.get("questions") or []), 1):
        if not it.get("q"):
            bad.append("第 %d 题缺 q（题目要求）" % i)
        if not it.get("ref"):
            bad.append("第 %d 题缺 ref（参考要点）" % i)
    for i, it in enumerate((obj.get("materials") or []), 1):
        if not it.get("title"):
            bad.append("材料 %d 缺 title" % i)
    return bad


def load_shenlun_paper():
    papers = []
    for path in sorted(glob.glob(os.path.join(PAPER_DIR, "*.json"))):
        base = os.path.basename(path)
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[FAIL] shenlun_paper/%s 不是合法 JSON: %s" % (base, e))
            continue
        bad = validate_shenlun_paper(obj, base)
        if bad:
            print("[WARN] shenlun_paper/%s：" % base)
            for b in bad:
                print("       - " + b)
        papers.append(obj)
    return papers


def build_shenlun_paper(quiet=False):
    if not os.path.isdir(PAPER_DIR):
        if not quiet:
            print("[WARN] 没有 shenlun_paper 目录，跳过申论真题")
        return
    papers = load_shenlun_paper()
    papers.sort(key=lambda p: (p.get("year") or 0, p.get("id") or ""), reverse=True)
    payload = {"v": 1, "papers": papers}
    js = "window.KG_PAPER = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    open(PAPER_OUT, "w", encoding="utf-8", newline="\n").write(js)
    print("OK  申论真题套卷 %d 套" % len(papers))


def main():
    if "--next" in sys.argv:
        print(next_issue())
        return
    if "--next-batch" in sys.argv:
        batches = load_batches()
        print((max([b.get("batch", 0) for b in batches]) + 1) if batches else 1)
        return
    if "--next-news" in sys.argv:
        print(next_news())
        return
    if "--next-idiom" in sys.argv:
        print(next_idiom())
        return
    if "--next-calc" in sys.argv:
        print(next_calc())
        return
    if "--next-xc" in sys.argv:
        print(next_xc())
        return
    if "--next-lj" in sys.argv:
        print(next_lj())
        return
    if "--next-weekend" in sys.argv:
        print(next_weekend())
        return
    issues = load_all()
    payload = "window.KG_ISSUES = " + json.dumps(issues, ensure_ascii=False, indent=1) + ";\n"
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(payload)
    total_q = sum(len(i.get("items", [])) for i in issues)
    nums = ", ".join(str(i.get("issue")) for i in issues)
    print("OK  共 %d 期 / %d 题" % (len(issues), total_q))
    print("期号：" + (nums or "(空)"))
    print("输出：" + OUT)
    build_vocab()
    build_news()
    build_idioms()
    build_idiomfill()
    build_calc()
    build_xc()
    build_lj()
    build_ljdrill()
    build_figure_pool()
    build_weekend()
    build_phrases()
    build_outline()
    build_bank()
    build_shenlun()
    build_shenlun_paper()
    build_lexicon()
    merge_all_data()


def build_lexicon():
    """把 data/lexicon.json（四六级/考研/托福/SAT 合并去重的预备词库）生成 data/lexicon.js"""
    path = os.path.join(DATA, "lexicon.json")
    if not os.path.exists(path):
        print("WARN 缺少 lexicon.json，跳过预备词库构建")
        return
    rows = json.load(open(path, "r", encoding="utf-8"))
    js = "window.KG_LEXICON = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    with open(os.path.join(DATA, "lexicon.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    print("OK  KG_LEXICON 预备词库 %d 词 %.0f KB" % (len(rows), len(js) / 1024))


def merge_all_data():
    """把 data/ 下所有 window.KG_* 数据文件按加载顺序合并成 data/all.js，
    浏览器只需 1 个请求，避免 17 个脚本串行下载导致长时间白屏。"""
    order = ["issues", "vocab_plan", "vocab", "news", "idioms", "idiomfill",
             "calc", "xc", "lj", "ljdrill", "weekend", "phrases", "drills",
             "outline", "bankq", "shenlun", "shenlun_paper", "lexicon"]
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    parts = []
    for name in order:
        p = os.path.join(data_dir, name + ".js")
        if os.path.exists(p):
            t = open(p, encoding="utf-8").read().strip()
            if t:
                parts.append(t)
    out = "\n".join(parts) + "\n"
    with open(os.path.join(data_dir, "all.js"), "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    print("OK  合并数据 all.js  %.0f KB（%d 个数据文件）" % (len(out) / 1024, len(parts)))


if __name__ == "__main__":
    main()
