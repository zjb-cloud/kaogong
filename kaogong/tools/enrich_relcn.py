# -*- coding: utf-8 -*-
"""
enrich_relcn.py — 为 vocab.js 每个词条的 rel（form/sound/syn）关联词生成中文释义 relCn
----------------------------------------------------------------------------------
- rel 原数组一字不改（红线）；词条新增平行字段 relCn: {"form":[...],"sound":[...],"syn":[...]}，
  与 rel 各数组同位置一一对应，每项为「词性缩写 + 核心义项」（如 "a. 可获得的"、"v. 避免，防止"）。
- 释义来源优先级：MANUAL_DEF（人工表，含数字/中文/缩写等特殊条目）
   > 主词表继承（rel 词与某词条 w 相同，取该词条 cn 的第一个义项）
   > _youdao_cache.json（有道批量抓取缓存，由 tools/_fetch_youdao.py 生成）
   > 混合条目括号内已有释义兜底（如 "science（科学）" → "科学"）
- 同一 rel 词全库多次出现释义一致（全局唯一释义表，天然满足）。
用法：python tools/enrich_relcn.py
"""
from __future__ import print_function
import json, os, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA = os.path.join(ROOT, 'data')

# ---- 人工表：特殊条目（数字/中文/缩写/API 抓不到的高置信词），宁缺毋滥 ----
MANUAL_DEF = {
    '30': 'num. 三十',
    '50': 'num. 五十',
    '8月': 'n. 八月',
    'UK': 'n. 英国',
    'Down Under': 'n. 澳洲（澳大利亚的俗称）',
    'Dec.': 'n. 十二月（缩写）',
    'Oct.': 'n. 十月（缩写）',
    'Sept.': 'n. 九月（缩写）',
    'December': 'n. 十二月',
    'September': 'n. 九月',
    'England': 'n. 英格兰；英国',
    'Hellenic': 'a. 希腊的',
    'Grecian': 'a. 希腊的；希腊式的',
    'Austria': 'n. 奥地利',
    'Euro': 'n. 欧元',
    'half a hundred': 'num. 五十',
    'three tens': 'num. 三十',
    'summer month': 'n. 夏季的月份',
    'obtober 无此词': '（拼写错误，应为 October）',
}

def extract_english(entry):
    """从 rel 条目提取英文部分（去括号注释/中文/数字/词性前缀）；纯中文/数字返回 None"""
    t = entry.strip()
    t = re.sub(r'[（(【\[].*?[）)】\]]', '', t)
    t = re.sub(r'[\u4e00-\u9fff]+', '', t)
    t = t.strip(' .、，,;；:：-—_·')
    t = re.sub(r'\s+', ' ', t)
    if not t or not re.search(r'[A-Za-z]', t): return None
    # 去掉 "word n.释义" 中的词性前缀（保留纯词或短语）
    t = re.sub(r'^(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s*$', '', t)
    t = re.sub(r'^(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s+(?=[A-Za-z])', '', t)
    t = t.strip()
    return t or None

def inline_cn(entry):
    """从「词 + 释义」空格混合条目提取已有释义（如 'fabric n.织物' → 'n.织物'、'American 美国的' → '美国的'）"""
    t = entry.strip()
    m = re.search(r'\b(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s*([\u4e00-\u9fff][^，,；;]*)', t)
    if m:
        return (m.group(1) + '. ' + m.group(2)).strip()
    m = re.search(r'[\u4e00-\u9fff][^，,；;]*', t)
    if m: return m.group(0).strip()
    return None

def bracket_cn(entry):
    """取混合条目括号内的中文释义（兜底用），如 'science（科学）' → '科学'"""
    m = re.search(r'[（(【\[](.*?)[）)】\]]', entry)
    if not m: return None
    c = m.group(1).strip()
    if not re.search(r'[\u4e00-\u9fff]', c): return None
    c = re.sub(r'\s+', ' ', c)
    return c[:50]

def load_words():
    s = open(os.path.join(DATA, 'vocab.js'), encoding='utf-8').read()
    return json.JSONDecoder().raw_decode(s[s.index('['):])[0]

def build_def_table(data):
    """全局释义表：lower(word) -> 释义字符串"""
    table = {k.lower(): v for k, v in MANUAL_DEF.items()}
    # 主词继承：取 cn 第一个义项（如 "a. 可获得的；可用的；通用的" → "a. 可获得的"）
    for b in data:
        for w in b.get('words', []):
            cn = w.get('cn', '')
            core = re.split(r'[；;]', cn)[0].strip() if cn else ''
            if core and re.match(r'^[a-z]+\.\s', core):
                table.setdefault(w['w'].lower(), core)
    # 有道缓存
    cp = os.path.join(DATA, '_youdao_cache.json')
    if os.path.exists(cp):
        cache = json.load(open(cp, encoding='utf-8'))
        for k, v in cache.items():
            if v and k not in table:
                table[k] = v[0]
    return table

def main():
    data = load_words()
    table = build_def_table(data)
    # 先统计全库唯一 rel 条目
    entries = {}
    for b in data:
        for w in b.get('words', []):
            for k in ('form', 'sound', 'syn'):
                for x in w.get('rel', {}).get(k, []):
                    entries.setdefault(x, None)
    # 逐词条生成 relCn
    missing = {}
    total_cn = 0
    for b in data:
        for w in b.get('words', []):
            rel = w.get('rel', {})
            if not isinstance(rel, dict): continue
            relcn = {}
            for k in ('form', 'sound', 'syn'):
                arr = rel.get(k, [])
                out = []
                for x in arr:
                    x = x.strip()
                    defn = table.get(x.lower())
                    if defn is None:
                        e = extract_english(x)
                        if e: defn = table.get(e.lower())
                    if defn is None:
                        defn = bracket_cn(x)          # 括号内中文兜底
                    if defn is None:
                        defn = inline_cn(x)           # 「词+释义」空格混合条目兜底
                    if defn is None:
                        defn = x                       # 最后兜底：原样（保持非空）
                        missing.setdefault(x, 0)
                        missing[x] += 1
                    out.append(defn)
                    total_cn += 1
                if out: relcn[k] = out
            if relcn: w['relCn'] = relcn
    # 写回（紧凑格式，与原文件同构）
    out = 'window.KG_VOCAB = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    if open(os.path.join(DATA, 'vocab.js'), encoding='utf-8').read().endswith('\n'):
        out += '\n'
    open(os.path.join(DATA, 'vocab.js'), 'w', encoding='utf-8').write(out)
    print('OK 写入完成：relCn 共 %d 条' % total_cn)
    if missing:
        print('WARN 无释义兜底条目 %d 个:' % len(missing))
        for k, v in sorted(missing.items(), key=lambda x: -x[1])[:40]:
            print('  %s ×%d' % (repr(k), v))

if __name__ == '__main__':
    main()
