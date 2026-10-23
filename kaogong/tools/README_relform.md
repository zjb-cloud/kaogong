# rel.form 真形近对比补充（2026-10-18 第三轮）

## 本次内容
为 rel.form 原本为空的 750 个词补充真·形近异义词对比（1-3 个/词），每词同步补 relCn.form 中文释义。
- rel.form 覆盖：249/1100 → **999/1100**（101 词宁缺毋滥留空，如 communication/philosophy/physics 等同根族或实在无四级形近词）。
- 新增形近对比对约 1864 条；每对均满足：编辑距离 ≤4、非同根（词态/派生已由 forms 字段展示）、四级范围、词义不同。
- 来源：词表内部自动配对（编辑距离 ≤3 算法）681 词 + 词表外四级常见形近词（子代理人工筛选）69 词。

## 文件清单与合入位置（Windows 本机 `C:\Users\Administrator\.openclaw\workspace\kaogong\`）
| 文件 | 合入位置 |
|---|---|
| `data\vocab.js` | 覆盖 `kaogong\data\vocab.js` |
| `tools\augment_relform.py` | 新增 `kaogong\tools\augment_relform.py` |
| `data\_youdao_cache.json` | 覆盖（新增 63 个外部形近词释义） |
| `tools\README_relform.md` | 本说明 |

## 本机执行步骤
```
cd C:\Users\Administrator\.openclaw\workspace\kaogong
python build_data.py        # 全 OK 且 WARN=0
powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Message "rel.form 真形近对比扩充"
```
若需重新生成：`python tools\augment_relform.py`（幂等，只补 rel.form 为空的词）。

## 红线确认
- 现有 rel.form（249 词原对比对）一字未改（只追加新词条目）；
- rel.sound / rel.syn / relCn.sound / relCn.syn 零改动；
- 词表本体 w/ph/cn/eg/egCn 零改动；无历史数据删除。
