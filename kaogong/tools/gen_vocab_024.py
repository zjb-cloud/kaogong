# -*- coding: utf-8 -*-
"""生成 vocab-024：50 词完整词条 + 精读文章；调用 vocab_forms.enrich_word 补 forms + 清洗 rel.form"""
import json, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = r'C:\Users\Administrator\.openclaw\workspace\kaogong'
sys.path.insert(0, os.path.join(BASE, 'tools'))
from vocab_forms import enrich_word
from gen_vocab_024_data import V024

plan = json.load(open(BASE + r'\data\vocab-plan.json', encoding='utf-8'))
plan_words = plan if isinstance(plan, list) else plan.get('words', [])

words = []
for i in range(1150, 1200):
    pw = plan_words[i]
    w = pw['w']
    eg, egCn, forms, sounds, syns = V024[w]
    rel = {'form': [x[0] for x in forms], 'sound': [x[0] for x in sounds], 'syn': [x[0] for x in syns]}
    relcn = {'form': [x[1] for x in forms], 'sound': [x[1] for x in sounds], 'syn': [x[1] for x in syns]}
    item = {'w': w, 'ph': pw['ph'], 'cn': pw['cn'], 'eg': eg, 'egCn': egCn,
            'rel': rel, 'relCn': relcn}
    # 记录 form→cn 映射，enrich_word 清洗 rel.form 后按保留词对齐 relCn.form
    fmap = dict(zip(forms, relcn['form']))
    enrich_word(item)
    if 'form' in item['rel']:
        item['relCn']['form'] = [fmap.get(x, '') for x in item['rel']['form']]
    words.append(item)

article = {
 "title": "The Torch of Kindness: Why Volunteering Matters",
 "topic": "社会民生·志愿服务与青年成长",
 "level": "CET-4",
 "words": 318,
 "paras": [
  "Every year, thousands of teenagers pick up the torch of volunteering. They teach children in poor villages, visit lonely old people, and help clean up parks and rivers. For many, it is their first taste of responsibility outside school. Volunteers do not expect money or praise; they simply want to make their corner of the world a little better.",
  "Why do young people take part? Some regard it as a way to grow: through service, they learn to tolerate different people, to speak in public, and to solve unexpected problems. Others are driven by empathy — they cannot stand the distress of others and want to offer help. The reasons may differ, but the result is the same: both the giver and the receiver gain something valuable. A study in China found that students who volunteer regularly report less anxiety and a stronger sense of purpose.",
  "Volunteering is not always easy. A new helper may hesitate at first, unsure of what to say or do. He may meet hostile looks or feel despair when progress is slow. Yet these difficulties are part of the education. As the saying goes, success comes to those who conquer small fears one by one. What starts as a hobby often grows into a lifelong habit, and the initial awkwardness gradually turns into confidence.",
  "In a world full of rapid change, kindness is a steady anchor. The torch of volunteer service was passed from one generation to the next, from village teachers to city youth, from sports events to community clinics. When we serve others, we are not only helping them — we are also building a warmer, fairer society for ourselves. That is why the flame never dies.",
 ],
 "zh": "每年都有成千上万的青少年接过志愿服务的火炬：给贫困村庄的孩子上课、看望孤独的老人、帮忙清理公园和河流。对许多人来说，这是他们走出校门后第一次体会责任。志愿者不图金钱与赞美，只想让身边的世界好一点点。年轻人为什么参与？有人把它当作成长的方式——在服务中学会包容不同的人、当众表达、解决意外问题；有人出于同理心，不忍他人受苦。原因不同，结果相同：给予者和接受者都收获良多。中国的一项研究发现，经常参加志愿服务的学生焦虑更少、目标感更强。志愿服务并不总是一帆风顺：新手会犹豫、会遇到敌意的目光、会因进展缓慢而绝望，但这些困难本身就是教育。正如谚语所说，成功属于那些一个个战胜小恐惧的人。最初的爱好会变成终身习惯，最初的笨拙会变成自信。在快速变化的世界里，善良是稳固的锚。志愿服务的火炬代代相传——从乡村教师到城市青年，从体育赛事到社区诊所。服务他人，也是在为自己建设一个更温暖、更公平的社会。这就是火焰永不熄灭的原因。",
 "hard": [
  {"en": "For many, it is their first taste of responsibility outside school.", "cn": "对许多人来说，这是他们走出校门后第一次体会责任。", "why": "first taste of（第一次尝到/体会到）是地道表达；outside school 作后置状语。写作套用：the first taste of ..."},
  {"en": "Both the giver and the receiver gain something valuable.", "cn": "给予者和接受者都收获了一些宝贵的东西。", "why": "both ... and ... 连接两个主语；形容词 valuable 后置修饰 something（不定代词后置定语）。"},
  {"en": "What starts as a hobby often grows into a lifelong habit.", "cn": "最初的爱好常常长成终身习惯。", "why": "what 引导主语从句；grow into（成长为）。套用：What starts as ... often grows into ..."}
 ],
 "glossary": {
  "words": [
   {"w": "torch", "ph": "tɔːtʃ", "cn": "n. 火炬，火把"},
   {"w": "empathy", "ph": "ˈempəθi", "cn": "n. 同理心，共情"},
   {"w": "distress", "ph": "dɪˈstres", "cn": "n. 痛苦，忧虑"},
   {"w": "hostile", "ph": "ˈhɒstaɪl", "cn": "adj. 敌对的，不友善的"},
   {"w": "awkwardness", "ph": "ˈɔːkwədnəs", "cn": "n. 笨拙，尴尬"},
   {"w": "anchor", "ph": "ˈæŋkə", "cn": "n. 锚；依靠，支柱"}
  ],
  "phrases": [
   {"p": "pick up the torch", "cn": "接过火炬，传承使命"},
   {"p": "a sense of purpose", "cn": "目标感，使命感"},
   {"p": "one by one", "cn": "一个接一个地"},
   {"p": "from ... to ...", "cn": "从……到……（范围列举）"}
  ]
 },
 "quotes": [
  {"en": "The best way to find yourself is to lose yourself in the service of others.", "cn": "找到自我的最好方式，是把自己投入到为他人服务之中。", "who": "甘地（Mahatma Gandhi）"}
 ]
}

out = {"batch": 24, "date": "2026-10-20", "session": "day",
       "words": words, "article": article}
with open(BASE + r'\data\vocab-024.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

bad = []
for w in words:
    if 'forms' not in w or not isinstance(w['forms'], dict):
        bad.append(w['w'] + ':no forms')
    if len(w.get('relCn', {}).get('form', [])) != len(w.get('rel', {}).get('form', [])):
        bad.append(w['w'] + ':relCn mismatch')
print('words:', len(words), 'bad:', bad or 'NONE')
print('glossary words:', len(article['glossary']['words']), 'phrases:', len(article['glossary']['phrases']))
print('written vocab-024.json')
