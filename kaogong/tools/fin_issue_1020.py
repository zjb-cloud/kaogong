# -*- coding: utf-8 -*-
"""补 recap / 修 method，写正式 issue-047/048、xc-020/021"""
import json, shutil

DATA = r"C:\Users\Administrator\.openclaw\workspace\kaogong\data"

recap47 = [
    "矛盾分析法是唯物辩证法方法论体系的核心，辩证法本质上是批判的、革命的",
    "社会治理三关键词：社会治安、突发公共事件处置、国家安全体系现代化",
    "道德起源三条件：劳动是首要前提、社会关系是客观条件、自我意识是主观条件",
    "植物补光灯=LED/高压钠灯，紫外线灯管杀菌不常用补光",
    "北极星在地轴正上方几乎不动，北半球星空绕它逆时针转",
    "国歌红线：商标商业广告、私人丧事、公共场所背景音乐一律禁用",
    "人脸识别信息“只能用于公共安全”漏了“个人单独同意”的例外条款",
    "山东红色线路：渤海老区对应《大刀记》，招远黄金送延安",
    "“梦想”号是超深水钻探船，深海载人潜水器是“奋斗者”号",
    "党性=根本、党风=表现、党纪=保障；政绩观起决定作用的是党性",
]
recap48 = [
    "党史分期记牢：“三步走”是1987年十三大提出，基本路线=一个中心两个基本点",
    "矛盾同一性=相互依存+相互贯通转化；推动统一体过渡的决定力量是斗争性",
    "爱国主义教育法九项内容极宽：思想理论、国家标志、河山文化、宪法法律全覆盖",
    "新兴产业=新能源新材料航空航天低空经济；船舶钢铁属传统制造",
    "疾病诊断和治疗方法不授专利权，药品、医疗器械等产品可授权",
    "全国人大“审查批准”计划预算，国务院“编制执行”计划预算",
    "医用口罩防护等级：N95级最高>外科口罩>一次性；成分不明毒气用隔绝式",
    "长江十年禁渔“一江一口两湖七河”，两湖=鄱阳湖+洞庭湖，不含太湖",
    "共建共治共享属社会治理领域，不是对外开放成就",
    "抗战胜利=近代首次完全胜利+重新确立大国地位（不是第一次确立）",
]

for no, recaps in [(47, recap47), (48, recap48)]:
    with open(f"{DATA}\\_draft_issue-{no:03d}.json", encoding="utf-8") as f:
        d = json.load(f)
    for it, rc in zip(d["items"], recaps):
        it["recap"] = rc
    with open(f"{DATA}\\issue-{no:03d}.json", "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print("issue", no, "written")

# xc method 修复
fix_m = {
    8: "过程排序题先定首末：首必是“测量/获取数据”，末必是“验证/制造样品”；再按“测量→提取特征→建模→验证”的技术逻辑串中间。",
    9: "平行结构先数前提个数、再套字母公式；题干是两个前提连锁推出结论，单前提或引入新概念的选项直接排除。",
}
with open(f"{DATA}\\_draft_xc-020.json", encoding="utf-8") as f:
    x20 = json.load(f)
for idx, it in enumerate(x20["items"], start=1):
    if idx in fix_m:
        it["method"] = fix_m[idx]
with open(f"{DATA}\\xc-020.json", "w", encoding="utf-8") as f:
    json.dump(x20, f, ensure_ascii=False, indent=1)
print("xc-020 written")

shutil.copy(f"{DATA}\\_draft_xc-021.json", f"{DATA}\\xc-021.json")
print("xc-021 written")
