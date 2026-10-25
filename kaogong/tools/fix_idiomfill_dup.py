# -*- coding: utf-8 -*-
"""修复 idiomfill-*.json 选项重复问题（旧 bug 版生成器遗留）。
用法: python fix_idiomfill_dup.py <data目录>
对每个 idiomfill 文件：若某题 options 中正确答案词 w 出现多次，
把多余的 w 替换为同题 cmp 中未被使用的干扰词，保持 answer 指向不变。
"""
import json
import os
import re
import sys


def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        o = json.load(f)
    changed_items = 0
    for it in o.get('items', []):
        opts = it.get('options', [])
        w = it.get('w', '')
        ans = it.get('answer') or []
        if not w or len(set(opts)) == len(opts):
            continue
        keep = -1
        for a in ans:
            try:
                idx = ord(a) - 65
            except Exception:
                continue
            if 0 <= idx < len(opts) and opts[idx] == w:
                keep = idx
                break
        if keep < 0:
            keep = opts.index(w) if w in opts else -1
        if keep < 0:
            continue
        extras = [i for i, x in enumerate(opts) if x == w and i != keep]
        for ei in extras:
            repl = None
            for c in it.get('cmp', []):
                cw = c.get('w')
                if cw and cw != w and cw not in opts:
                    repl = cw
                    break
            if repl:
                opts[ei] = repl
                changed_items += 1
        if not ans:
            it['answer'] = [chr(65 + keep)]
    if changed_items:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(o, f, ensure_ascii=False, indent=1)
    return changed_items, len(o.get('items', []))


def main():
    data_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    total = 0
    for p in sorted(glob_files(data_dir)):
        c, n = fix_file(p)
        if c:
            print('FIXED %s (%d/%d items)' % (os.path.basename(p), c, n))
            total += c
    print('DONE total fixed items:', total)


def glob_files(data_dir):
    out = []
    for p in sorted(os.listdir(data_dir)):
        if re.search(r'^idiomfill-\d+\.json$', p):
            out.append(os.path.join(data_dir, p))
    return out


if __name__ == '__main__':
    main()
