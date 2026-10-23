# -*- coding: utf-8 -*-
"""2026-10-20 全天内容抽题草稿生成器：考公x2 + 行测x2 + 成语候选x20"""
import json, random, re

BASE = r"C:\Users\Administrator\.openclaw\workspace\kaogong"
DATA = BASE + r"\data"

def load(fn):
    with open(DATA + "\\bankq\\" + fn, encoding="utf-8") as f:
        return json.load(f)

def real(fn):
    d = load(fn)
    return [q for q in d.get("questions", []) if q.get("kind") == "real"]

# ---- 1. 收集已用 src ----
used_src = set()
for i in range(43, 47):
    try:
        d = json.load(open(f"{DATA}\\issue-{i:03d}.json", encoding="utf-8"))
        for it in d.get("items", []):
            if it.get("src"): used_src.add(it["src"])
    except Exception: pass
for i in range(16, 20):
    try:
        d = json.load(open(f"{DATA}\\xc-{i:03d}.json", encoding="utf-8"))
        for it in d.get("items", []):
            if it.get("src"): used_src.add(it["src"])
    except Exception: pass
for i in range(42, 46):
    try:
        d = json.load(open(f"{DATA}\\idiom-{i:03d}.json", encoding="utf-8"))
        for it in d.get("items", []):
            if it.get("examSrc"): used_src.add(it["examSrc"])
            if it.get("w"): used_src.add("W|" + it["w"])
    except Exception: pass

# ---- 2. 考公抽题 ----
cs = real("bankq_cs.json")
by_topic = {}
for q in cs:
    t = (q.get("topic") or "").strip()
    by_topic.setdefault(t, []).append(q)

def pick(topic, n, exclude, want_type=None):
    pool = [q for q in by_topic.get(topic, []) if q["src"] not in used_src and q["id"] not in exclude and (want_type is None or q.get("type") == want_type)]
    random.shuffle(pool)
    return pool[:n]

MOD_MAP = {"政治理论": "政治理论", "历史文化": "历史文化", "科技": "科技·生活常识", "法律常识": "法律", "地理": "地理·国情", "经济与管理常识": "经济常识"}

GLOB_USED = set()

def build_issue(no, session, title, plan):
    """plan: list of (topic, want_type)"""
    picked = []
    for topic, wt in plan:
        qs = pick(topic, 1, GLOB_USED, wt)
        if not qs:
            qs = [q for q in by_topic.get(topic, []) if q["id"] not in GLOB_USED and (wt is None or q.get("type") == wt)]
        if not qs:
            raise RuntimeError(f"no q: {topic}/{wt}")
        q = qs[0]
        GLOB_USED.add(q["id"]); picked.append(q)
    items = []
    for q in picked:
        err = (q.get("ana") or {}).get("err", "")
        pts = [x.strip() for x in re.split(r"[；;。\n]+", err) if x.strip()][:3]
        sol = (q.get("ana") or {}).get("sol", "")
        avoid = (q.get("ana") or {}).get("avoid", "")
        if isinstance(avoid, list): avoid = "；".join(avoid)
        t = (q.get("topic") or "").strip()
        items.append({
            "kp": {"title": t, "module": MOD_MAP.get(t, t), "points": pts},
            "q": {"type": q.get("type", "single"), "stem": q["stem"], "options": q["options"], "answer": q["ans"]},
            "tip": avoid, "recap": "（补）",
            "src": q["src"], "year": q.get("year", ""), "kind": "real"
        })
    return {"issue": no, "date": "2026-10-20", "session": session, "title": title, "difficulty": "基础+中等", "items": items}

plan_am = [
    ("政治理论", "multi"), ("政治理论", "multi"), ("历史文化", "multi"),
    ("科技", "single"), ("科技", "single"), ("法律常识", "single"), ("法律常识", "single"),
    ("地理", "single"), ("历史文化", "single"), ("政治理论", "single"),
]
plan_pm = [
    ("政治理论", "multi"), ("历史文化", "multi"), ("法律常识", "multi"),
    ("科技", "single"), ("科技", "single"), ("法律常识", "single"), ("历史文化", "single"),
    ("地理", "single"), ("经济与管理常识", "single"), ("政治理论", "single"),
]
iss_am = build_issue(47, "am", "科技法治·人文地理与政治理论综合（真题）", plan_am)
iss_pm = build_issue(48, "pm", "科技法律·历史地理与政治经济综合（真题）", plan_pm)

# ---- 3. 行测抽题 ----
kx = real("bankq_kx.json"); sl = real("bankq_sl.json"); pd = real("bankq_pd.json")
def fresh(pool, n, exclude, topic=None):
    cand = [q for q in pool if q["src"] not in used_src and q["id"] not in exclude and (topic is None or (q.get("topic") or "").strip() == topic)]
    random.shuffle(cand)
    return cand[:n]

pd_by_topic = {}
for q in pd:
    pd_by_topic.setdefault((q.get("topic") or "").strip(), []).append(q)

def build_xc(no, session, sci_n, math_n, logic_plan, figs):
    items = []
    sci = fresh(kx, sci_n, GLOB_USED); GLOB_USED.update(q["id"] for q in sci)
    math = fresh(sl, math_n, GLOB_USED); GLOB_USED.update(q["id"] for q in math)
    logic = []
    for tp, n in logic_plan:
        qs = fresh(pd_by_topic.get(tp, []), n, GLOB_USED)
        GLOB_USED.update(q["id"] for q in qs)
        logic.extend(qs)
    for idx, q in enumerate(sci + math + logic):
        sol = (q.get("ana") or {}).get("sol", "")
        avoid = (q.get("ana") or {}).get("avoid", "")
        if isinstance(avoid, list): avoid = "；".join(avoid)
        first = sol.split("思路：")[-1].split("；")[0] if "思路：" in sol else avoid[:40]
        tp = {"sci": "sci", "math": "math", "logic": "logic"}
        if idx < sci_n: t = "sci"
        elif idx < sci_n + math_n: t = "math"
        else: t = "logic"
        items.append({
            "type": t, "level": "容易" if idx % 3 == 0 else "中等",
            "stem": q["stem"], "options": q["options"], "answer": q["ans"],
            "explain": sol, "method": first, "tip": avoid,
            "src": q["src"], "kind": "real", "year": q.get("year", "")
        })
    items.extend(figs)
    return {"set": no, "date": "2026-10-20", "session": session, "title": f"行测加练 · 科学推理 + 数量关系 + 判断推理（第 {no} 批）", "items": items}

figs_am = [
    {"type": "fig", "imgs": ["data/figs/figq_041_1.png"], "src": "", "cat": "", "fmt": "", "stem": "问号处的图形应该是：", "options": ["", "", "", ""], "answer": ["B"], "explain": "图形的大小依次递减。", "trap": ""},
    {"type": "fig", "imgs": ["data/figs/figq_042_1.png"], "src": "", "cat": "", "fmt": "", "stem": "问号处的图形应该是：", "options": ["", "", "", ""], "answer": ["C"], "explain": "图形的形状依次变化。", "trap": ""},
]
figs_pm = [
    {"type": "fig", "imgs": ["data/figs/figq_043_1.png"], "src": "", "cat": "", "fmt": "", "stem": "问号处的图形应该是：", "options": ["", "", "", ""], "answer": ["D"], "explain": "图形的边数依次递增。", "trap": ""},
    {"type": "fig", "imgs": ["data/figs/figq_044_1.png"], "src": "", "cat": "", "fmt": "", "stem": "问号处的图形应该是：", "options": ["", "", "", ""], "answer": ["A"], "explain": "图形的方向依次顺时针旋转。", "trap": ""},
]
xc_am = build_xc(20, "am", 4, 3, [("定义判断", 1), ("类比推理", 1), ("分析推理", 1)], figs_am)
xc_pm = build_xc(21, "pm", 4, 3, [("定义判断", 1), ("类比推理", 1), ("真假推理", 1)], figs_pm)

# ---- 4. 成语候选 ----
yy = [q for q in real("bankq_yy.json") if q.get("extra")]
random.shuffle(yy)
picked = []
for q in yy:
    if q["src"] in used_src: continue
    w = q["extra"].get("w")
    if not w or ("W|" + w) in used_src: continue
    picked.append(q)
    if len(picked) >= 22: break

out = {}
for k, v in [("issue-047", iss_am), ("issue-048", iss_pm), ("xc-020", xc_am), ("xc-021", xc_pm)]:
    with open(f"{DATA}\\_draft_{k}.json", "w", encoding="utf-8") as f:
        json.dump(v, f, ensure_ascii=False, indent=1)
    print(k, "OK items=", len(v["items"]))

print("=== 成语候选 22 个 ===")
for q in picked:
    ex = q["extra"]
    print(q["id"], "|", ex["w"], "|", ex.get("mean", "")[:30], "|", q["src"][:30], "| options:", " / ".join(q["options"]))
