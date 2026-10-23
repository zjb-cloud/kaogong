# -*- coding: utf-8 -*-
"""xcz_merge.py —— 把子代理产出的真题 JSONL 合并进 bankq_<mod>.json

用法（在 C:\\Users\\Administrator\\.openclaw\\workspace 下执行）：
  python kaogong/tools/xcz_merge.py            # 干跑：只打印合并计划与校验问题
  python kaogong/tools/xcz_merge.py --apply    # 正式写入 bankq_*.json

输入：kaogong/data/bankq/_xcz_out/*.jsonl，每行一个题目对象：
  {"mod":"cs|yy|sl|pd|kx","topic":"...","src":"真实出处 第 N 题","year":"2025",
   "type":"single","stem":"...","options":["...","...","...","..."],"ans":["B"],
   "ana":{"err":"...","sol":"...","avoid":"..."},"extra":{...}?}
输出：bankq_cs.json / bankq_yy.json / bankq_sl.json / bankq_pd.json / bankq_kx.json 追加合并，
      全部题目补 kind 标记（real/ai），topics 重新统计。
"""
import os, sys, json, re, glob, collections

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # kaogong/
BANKQ_DIR = os.path.join(BASE, 'data', 'bankq')
STAGE = os.path.join(BANKQ_DIR, '_xcz_out')
AI_PREFIX = ('每日政治常识', '词语速记填空', '行测加练')
LETTERS = 'ABCDEFGH'
MOD_NAME = {'cs': '常识判断', 'yy': '言语理解', 'sl': '数量关系', 'pd': '判断推理', 'kx': '科学推理'}


def norm_stem(s):
    return re.sub(r'\s+', '', s or '')


def load_existing(mod):
    p = os.path.join(BANKQ_DIR, 'bankq_%s.json' % mod)
    if not os.path.exists(p):
        return {'v': 1, 'mod': mod, 'name': MOD_NAME.get(mod, mod), 'topics': [], 'questions': []}
    return json.load(open(p, encoding='utf-8'))


def validate_q(q, i):
    bad = []
    if not q.get('mod') or q['mod'] not in MOD_NAME:
        bad.append('第 %d 行缺/错 mod' % i)
    if not q.get('stem'):
        bad.append('第 %d 行缺 stem' % i)
    opts = q.get('options') or []
    if len(opts) < 2:
        bad.append('第 %d 行选项不足' % i)
    ans = q.get('ans') or []
    letters = LETTERS[:max(len(opts), 1)]
    for a in ans:
        if a not in letters:
            bad.append('第 %d 行答案 %s 越界' % (i, a))
    if q.get('type') == 'multi' and len(ans) < 2:
        bad.append('第 %d 行多选答案不足' % i)
    ana = q.get('ana') or {}
    for k in ('err', 'sol', 'avoid'):
        if not ana.get(k):
            bad.append('第 %d 行缺 ana.%s' % (i, k))
    if not q.get('src'):
        bad.append('第 %d 行缺 src' % i)
    return bad


def load_staged():
    rows, errors = [], []
    if not os.path.isdir(STAGE):
        return rows, errors
    for fn in sorted(glob.glob(os.path.join(STAGE, '*.jsonl'))):
        for ln, line in enumerate(open(fn, encoding='utf-8'), 1):
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except Exception as e:
                errors.append('%s:%d 非合法 JSON：%s' % (os.path.basename(fn), ln, e))
                continue
            bad = validate_q(q, ln)
            if bad:
                errors.append('%s:%d %s' % (os.path.basename(fn), ln, '；'.join(bad)))
                continue
            rows.append(q)
    return rows, errors


def next_ids(existing):
    last = {}
    for q in existing:
        m = re.match(r'^(cs|yy|sl|pd|kx)_(\d+)$', q.get('id', ''))
        if m:
            last[m.group(1)] = max(last.get(m.group(1), 0), int(m.group(2)))
    return last


def main():
    apply = '--apply' in sys.argv
    rows, errors = load_staged()
    print('staged: %d 题，校验问题 %d 条' % (len(rows), len(errors)))
    for e in errors[:40]:
        print('  [ERR]', e)
    if not apply:
        # 干跑：按模块统计 + 去重预览
        bymod = collections.Counter(r['mod'] for r in rows)
        for m, c in sorted(bymod.items()):
            ex = load_existing(m)
            print('  plan: %s +%d (现有 %d)' % (m, c, len(ex['questions'])))
        print('[dry-run] 加 --apply 正式写入')
        return
    # 正式合并
    ids = {}
    merged = {}
    for mod in MOD_NAME:
        ex = load_existing(mod)
        ids.update(next_ids(ex['questions']))
        merged[mod] = ex
    seen = {mod: set(norm_stem(q['stem']) for q in merged[mod]['questions']) for mod in MOD_NAME}
    added = collections.Counter()
    dup = 0
    for q in rows:
        mod = q['mod']
        key = norm_stem(q['stem'])
        if key in seen[mod]:
            dup += 1
            continue
        seen[mod].add(key)
        nid = '%s_%06d' % (mod, ids.get(mod, 0) + 1)
        ids[mod] = ids.get(mod, 0) + 1
        # 多答案（如广东政治理论多选）自动转为 multi，避免单选无法判对
        q['type'] = 'multi' if len(q.get('ans') or []) > 1 else q.get('type', 'single')
        # pd：源码常把分析推理（排列/真假/一拖N材料题）误标成"类比推理"，按题干特征自动归类
        if mod == 'pd' and q.get('topic') == '类比推理':
            st = q.get('stem', '')
            if re.search(r'几真几假|真假|\b(相邻|间隔|值班|坐序|排名|顺序|依次|按照.{0,12}排列|安排.{0,12}(座位|值班|顺序|次序))|第[一二三四五六七八九十\d]+名', st):
                q['topic'] = '分析推理'
            elif re.search(r'如果.{0,10}那么|只有.{0,10}才|除非.{0,10}否则', st):
                q['topic'] = '翻译推理'
            elif re.search(r'能够推出|可以推出|由此(可以|能够)?(推出|得知)', st):
                q['topic'] = '结论推出'
        q['id'] = nid
        merged[mod]['questions'].append(q)
        added[mod] += 1
    # kind 标记（覆盖全部题目）
    for mod in MOD_NAME:
        for q in merged[mod]['questions']:
            src = q.get('src', '')
            q['kind'] = 'ai' if src.startswith(AI_PREFIX) else 'real'
    # topics 重新统计（保留原顺序，新 topic 追加）
    for mod in MOD_NAME:
        obj = merged[mod]
        cnt = collections.Counter(q.get('topic') or '' for q in obj['questions'])
        old_names = [(t.get('name'), t) for t in obj['topics']]
        old_set = [n for n, t in old_names if n]
        new_topics = []
        for n in old_set:
            if cnt.get(n):
                new_topics.append({'name': n, 'n': cnt[n]})
        for n, c in sorted(cnt.items()):
            if n and n not in old_set:
                new_topics.append({'name': n, 'n': c})
        obj['topics'] = new_topics
    for mod in MOD_NAME:
        p = os.path.join(BANKQ_DIR, 'bankq_%s.json' % mod)
        json.dump(merged[mod], open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        n_real = sum(1 for q in merged[mod]['questions'] if q.get('kind') == 'real')
        n_ai = sum(1 for q in merged[mod]['questions'] if q.get('kind') == 'ai')
        print('写入 %s：共 %d 题（real %d / ai %d），新增 %d，重复跳过 %d 条'
              % (os.path.basename(p), len(merged[mod]['questions']), n_real, n_ai, added.get(mod, 0), dup))
    print('合计新增 %d 题' % sum(added.values()))


if __name__ == '__main__':
    main()
