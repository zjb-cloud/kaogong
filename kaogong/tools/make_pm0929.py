# -*- coding: utf-8 -*-
"""生成 2026-09-29 晚间：考公第 6 期 + 词语速记第 5 期（正向 + 反向填空）"""
import io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from _pm_spec import SPEC          # noqa
from _pm_issue import ISSUE        # noqa

D = os.path.join(HERE, '..', 'data')
POS = [1, 2, 0, 3, 2, 1, 3, 0, 2, 3]      # 正确项落位（正/反两份一致）
DATE = "2026-09-29"
SET = 5
LET = "ABCD"


def wj(name, obj):
    p = os.path.join(D, name)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(obj, ensure_ascii=False, indent=1) + "\n")
    print("WROTE %s (%d bytes)" % (name, os.path.getsize(p)))


def build_idiom():
    items = []
    for i, s in enumerate(SPEC):
        p = POS[i]
        confs = s["conf"]
        means = [s["mean"]] + [c[1] for c in confs]
        opts = [None] * 4
        opts[p] = means[0]
        j = 1
        for k in range(4):
            if k != p:
                opts[k] = means[j]
                j += 1
        cmp_ = []
        for k in range(4):
            if k == p:
                cmp_.append({"self": True})
            else:
                for c in confs:
                    if c[1] == opts[k]:
                        cmp_.append({"w": c[0], "eg": c[2]})
                        break
                else:
                    raise SystemExit("cmp 未匹配：%s / %s" % (s["w"], opts[k]))
        items.append({"w": s["w"], "py": s["py"], "kind": "成语", "mean": s["mean"],
                      "options": opts, "answer": [LET[p]], "eg": s["eg"],
                      "egFrom": s["egFrom"], "src": s["src"], "tip": s["tip"],
                      "recap": s["recap"], "cmp": cmp_})
    return {"set": SET, "date": DATE, "session": "pm",
            "title": "晚间轮 · 10 个成语·四字词语", "items": items}


def build_fill():
    items = []
    for i, s in enumerate(SPEC):
        p = POS[i]
        words = [s["w"]] + [c[0] for c in s["conf"]]
        opts = [None] * 4
        opts[p] = words[0]
        j = 1
        for k in range(4):
            if k != p:
                opts[k] = words[j]
                j += 1
        cmp_ = []
        for k in range(4):
            if k == p:
                cmp_.append({"self": True})
            else:
                for c in s["conf"]:
                    if c[0] == opts[k]:
                        cmp_.append({"w": c[0], "mean": c[1], "why": c[3], "eg": c[2]})
                        break
                else:
                    raise SystemExit("fill cmp 未匹配：%s / %s" % (s["w"], opts[k]))
        items.append({"w": s["w"], "sent": s["sent"], "mean": s["mean"], "eg": s["eg"],
                      "tip": s["tip"], "options": opts, "answer": [LET[p]], "cmp": cmp_})
    return {"set": SET, "date": DATE, "session": "pm",
            "title": "晚间轮 · 填空选词 10 题", "items": items}


if __name__ == "__main__":
    wj("issue-006.json", ISSUE)
    i1 = build_idiom()
    i2 = build_fill()
    # 自检：答案落位一致、唯一答案（把每个干扰词代回句子人工已核，这里做机械校验）
    for a, b in zip(i1["items"], i2["items"]):
        assert a["answer"] == b["answer"], a["w"]
        ai = "ABCD".index(a["answer"][0])
        assert a["options"][ai] == a["mean"], a["w"]          # 正向：答案指向正确释义
        assert b["options"][ai] == b["w"] == a["w"], a["w"]   # 反向：答案指向正确词语
        assert a["cmp"][ai].get("self") and b["cmp"][ai].get("self")
        assert b["sent"].count("____") == 1
        for k in range(4):
            if k != ai:
                assert "w" in a["cmp"][k] and "w" in b["cmp"][k]
                assert b["cmp"][k].get("why") and b["cmp"][k].get("mean")
                assert b["cmp"][k]["w"] == b["options"][k]
    wj("idiom-005.json", i1)
    wj("idiomfill-005.json", i2)
    print("OK issue=6 idiom=5 fill=5")
