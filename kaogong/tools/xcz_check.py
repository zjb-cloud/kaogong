# -*- coding: utf-8 -*-
"""xcz_check.py —— 校验子代理产出的真题 JSONL（供子代理自检用）
用法：python kaogong/tools/xcz_check.py "kaogong/data/bankq/_xcz_out/zt2025_gk_p*.jsonl"
"""
import sys, json, glob, collections

def main():
    if len(sys.argv) < 2:
        print('用法：python kaogong/tools/xcz_check.py "<glob模式>"')
        sys.exit(1)
    pat = sys.argv[1]
    files = sorted(glob.glob(pat))
    if not files:
        print('NO FILES matched:', pat)
        sys.exit(1)
    ok = bad = 0
    bymod = collections.Counter()
    for fn in files:
        for ln, line in enumerate(open(fn, encoding='utf-8'), 1):
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except Exception as e:
                print('BAD JSON %s:%d %s' % (fn, ln, e))
                bad += 1
                continue
            need = ['mod', 'topic', 'src', 'year', 'type', 'stem', 'options', 'ans', 'ana']
            miss = [k for k in need if not q.get(k)]
            if miss:
                print('缺字段 %s:%d %s' % (fn, ln, miss))
                bad += 1
                continue
            if len(q['options']) < 4:
                print('选项不足 %s:%d (%d)' % (fn, ln, len(q['options'])))
                bad += 1
                continue
            letters = 'ABCDEFGH'[:len(q['options'])]
            for a in q['ans']:
                if a not in letters:
                    print('答案越界 %s:%d %s' % (fn, ln, a))
                    bad += 1
                    continue
            for k in ('err', 'sol', 'avoid'):
                if not q['ana'].get(k):
                    print('缺ana.%s %s:%d' % (k, fn, ln))
                    bad += 1
                    continue
            ok += 1
            bymod[q['mod']] += 1
    print('== check %s ==' % pat)
    print('files: %d, total OK: %d, BAD: %d' % (len(files), ok, bad))
    print('by mod:', dict(bymod))
    print('PASS' if bad == 0 else 'FAIL')


if __name__ == '__main__':
    main()
