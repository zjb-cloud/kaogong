# -*- coding: utf-8 -*-
"""
migrate_vocab.py — 在 kaogong 工作区对 vocab-*.json 原始词条执行「词形变化补全 + 形近词清洗」
=========================================================================================
用途（2026-10-18 英语角模块改造）：
  1. 为 vocab-001~022.json 的每个词条新增 forms 字段（词形变化：n/v/adj/adv/pl 五键）
  2. 清洗 rel.form：删除词态/词族误入项，只保留真·形近异义词（宁缺毋滥，不硬凑）
  3. w/ph/cn/eg/egCn/rel.sound/rel.syn 一律不动
  4. 写回前自动备份原文件到 data\\_vocab_backup_YYYYMMDD\\
后续 cron 生成新英语角词汇时：在生成脚本里 `from vocab_forms import enrich_word`，
对每个词条调 enrich_word(word) 即可自动带 forms + 清洗后的 rel。

用法：python kaogong\\tools\\migrate_vocab.py [数据目录，默认 kaogong\\data]
"""
from __future__ import print_function
import json, os, sys, io, glob, shutil, datetime, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import vocab_forms as VF

def apply_extras():
    """合并 data/_extras_all.py（若存在）到引擎的 EXTRA 表与黑名单，保证与沙箱终稿一致"""
    p = os.path.join(ROOT, 'data', '_extras_all.py')
    if not os.path.exists(p): return
    ns = {}
    exec(open(p, encoding='utf-8').read(), ns)
    for k in ('EXTRA_DERIV', 'EXTRA_CONFUSABLE'):
        if ns.get(k): VF.__dict__[k].update(ns[k])
    for k in ('SUPPRESS_ADV', 'SUPPRESS_N'):
        if ns.get(k): VF.__dict__[k] = VF.__dict__.get(k, set()) | set(ns[k])
    print('已合并 extras_all.py（DERIV %d / CONFUSABLE %d / ADV %d / N %d）' % (
        len(VF.__dict__['EXTRA_DERIV']), len(VF.__dict__['EXTRA_CONFUSABLE']),
        len(VF.__dict__['SUPPRESS_ADV']), len(VF.__dict__['SUPPRESS_N'])))

def load_corr():
    """读 data/_corr_all.jsonl（277 条人工修正，若有）：{(batch,w): {forms,rel_form}}"""
    p = os.path.join(ROOT, 'data', '_corr_all.jsonl')
    if not os.path.exists(p): return {}
    m = {}
    for l in open(p, encoding='utf-8'):
        r = json.loads(l)
        m[(r['batch'], r['w'])] = r
    return m

def main():
    apply_extras()
    corr = load_corr()
    data_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data')
    files = [p for p in sorted(glob.glob(os.path.join(data_dir, 'vocab-*.json')))
             if re.search(r'vocab-\d{3}\.json$', os.path.basename(p))]
    if not files:
        print('未找到 vocab-*.json：%s' % data_dir); return 1
    bak = os.path.join(data_dir, '_vocab_backup_' + datetime.date.today().strftime('%Y%m%d'))
    os.makedirs(bak, exist_ok=True)
    total_w = total_forms = total_rel = 0
    rel_before = rel_after = 0
    corr_applied = 0
    for p in files:
        shutil.copy2(p, os.path.join(bak, os.path.basename(p)))
        with open(p, encoding='utf-8') as f:
            d = json.load(f)
        batch = d.get('batch') or d.get('set') or int(re.search(r'vocab-(\d+)', os.path.basename(p)).group(1))
        words = d.get('words', [])
        for w in words:
            rel = w.get('rel', {})
            if not isinstance(rel, dict):
                rel = w['rel'] = {}
            rel_before += len(rel.get('form', []))
            VF.enrich_word(w)
            if 'forms' not in w:
                w['forms'] = {'n': [], 'v': [], 'adj': [], 'adv': [], 'pl': []}
            c = corr.get((batch, w['w']))
            if c:
                w['forms'] = {k: list(c['forms'].get(k, [])) for k in ('n','v','adj','adv','pl')}
                w['rel']['form'] = list(c.get('rel_form', []))
                corr_applied += 1
            rel_after += len(rel.get('form', []))
            f_ = w.get('forms', {})
            if f_ and any(f_.values()): total_forms += 1
            total_w += 1
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        total_rel += len(words)
    print('OK 迁移完成')
    print('  文件数: %d  词条: %d  已带 forms: %d  应用人工修正: %d' % (len(files), total_w, total_forms, corr_applied))
    print('  rel.form 清洗: %d 条 -> %d 条（词态/词族已移入 forms 或删除）' % (rel_before, rel_after))
    print('  原文件已备份: %s' % bak)
    return 0

if __name__ == '__main__':
    sys.exit(main())
