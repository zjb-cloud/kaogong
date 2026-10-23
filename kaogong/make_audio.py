# -*- coding: utf-8 -*-
"""把某期新闻精读合成为「播音腔」MP3（用微软 Edge 在线朗读引擎，免费、无需密钥）。

用法：
  python make_audio.py --id 1                 # 生成默认两位主播（云扬·男 / 晓晓·女）
  python make_audio.py --id 1 --voices yunyang
  python make_audio.py --next                 # 自动找最新一期
  python make_audio.py --prune 8              # 只保留最近 8 期的音频文件

生成：audio/news-<id>-<key>.mp3，并写回 data/news-<id>.json 的 audio 字段：
  {"v":[{"k":"yunyang","n":"云扬·新闻男声","src":"audio/news-1-yunyang.mp3","sec":233}, ...]}
之后跑 build_data.py 会把它合并进 data/news.js。
"""
import argparse
import asyncio
import glob
import json
import os
import re
import sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
AUDIO = os.path.join(HERE, "audio")

VOICES = {
    "yunyang": ("zh-CN-YunyangNeural", "云扬·新闻男声", "+8%"),
    "xiaoxiao": ("zh-CN-XiaoxiaoNeural", "晓晓·新闻女声", "+8%"),
    "yunjian": ("zh-CN-YunjianNeural", "云健·浑厚男声", "+5%"),
    "yunxi": ("zh-CN-YunxiNeural", "云希·青年男声", "+5%"),
}
DEFAULT_VOICES = ["yunyang", "xiaoxiao"]
BPS = 6000.0  # Azure mp3 24kHz/48kbps 单声道 ≈ 6000 字节/秒


def news_doc(nid):
    return os.path.join(DATA, "news-%03d.json" % nid)


def load_doc(nid):
    p = news_doc(nid)
    if not os.path.exists(p):
        raise SystemExit("找不到 " + p)
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


def script_of(doc):
    """把一期新闻拼成朗读稿：开场 + 每条(栏目+标题+正文+为什么重要) + 收尾"""
    strips = []
    strips.append("第 %s 期，%s，%s新闻精读。%s" % (
        doc.get("id", ""), doc.get("date", ""),
        "晚间" if doc.get("slot") == "pm" else "早间",
        (doc.get("brief") or "").rstrip("。") + "。"))
    for i, n in enumerate(doc.get("news", []) or [], 1):
        s = "第 %d 条。" % i
        if n.get("cat"):
            s += "%s，" % n["cat"]
        s += (n.get("h") or "").rstrip("。") + "。"
        s += (n.get("p") or "").rstrip("。") + "。"
        if n.get("why"):
            s += "为什么重要：" + n["why"].rstrip("。") + "。"
        strips.append(s)
    strips.append("以上就是本期精读。申论金句在下面，记两句就够本。")
    return "\n".join(strips)


async def synth(text, voice, rate):
    c = edge_tts.Communicate(text, voice, rate=rate)
    data = b""
    async for ch in c.stream():
        if ch.get("type") == "audio":
            data += ch["data"]
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", type=int, default=0)
    ap.add_argument("--next", action="store_true")
    ap.add_argument("--voices", default=",".join(DEFAULT_VOICES))
    ap.add_argument("--prune", type=int, default=0)
    a = ap.parse_args()

    if a.prune:
        files = sorted(glob.glob(os.path.join(AUDIO, "news-*.mp3")))
        keep = set()
        ids = sorted(set(int(re.search(r"news-(\d+)", os.path.basename(f)).group(1)) for f in files))
        for i in ids[-a.prune:]:
            for f in files:
                if re.search(r"news-%d-" % i, os.path.basename(f)):
                    keep.add(f)
        gone = 0
        for f in files:
            if f not in keep:
                os.remove(f)
                gone += 1
        print("prune 保留最近 %d 期，删除 %d 个文件" % (a.prune, gone))
        return

    nid = a.id
    if a.next or not nid:
        ids = [int(re.search(r"news-(\d+)\.json$", os.path.basename(p)).group(1))
               for p in glob.glob(os.path.join(DATA, "news-*.json"))]
        nid = max(ids)
    path, doc = load_doc(nid)
    text = script_of(doc)
    chars = len(re.sub(r"\s", "", text))
    os.makedirs(AUDIO, exist_ok=True)
    rows = []
    for key in [k.strip() for k in a.voices.split(",") if k.strip()]:
        if key not in VOICES:
            print("跳过未知音色 " + key)
            continue
        short, label, rate = VOICES[key]
        data = asyncio.run(synth(text, short, rate))
        fn = "news-%d-%s.mp3" % (nid, key)
        with open(os.path.join(AUDIO, fn), "wb") as f:
            f.write(data)
        rows.append({"k": key, "n": label, "src": "audio/" + fn,
                     "sec": int(round(len(data) / BPS))})
        print("%-9s %6.1f KB  ≈ %d 秒 → %s" % (key, len(data) / 1024.0, rows[-1]["sec"], fn))
    doc["audio"] = {"v": rows, "chars": chars}
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print("已写回 %s（%s 字，%d 个音色）" % (os.path.basename(path), chars, len(rows)))


if __name__ == "__main__":
    main()
