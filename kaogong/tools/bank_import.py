# -*- coding: utf-8 -*-
"""
把现有题库池一次性转换到「静态全量真题题库」统一 schema（data/bankq/*.json）。
来源：
  issue-*.json      常识判断（cs）        ~420 题
  idiomfill-*.json  言语·选词填空（yy）   ~380 题
  xc-*.json         行测（sl/kx/pd）      ~174 题
  ljdrill.json      判断推理·逻辑（pd）   ~1696 题
  figure_pool.json  判断推理·图形（pd）   ~76 题
统一题结构：
  {"id","mod","topic","src","year","type","stem","options","ans",
   "ana":{"err","sol","avoid"},"extra"?,"fig"?}
用法：
  python kaogong\\tools\\bank_import.py      # 全量重建 bankq（幂等，重跑覆盖）
"""
import glob
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)          # kaogong/
DATA = os.path.join(ROOT, "data")
OUT_DIR = os.path.join(DATA, "bankq")

MODS = [  # 顺序即前端展示顺序
    ("cs", "常识判断"),
    ("yy", "言语理解"),
    ("sl", "数量关系"),
    ("pd", "判断推理"),
    ("kx", "科学推理"),
]


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _yr(src):
    m = re.search(r"(20\d{2})", str(src or ""))
    return m.group(1) if m else ""


def _mk(mod, topic, src, stem, options, ans, err, sol, avoid, extra=None, fig=None, qtype="single"):
    return {
        "id": "", "mod": mod, "topic": topic, "src": _norm(src), "year": _yr(src),
        "type": qtype, "stem": _norm(stem), "options": [_norm(o) for o in options],
        "ans": list(ans), "ana": {"err": _norm(err), "sol": _norm(sol), "avoid": _norm(avoid)},
    } | ({"extra": extra} if extra else {}) | ({"fig": fig} if fig else {})


def build_cs():
    """常识判断：issue-*.json 每期 10 题，topic 取 kp.module 的第一段"""
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "issue-*.json"))):
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[WARN] %s 跳过: %s" % (os.path.basename(path), e))
            continue
        iss = obj.get("issue")
        for it in obj.get("items") or []:
            q = it.get("q") or {}
            if not q.get("stem") or not q.get("options"):
                continue
            kp = it.get("kp") or {}
            topic = (kp.get("module") or "常识").split("·")[0]
            recap = _norm(it.get("recap"))
            tip = _norm(it.get("tip"))
            err = ("易错点：知识点混淆或记忆不准" + ("；记忆要点：" + recap if recap else ""))
            sol = _norm(q.get("explain")) or "（解析缺失）"
            avoid = tip or "审题看清题干限定词，再对照选项逐项排除"
            out.append(_mk("cs", topic,
                           "每日政治常识·第%d期" % iss,
                           q["stem"], q["options"], q.get("answer") or [],
                           err, sol, avoid,
                           qtype=("multi" if q.get("type") == "multi" else "single")))
    return out


def build_yy():
    """言语理解·选词填空（成语）：idiomfill-*.json，自带词义/易混辨析"""
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "idiomfill-*.json"))):
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[WARN] %s 跳过: %s" % (os.path.basename(path), e))
            continue
        s = obj.get("set")
        for it in obj.get("items") or []:
            if not it.get("sent") or not it.get("options"):
                continue
            w = it.get("w") or ""
            cmps = []
            for c in it.get("cmp") or []:
                if not isinstance(c, dict) or c.get("self"):
                    continue
                cmps.append({"w": c.get("w", ""), "mean": _norm(c.get("mean")),
                             "why": _norm(c.get("why")), "eg": _norm(c.get("eg"))})
            err = "对「%s」的词义或语境色彩把握不准，选词时只看字面、忽略上下文提示" % w
            sol = "词义：%s。语境提示：%s。正确句：%s" % (
                _norm(it.get("mean")), _norm(it.get("tip")), _norm(it.get("eg")))
            avoid = "；".join("「%s」%s（%s）" % (c["w"], c["mean"], c["why"]) for c in cmps) or "注意词语感情色彩与搭配对象"
            extra = {"w": w, "mean": _norm(it.get("mean")), "cmp": cmps}
            out.append(_mk("yy", "选词填空·成语", "词语速记填空·第%d期" % s,
                           it["sent"], it["options"], it.get("answer") or [],
                           err, sol, avoid, extra=extra))
    return out


def build_xc():
    """行测加练：sci→kx、math→sl、logic→pd、fig→pd(图形推理)"""
    out = []
    for path in sorted(glob.glob(os.path.join(DATA, "xc-*.json"))):
        try:
            obj = json.load(open(path, "r", encoding="utf-8"))
        except Exception as e:
            print("[WARN] %s 跳过: %s" % (os.path.basename(path), e))
            continue
        s = obj.get("set")
        for it in obj.get("items") or []:
            t = it.get("type")
            if t == "sci":
                mod, topic = "kx", "科学推理"
            elif t == "math":
                mod, topic = "sl", "数量关系"
            elif t == "fig":
                mod, topic = "pd", "图形推理"
            else:
                mod, topic = "pd", "判断推理综合"
            err = "易错点：" + (_norm(it.get("tip")) or "概念混淆或计算粗心")
            sol = (_norm(it.get("method")) and "思路：" + _norm(it.get("method")) + "。详解：" + _norm(it.get("explain")) or _norm(it.get("explain")))
            avoid = _norm(it.get("tip")) or "先明确题型对应的公式/方法，再代入计算"
            fig = None
            if t == "fig":
                imgs = it.get("imgs") or []
                fig = {"imgs": imgs, "desc": ""}
            out.append(_mk(mod, topic, "行测加练·第%d批" % s,
                           it.get("stem"), it.get("options") or [], it.get("answer") or [],
                           err, sol, avoid, fig=fig))
    return out


def build_pd_lj():
    """判断推理·逻辑判断真题池：ljdrill.json（含 point/method/tip 三段）"""
    out = []
    path = os.path.join(DATA, "ljdrill.json")
    if not os.path.exists(path):
        return out
    try:
        obj = json.load(open(path, "r", encoding="utf-8"))
    except Exception as e:
        print("[WARN] ljdrill.json 读取失败: %s" % e)
        return out
    for st in obj.get("sets") or []:
        for it in st.get("items") or []:
            if not it.get("stem") or not it.get("options"):
                continue
            out.append(_mk("pd", it.get("type") or "逻辑判断", it.get("from") or "",
                           it["stem"], it["options"], it.get("answer") or [],
                           _norm(it.get("point")) or "考点理解不到位",
                           _norm(it.get("explain")) or _norm(it.get("method")),
                           _norm(it.get("tip")) or "注意推理规则的正逆应用"))
    return out


def build_pd_fig():
    """判断推理·图形推理真题池：figure_pool.json（图片 + 文字兜底 desc 待补）"""
    out = []
    path = os.path.join(DATA, "figure_pool.json")
    if not os.path.exists(path):
        return out
    try:
        obj = json.load(open(path, "r", encoding="utf-8"))
    except Exception as e:
        print("[WARN] figure_pool.json 读取失败: %s" % e)
        return out
    for it in obj.get("items") or []:
        nopt = int(it.get("nopt") or 4)
        opts = ["图 " + c for c in "ABCDEFGH"[:nopt]]
        out.append(_mk("pd", "图形推理", it.get("from") or it.get("src") or "",
                       it.get("stem") or "选择最合适的图形：", opts, [it.get("ans") or ""],
                       "图形规律识别偏差：未先锁定观察维度（数量/位置/样式/属性）",
                       _norm(it.get("exp")) or "（解析缺失）",
                       it.get("trap") or "先定维度：数量、位置、样式、属性，验证规律后再选",
                       fig={"imgs": it.get("imgs") or [], "desc": it.get("desc") or ""}))
    return out


def write_shards():
    builders = {
        "cs": ("常识判断", build_cs()),
        "yy": ("言语理解", build_yy()),
        "sl": ("数量关系", [q for q in build_xc() if q["mod"] == "sl"]),
        "pd": ("判断推理", build_pd_lj() + [q for q in build_xc() if q["mod"] == "pd" and q["topic"] != "图形推理"] + build_pd_fig()),
        "kx": ("科学推理", [q for q in build_xc() if q["mod"] == "kx"]),
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for mod, name in MODS:
        qs = builders[mod][1]
        # 统一分配 id：mod_6位序号
        topics = {}
        for i, q in enumerate(qs, 1):
            q["id"] = "%s_%06d" % (mod, i)
            topics[q["topic"]] = topics.get(q["topic"], 0) + 1
        tlist = [{"name": k, "n": v} for k, v in sorted(topics.items(), key=lambda kv: (-kv[1], kv[0]))]
        shard = {"v": 1, "mod": mod, "name": name, "topics": tlist, "questions": qs}
        with open(os.path.join(OUT_DIR, "bankq_%s.json" % mod), "w", encoding="utf-8", newline="\n") as f:
            json.dump(shard, f, ensure_ascii=False, indent=1)
        total += len(qs)
        print("OK  bankq_%s.json  %s  %d 题 / %d 个考点" % (mod, name, len(qs), len(tlist)))
    print("合计 %d 题 → %s" % (total, OUT_DIR))


if __name__ == "__main__":
    write_shards()
