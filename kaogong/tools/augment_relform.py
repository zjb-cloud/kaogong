# -*- coding: utf-8 -*-
"""
augment_relform.py — 为 rel.form 为空的词补充真·形近异义词对比（1-3 个/词）
=========================================================================
规则（用户红线）：
- 只补 rel.form 为空的词；现有 rel.form/rel.sound/rel.syn 及 relCn 一字不动；
- 形近词标准：拼写高度相似（编辑距离 ≤4）但词义完全不同，四级范围优先；
- 严禁同根词形变化冒充（同根/派生词已由 forms 字段展示，不进 rel.form）；
- 宁缺毋滥：找不到合适的就空着；
- 每补一个 form 词，同步补 relCn.form 释义（词性+核心义项）：词表内候选取主词条 cn 首义项，
  词表外候选查 _youdao_cache.json 有道缓存；都没有则报告待补。
用法：python tools/augment_relform.py
"""
from __future__ import print_function
import json, os, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DATA = os.path.join(ROOT, 'data')

SUF = ['tion','sion','ment','ness','able','ible','ful','less','ous','ive','ally','er','or',
       'ing','ed','es','s','en','ify','ize','ise','ity','dom','ship','hood','ure','age','ary',
       'ery','ist','ism','ate','ant','ent','ance','ence','th','y','ic','ward','teen','ty']
MAX_DIST = 4

def lev(a, b):
    la, lb = len(a), len(b)
    if abs(la - lb) > MAX_DIST: return 99
    dp = list(range(lb + 1))
    for i in range(1, la + 1):
        prev = dp[0]; dp[0] = i
        for j in range(1, lb + 1):
            cur = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (0 if a[i-1] == b[j-1] else 1))
            prev = cur
    return dp[lb]

def root_of(w):
    r = w
    for suf in sorted(SUF, key=len, reverse=True):
        if len(r) > len(suf) + 2 and r.endswith(suf):
            r = r[:-len(suf)]; break
    return r

def same_root(a, b):
    r1, r2 = root_of(a), root_of(b)
    return r1 == r2 or a.startswith(r2) or b.startswith(r1)

def load_words():
    s = open(os.path.join(DATA, 'vocab.js'), encoding='utf-8').read()
    return json.JSONDecoder().raw_decode(s[s.index('['):])[0]

def cn_head(cn):
    """词条 cn 首义项：'a. 可获得的；可用的；通用的' → 'a. 可获得的'"""
    return re.split(r'[；;]', cn or '')[0].strip()

def main():
    data = load_words()
    words = [w for b in data for w in b.get('words', [])]
    wl = [w['w'].lower() for w in words]
    cm = {w['w'].lower(): w for w in words}
    # 有道缓存
    cache = {}
    cp = os.path.join(DATA, '_youdao_cache.json')
    if os.path.exists(cp):
        cache = json.load(open(cp, encoding='utf-8'))

    def cn_of_form(cand):
        """形近词释义：词表内→主词条 cn 首义项；词表外→有道缓存"""
        key = cand.lower()
        if key in cm: return cn_head(cm[key].get('cn', ''))
        if cache.get(key): return cache[key][0]
        return None

    # 1) 词表内自动配对（仅 rel.form 为空的词）
    todo = [w for w in words if not w.get('rel', {}).get('form')]
    auto = {}
    for w in todo:
        cands = []
        for other in wl:
            if other == w['w'].lower(): continue
            d = lev(w['w'].lower(), other)
            if d <= 3 and not same_root(w['w'].lower(), other):
                cands.append((d, other))
        cands.sort()
        auto[w['w']] = [o for d, o in cands[:3]]

    # 2) 子代理外部补充
    extra = {}
    for fn in ('_extra_frm_a.jsonl', '_extra_frm_b.jsonl'):
        p = os.path.join(DATA, fn)
        if not os.path.exists(p): continue
        for l in open(p, encoding='utf-8'):
            r = json.loads(l)
            if r.get('cands'): extra[r['w']] = r['cands']

    # 3) 合并 + 校验（编辑距离 ≤4、非同根、非词表已占、释义可得）
    report = {'auto': 0, 'extra': 0, 'skipped_root': 0, 'skipped_dist': 0, 'no_def': 0}
    todo_empty_after = []
    for w in todo:
        picks = []
        # 外部补充优先（词表外新词，四级对比），再补词表内
        for c in extra.get(w['w'], []) + auto.get(w['w'], []):
            c = c.strip()
            if not c or c.lower() == w['w'].lower(): continue
            if any(c.lower() == p.lower() for p in picks): continue
            if same_root(w['w'].lower(), c.lower()):
                report['skipped_root'] += 1; continue
            if lev(w['w'].lower(), c.lower()) > MAX_DIST:
                report['skipped_dist'] += 1; continue
            if cn_of_form(c) is None:
                report['no_def'] += 1
                # 释义缺失也保留词（前端降级显示原词），但记录
            picks.append(c)
            if len(picks) >= 3: break
        if picks:
            w.setdefault('rel', {})['form'] = picks
            rc = w.setdefault('relCn', {})
            rc['form'] = [cn_of_form(c) or c for c in picks]
            report['extra' if w['w'] in extra else 'auto'] += 1
        else:
            todo_empty_after.append(w['w'])

    # 4) 写回
    out = 'window.KG_VOCAB = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    if open(os.path.join(DATA, 'vocab.js'), encoding='utf-8').read().endswith('\n'):
        out += '\n'
    open(os.path.join(DATA, 'vocab.js'), 'w', encoding='utf-8').write(out)
    print('OK 写回完成')
    print('  词表内自动配对 %d 词 · 外部补充 %d 词' % (report['auto'], report['extra']))
    print('  剔除同根 %d · 剔除距离>%d %d · 释义缺失 %d' % (report['skipped_root'], MAX_DIST, report['skipped_dist'], report['no_def']))
    print('  仍无形近对比 %d 词（宁缺毋滥留空）' % len(todo_empty_after))

if __name__ == '__main__':
    main()
