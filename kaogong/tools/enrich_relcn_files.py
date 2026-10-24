# -*- coding: utf-8 -*-
"""
enrich_relcn_files.py — 为每期 vocab-NNN.json 源文件的 rel（form/sound/syn）关联词生成中文释义 relCn
----------------------------------------------------------------------------------
- 与 enrich_relcn.py（作用于合并后 vocab.js）逻辑一致，但直接处理**各期源文件**：
  build_data.py 每次由 vocab-NNN.json 重建 vocab.js，源文件带 relCn 后构建产物自然带上，
  不再因重建丢失。
- 红线：rel 原数组一字不改；w/ph/cn/eg/egCn/forms 等字段不动；仅新增 relCn 平行字段。
- 释义来源优先级：MANUAL_DEF（人工表）> 主词表继承（全期词头 cn 第一义项）
  > _youdao_cache.json（有道缓存）> 括号内已有释义 > 混合条目内联释义。
- 同一 rel 词全库多次出现释义一致（全局唯一释义表）。
- 幂等：重复运行结果一致（按全局表重建）。
用法：python tools/enrich_relcn_files.py
"""
from __future__ import print_function
import json, os, re, sys, io, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA = os.path.join(ROOT, 'data')

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
    'Asian': 'a. 亚洲的；n. 亚洲人',
    'sixness': 'n. 六（与 sickness 音近的构词游戏词，非正式词典词）',
}

def extract_english(entry):
    t = entry.strip()
    t = re.sub(r'[（(【\[].*?[）)】\]]', '', t)
    t = re.sub(r'[\u4e00-\u9fff]+', '', t)
    t = t.strip(' .、，,;；:：-—_·')
    t = re.sub(r'\s+', ' ', t)
    if not t or not re.search(r'[A-Za-z]', t): return None
    t = re.sub(r'^(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s*$', '', t)
    t = re.sub(r'^(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s+(?=[A-Za-z])', '', t)
    t = t.strip()
    return t or None

def inline_cn(entry):
    t = entry.strip()
    m = re.search(r'\b(n|v|vt|vi|a|ad|prep|conj|num|pron|int|art|aux|det|abbr)\.\s*([\u4e00-\u9fff][^，,；;]*)', t)
    if m:
        return (m.group(1) + '. ' + m.group(2)).strip()
    m = re.search(r'[\u4e00-\u9fff][^，,；;]*', t)
    if m: return m.group(0).strip()
    return None

def bracket_cn(entry):
    m = re.search(r'[（(【\[](.*?)[）)】\]]', entry)
    if not m: return None
    c = m.group(1).strip()
    if not re.search(r'[\u4e00-\u9fff]', c): return None
    c = re.sub(r'\s+', ' ', c)
    return c[:50]

def load_period_files():
    paths = []
    for path in sorted(glob.glob(os.path.join(DATA, 'vocab-*.json'))):
        base = os.path.basename(path)
        if base.startswith('vocab-plan'):
            continue
        paths.append(path)
    return paths

def build_def_table(all_data):
    table = {k.lower(): v for k, v in MANUAL_DEF.items()}
    for d in all_data:
        for w in d.get('words', []):
            cn = w.get('cn', '')
            core = re.split(r'[；;]', cn)[0].strip() if cn else ''
            if core and re.match(r'^[a-z]+\.\s', core):
                table.setdefault(w['w'].lower(), core)
    cp = os.path.join(DATA, '_youdao_cache.json')
    if os.path.exists(cp):
        cache = json.load(open(cp, encoding='utf-8'))
        for k, v in cache.items():
            if v and k not in table:
                table[k] = v[0]
    return table

def main():
    paths = load_period_files()
    all_data = [json.load(open(p, encoding='utf-8')) for p in paths]
    table = build_def_table(all_data)
    missing = {}
    total_cn = 0
    touched_files = 0
    for path, d in zip(paths, all_data):
        changed = False
        for w in d.get('words', []):
            rel = w.get('rel', {})
            if not isinstance(rel, dict):
                continue
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
                        defn = bracket_cn(x)
                    if defn is None:
                        defn = inline_cn(x)
                    if defn is None:
                        defn = x
                        missing.setdefault(x, 0)
                        missing[x] += 1
                    out.append(defn)
                    total_cn += 1
                if out:
                    relcn[k] = out
            if relcn:
                # 仅当 relCn 缺失或与现有一致性需要重建时写入；不改 rel 及其他字段
                if w.get('relCn') != relcn:
                    w['relCn'] = relcn
                    changed = True
        if changed:
            raw = open(path, encoding='utf-8').read()
            had_nl = raw.endswith('\n')
            out = json.dumps(d, ensure_ascii=False, indent=1)
            if had_nl:
                out += '\n'
            open(path, 'w', encoding='utf-8').write(out)
            touched_files += 1
    print('OK 完成：处理 %d 个期文件，写入 relCn 共 %d 条，更新文件 %d 个' % (len(paths), total_cn, touched_files))
    if missing:
        print('WARN 无释义兜底条目 %d 个:' % len(missing))
        for k, v in sorted(missing.items(), key=lambda x: -x[1])[:40]:
            print('  %s ×%d' % (repr(k), v))

if __name__ == '__main__':
    main()
