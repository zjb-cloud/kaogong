# -*- coding: utf-8 -*-
"""图形推理真题取题器。
   python tools/kfig.py --next 2    → 取 2 道未用过的真题，写成 data/_fig_pick.json（xc items 片段），并标记已用
   python tools/kfig.py --status    → 看池子剩余
   python tools/kfig.py --reset     → 清空已用记录
"""
import io, os, sys, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).rstrip('\\/')
DATA = os.path.join(ROOT, 'data')
POOL = os.path.join(DATA, 'figure_pool.json')
USED = os.path.join(DATA, 'bank', '_used_figs.txt')
OUT = os.path.join(DATA, '_fig_pick.json')


def load_pool():
    return json.load(io.open(POOL, encoding='utf-8'))['items']


def load_used():
    if not os.path.exists(USED):
        return []
    return [l.strip() for l in io.open(USED, encoding='utf-8') if l.strip()]


def save_used(ids):
    os.makedirs(os.path.dirname(USED), exist_ok=True)
    io.open(USED, 'w', encoding='utf-8', newline='\n').write('\n'.join(ids) + '\n')


def strip_head(exp, ans):
    """去掉开头的『参考答案：X。』（答案前端会单独显示），保留解题思路。"""
    if not exp:
        return ''
    exp = exp.strip()
    m = re.match(r'^参考答案[:：]\s*[A-Da-d]\s*[。.．]?\s*', exp)
    if m:
        exp = exp[m.end():]
    return exp.strip()


def to_item(q):
    exp = strip_head(q.get('exp', ''), q.get('ans', ''))
    cat = q.get('catCn') or q.get('cat') or ''
    stem = q.get('stem') or ''
    if not stem:
        stem = '图形推理真题（%s）｜%s：观察图形的变化规律，选出符合规律的一项。' % (
            q.get('src') or '历年真题', cat or '图形推理')
    if q.get('src'):
        stem = '图形推理真题（%s）｜%s' % (q.get('src'), cat or '图形推理') + ('\n' + stem if stem else '')
    nopt = int(q.get('nopt') or 4)
    if nopt < 2:
        nopt = 4
    ans = (q.get('ans') or 'A').strip().upper()[:1]
    if ans.isalpha():                      # 护栏：答案字母不能超出选项范围
        nopt = max(nopt, ord(ans) - 64)
    imgs = q.get('imgs') or ([q['img']] if q.get('img') else [])
    return {
        'type': 'fig',
        'imgs': imgs,
        'src': q.get('src', ''),
        'cat': cat,
        'fmt': q.get('fmt', ''),
        'stem': stem,
        'options': [''] * nopt,
        'answer': [ans or 'A'],
        'explain': exp,
        'trap': '',
    }


def main():
    a = sys.argv[1:]
    if '--reset' in a:
        save_used([])
        print('reset ok')
        return
    pool = load_pool()
    used = load_used()
    if '--status' in a:
        print('pool %d, used %d, left %d' % (len(pool), len(used), len(pool) - len(used)))
        return
    n = 2
    if '--next' in a:
        i = a.index('--next')
        if i + 1 < len(a):
            n = int(a[i + 1])
    uset = set(used)
    pick = [q for q in pool if q['id'] not in uset][:n]
    if not pick:
        print('[WARN] 题池已用尽，请扩充 figure_pool.json')
        print('ok 0')
        return
    items = [to_item(q) for q in pick]
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(items, ensure_ascii=False, indent=1))
    save_used(used + [q['id'] for q in pick])
    print('ok %d -> %s （剩余 %d）' % (len(items), os.path.relpath(OUT), len(pool) - len(used) - len(items)))


if __name__ == '__main__':
    main()
