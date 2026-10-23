# -*- coding: utf-8 -*-
"""题库去重/覆盖度小工具（出题前先跑，避免重复、避免偏科）

用法：
  python kaogong\\tools\\bank.py --used-idioms      # 已出过的全部成语/四字词语（去重）
  python kaogong\\tools\\bank.py --unused-kp        # 15 大类考点的已用/剩余，并列出未用考点
  python kaogong\\tools\\bank.py --idiom-suggest 10 # 从成语大库挑 N 个"没用过"的（需 data/idiom-bank.json）
  python kaogong\\tools\\bank.py --status           # 一屏看全部题库规模
"""
import io, os, sys, json, glob, random

try:  # Windows 控制台默认 GBK，打印 emoji/⚠️ 会崩 → 强制 utf-8
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data')
B = os.path.join(D, 'bank')


def jload(p):
    try:
        return json.load(io.open(p, encoding='utf-8'))
    except Exception:
        return None


def used_idioms():
    ws = {}
    for f in sorted(glob.glob(os.path.join(D, 'idiom-*.json'))):
        d = jload(f)
        if not d:
            continue
        for it in d.get('items', []):
            ws.setdefault(it.get('w'), []).append(os.path.basename(f)[6:9])
    return ws


def idiom_bank():
    b = jload(os.path.join(B, 'idiom_bank.json')) or jload(os.path.join(D, 'idiom-bank.json'))
    if not b:
        return []
    return b.get('items', b) if isinstance(b, dict) else b


def kp_stats():
    rows, unused = [], {}
    for f in sorted(glob.glob(os.path.join(D, 'outline', '*.json'))):
        d = jload(f)
        if not d:
            continue
        n = u = 0
        un = []
        for g in d.get('groups', []):
            for it in g.get('items', []):
                n += 1
                if it.get('src'):
                    u += 1
                else:
                    un.append(it.get('t'))
        rows.append((d.get('name'), d.get('id'), n, u))
        unused[d.get('id')] = un
    return rows, unused


def main():
    a = sys.argv[1] if len(sys.argv) > 1 else '--status'
    if a == '--used-idioms':
        ws = used_idioms()
        print('已出过词语 %d 个（共 %d 次）:' % (len(ws), sum(len(v) for v in ws.values())))
        print(' '.join(sorted(ws)))
        dup = {k: v for k, v in ws.items() if len(v) > 1}
        if dup:
            print('\n⚠️ 重复出现 %d 个:' % len(dup), ' '.join('%s(%d)' % (k, len(v)) for k, v in sorted(dup.items(), key=lambda x: -len(x[1]))))
    elif a == '--unused-kp':
        rows, unused = kp_stats()
        for name, cid, n, u in rows:
            print('  %-12s 已用 %3d / 共 %3d   剩 %3d' % (name, u, n, n - u))
        print('\n未用考点（按大类，挑题从这些里选）:')
        for cid, un in unused.items():
            print('\n[%s] 剩 %d:' % (cid, len(un)))
            print('  ' + ' / '.join(x for x in un if x))
    elif a == '--idiom-suggest':
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        bank = idiom_bank()
        if not bank:
            print('✗ 还没有 data/idiom-bank.json（成语大库未建）'); return
        used = set(used_idioms())
        pool = [x for x in bank if (x.get('w') if isinstance(x, dict) else x) not in used]
        random.shuffle(pool)
        pick = pool[:n]
        print('大库 %d 条，未用 %d 条，抽 %d:' % (len(bank), len(pool), len(pick)))
        for x in pick:
            print('  ' + ((x.get('w') + '  ' + (x.get('mean') or '')) if isinstance(x, dict) else x))
    else:
        bank = idiom_bank()
        used = used_idioms()
        rows, _ = kp_stats()
        tot = sum(r[2] for r in rows); u = sum(r[3] for r in rows)
        print('成语大库     : %s 条' % (len(bank) or '未建'))
        print('已出词语     : %d 个（%d 次）' % (len(used), sum(len(v) for v in used.values())))
        print('考点提纲     : %d 条，已用 %d，剩 %d' % (tot, u, tot - u))
        print('考公期数     : %d' % len(glob.glob(os.path.join(D, 'issue-*.json'))))
        print('速算批次     : %d' % len(glob.glob(os.path.join(D, 'calc-*.json'))))
        print('英语角词表   : %d 批 / %d 词' % (len(glob.glob(os.path.join(D, 'vocab-*.json'))) - 1,
                                              50 * len([f for f in glob.glob(os.path.join(D, 'vocab-*.json')) if 'plan' not in f])))


main()
