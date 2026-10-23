# -*- coding: utf-8 -*-
"""
生成四级「精简 2000 词」背诵清单。
排序依据：英语真实词频（en_50k 为主，google-10000 为辅），跳过最高频的 2200 个（已会的基础词），
从四级大纲词里取接下来的 2000 个 → 就是「四级核心 2000」。

输出：kaogong/data/vocab-plan.json  →  [{n, w, ph, cn}, ...]（n = 1..2000 的背诵顺序）

数据来源（已下载到 kaogong/vocab_src/）：
  cet4_4165.txt  : 四级大纲单词表（音标 + 词性 + 中文释义）
  en_50k.txt     : 英语词频表（subtitle 语料，5 万词）
  freq10000.txt  : google-10000 词频表（补充）
"""
import json
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "vocab_src")
DATA = os.path.join(BASE, "data")
OUT = os.path.join(DATA, "vocab-plan.json")

TARGET = 2000        # 只要 2000 个
EXCLUDE_TOP = 2200   # 跳过最高频的 2200 个基础词
MIN_LEN = 5          # 太短的基本是小学词，剔掉
DAYS = 40            # 每天 50 词，2026-09-27 ~ 2026-11-05

STOP = set("""a an the i you he she it we they me him her us them my your his its our their
this that these those am is are was were be been being do does did done have has had having
will would shall should can could may might must and or but if so because as of in on at to for
with from by about into over after before under above between during without within up down out
off again very too also not no yes here there where when what which who whom whose how why
one two three four five six seven eight nine ten first second third mr mrs ms sir ok""".split())

BLOCK = set("negro nigger whore damn hell crap negroes".split())


def parse_cet4(path):
    out = {}
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or len(line) > 200:
                continue
            m = re.match(r"^([A-Za-z][A-Za-z'\-\.]{1,24})\s*(?:\[([^\]]+)\])?\s*(.+)$", line)
            if not m:
                continue
            w = m.group(1).lower().strip(".")
            ph = (m.group(2) or "").strip()
            cn = m.group(3).strip()
            if not cn or w in out:
                continue
            out[w] = {"ph": ph, "cn": cn}
    return out


def parse_rank(path, first_token=True):
    order = {}
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            w = (line.split()[0] if first_token else line).strip().lower()
            if w and w not in order:
                order[w] = i
    return order


def build():
    cet = parse_cet4(os.path.join(SRC, "cet4_4165.txt"))
    f50 = parse_rank(os.path.join(SRC, "en_50k.txt"))
    f10 = parse_rank(os.path.join(SRC, "freq10000.txt"))

    cand = []
    for w, v in cet.items():
        if w in STOP or w in BLOCK or len(w) < MIN_LEN:
            continue
        if "'" in w or "." in w:
            continue
        if w in f50:
            r = f50[w]
        elif w in f10:
            r = 50000 + f10[w]
        else:
            r = 999999
        cand.append((r, w, v))
    cand.sort(key=lambda x: (x[0], x[1]))

    picked = [c for c in cand if c[0] >= EXCLUDE_TOP][:TARGET]
    rows = [{"n": i, "w": w, "ph": v["ph"], "cn": v["cn"]} for i, (r, w, v) in enumerate(picked, 1)]
    return rows, len(cet), len(cand)


def main():
    rows, n_cet, n_pool = build()
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(rows, f, ensure_ascii=False, indent=0)
    per_day = TARGET / float(DAYS)
    print("OK  词库 %d 个 / 可用 %d 个，取出 %d 个" % (n_cet, n_pool, len(rows)))
    print("前 10：" + ", ".join(r["w"] for r in rows[:10]))
    print("末 10：" + ", ".join(r["w"] for r in rows[-10:]))
    print("排期：%d 词 / %d 天 = 每天 %.0f 词 + 每天 1 篇精读" % (TARGET, DAYS, per_day))
    print("输出：" + OUT)


if __name__ == "__main__":
    main()
