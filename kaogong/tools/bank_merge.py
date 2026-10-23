# -*- coding: utf-8 -*-
"""题库大扩容：分片生成 → 校验 → 合并

用法：
  python kaogong\\tools\\bank_merge.py --check        # 只校验分片，不写入
  python kaogong\\tools\\bank_merge.py --merge        # 校验并合并（成语库 + 提纲）
  python kaogong\\tools\\bank_merge.py --status       # 看分片进度 + 合并后规模

分片目录 `kaogong/data/bank/`：
  _idiom_p1.json ... _idiom_p6.json     每个 {"part":1,"items":[{w,py,kind,mean,eg,tip,src,err}]}
  _outline_<id>.json                    每个 {"id":"meeting","groups":[{"g":"组名","items":[{t,sub,key,pts,rel,lv}]}]}
"""
import io, os, sys, json, glob, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data')
B = os.path.join(D, 'bank')


def jload(p):
    return json.load(io.open(p, encoding='utf-8')) if os.path.exists(p) else None


def jdump(p, obj):
    io.open(p, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, indent=1))


# ---------------- 成语库 ----------------
def check_idiom(strict=True):
    parts = sorted(glob.glob(os.path.join(B, '_idiom_p*.json')))
    seen, rows, errs, dups = {}, [], [], []
    for f in parts:
        d = jload(f)
        if not d:
            errs.append('%s 无法解析' % os.path.basename(f)); continue
        items = d.get('items') or []
        for i, it in enumerate(items):
            tag = '%s#%d' % (os.path.basename(f), i + 1)
            for k in ('w', 'mean', 'eg'):
                if not (it.get(k) or '').strip():
                    errs.append('%s 缺 %s' % (tag, k))
            w = (it.get('w') or '').strip()
            if w in seen:
                dups.append('%s(%s↔%s)' % (w, seen[w], os.path.basename(f)))
            else:
                seen[w] = os.path.basename(f)
            rows.append(it)
        print('  %-18s %d 条' % (os.path.basename(f), len(items)))
    if not parts:
        print('  （还没有成语分片）')
    print('成语分片合计 %d 条，去重后 %d 个' % (len(rows), len(seen)))
    if dups:
        print('⚠️ 跨分片重复 %d 个: %s' % (len(dups), ' '.join(dups[:30])))
    if errs:
        print('✗ 错误 %d:' % len(errs))
        for e in errs[:40]:
            print('   ', e)
    return rows, seen, errs, dups


def load_used():
    p = os.path.join(B, '_used_idioms.txt')
    if not os.path.exists(p):
        return set()
    txt = io.open(p, encoding='utf-8').read()
    return set(txt.split())


def merge_idiom():
    rows, seen, errs, dups = check_idiom()
    if errs:
        print('✗ 有校验错误，先修再合并'); return
    used = load_used()
    items, out, skip_used = [], {}, 0
    for it in rows:
        w = (it.get('w') or '').strip()
        if not w or w in out:
            continue
        if w in used:
            skip_used += 1
            continue
        out[w] = 1
        items.append({k: it[k] for k in ('w', 'py', 'kind', 'mean', 'eg', 'src', 'tip', 'err') if it.get(k)})
    if skip_used:
        print('  · 已过滤历史已出词 %d 个' % skip_used)
    items.sort(key=lambda x: x['w'])
    jdump(os.path.join(B, 'idiom_bank.json'), {'v': 1, 'title': '成语 · 四字词语 大库', 'n': len(items), 'items': items})
    print('已写 data/bank/idiom_bank.json：%d 条' % len(items))


# ---------------- 提纲扩容 ----------------
def outline_files():
    return sorted(glob.glob(os.path.join(D, 'outline', '[0-9]*.json')))


def check_outline():
    parts = sorted(glob.glob(os.path.join(B, '_outline_*.json')))
    add = {}
    for f in parts:
        d = jload(f)
        if not d or not d.get('id'):
            print('  ✗ %s 结构不对' % os.path.basename(f)); continue
        n = sum(len(g.get('items') or []) for g in d.get('groups') or [])
        add.setdefault(d['id'], []).append((os.path.basename(f), d))
        print('  %-26s id=%-10s +%d 条' % (os.path.basename(f), d['id'], n))
    if not parts:
        print('  （还没有提纲分片）')
    return add


def merge_outline():
    add = check_outline()
    for f in outline_files():
        d = jload(f)
        cid = d.get('id')
        if cid not in add:
            continue
        have = set()
        for g in d.get('groups', []):
            for it in g.get('items', []):
                have.add(it.get('t'))
        before = sum(len(g.get('items') or []) for g in d.get('groups') or [])
        added = 0
        for _, part in add[cid]:
            for g in part.get('groups', []):
                gname = g.get('g')
                tgt = None
                for gg in d.setdefault('groups', []):
                    if gg.get('g') == gname:
                        tgt = gg; break
                if tgt is None:
                    tgt = {'g': gname, 'items': []}
                    d['groups'].append(tgt)
                for it in g.get('items') or []:
                    if not it.get('t') or it.get('t') in have:
                        continue
                    it.setdefault('pts', []); it.setdefault('rel', []); it.setdefault('lv', 'mid')
                    if 'key' not in it:
                        it['key'] = (it.get('pts') or [''])[0][:40]
                    tgt['items'].append(it)
                    have.add(it['t']); added += 1
        jdump(f, d)
        after = sum(len(g.get('items') or []) for g in d.get('groups') or [])
        print('  %-20s %-12s %3d → %3d (+%d)' % (os.path.basename(f), d.get('name'), before, after, added))


def status():
    print('== 分片 ==')
    check_idiom()
    check_outline()
    print('\n== 合并后规模 ==')
    bank = jload(os.path.join(D, 'idiom-bank.json'))
    print('成语大库:', (bank or {}).get('n', '未建'))
    tot = 0
    for f in outline_files():
        d = jload(f)
        n = sum(len(g.get('items') or []) for g in d.get('groups') or [])
        tot += n
        print('  %-22s %3d' % (os.path.basename(f), n))
    print('提纲合计:', tot)


a = sys.argv[1] if len(sys.argv) > 1 else '--status'
if a == '--check':
    print('== 成语 =='); check_idiom()
    print('== 提纲 =='); check_outline()
elif a == '--merge':
    print('== 合并成语 =='); merge_idiom()
    print('== 合并提纲 =='); merge_outline()
else:
    status()
