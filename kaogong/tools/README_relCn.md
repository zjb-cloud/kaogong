# rel 关联词中文释义（relCn）改造 — 2026-10-18

## 本次改造内容
给每个词条的 `rel`（形近 form / 音近 sound / 近义 syn）关联词新增**平行字段 `relCn`**，每个关联词带上中文释义（词性缩写 + 核心义项），前端显示为「词（释义）」，形近/音近再补 `≠ 主词` 微提示，让用户一眼看清词与词之间的联系与差别。

```js
// 改造后词条示例
{
  "w": "available",
  "rel":  {"form":["avoidable"], "sound":["avoid"], "syn":["accessible","obtainable","handy"]},
  "relCn":{"form":["a. 可避免的，可回避的"], "sound":["v. 避免，防止"],
           "syn":["a. 易接近的，可得到的","a. 可获得的","a. 手边的，方便的"]}
}
```
- `relCn.form[i] / sound[i] / syn[i]` 与 `rel` 对应数组**同位置一一对应**；`rel` 原数组**一字未改**（红线）。
- 同一个关联词在全库多次出现时释义完全一致（全局唯一释义表生成）。
- 无 `relCn` 的旧词条：前端优雅降级为只显示原词，不报错。

## 文件清单与合入位置（Windows 本机 `C:\Users\Administrator\.openclaw\workspace\kaogong\`）
| 文件 | 合入位置 | 说明 |
|---|---|---|
| `app.js` | `kaogong\app.js`（覆盖） | 前端三处渲染带 relCn 释义（学习页 relrow / 答案页关联复习 / 联合记忆组） |
| `data\vocab.js` | `kaogong\data\vocab.js`（覆盖） | 1100 词全量数据（新增 relCn，rel 未动） |
| `tools\enrich_relcn.py` | `kaogong\tools\enrich_relcn.py`（新增） | 主脚本：读 vocab.js → 生成/校验 relCn → 写回 |
| `tools\_fetch_youdao.py` | `kaogong\tools\_fetch_youdao.py`（新增） | 有道释义批量抓取器（生成 `data\_youdao_cache.json`，可离线后置） |
| `data\_youdao_cache.json` | `kaogong\data\_youdao_cache.json`（新增） | 2543 个关联词的有道释义缓存（enrich_relcn.py 的释义来源之一） |
| `README_relCn.md` | 本说明 | |

## 本机执行步骤
```
cd C:\Users\Administrator\.openclaw\workspace\kaogong
python tools\enrich_relcn.py    # 读 data\vocab.js → 校验/生成 relCn（幂等，重复跑不重复加）→ 写回
python build_data.py            # 必须全 OK 且 WARN=0
powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Message "rel 关联词中文释义 relCn"
```
> 若之后 cron 生成新一期词汇带新的 rel 词：先 `python tools\_fetch_youdao.py`（自动补抓新增词），再跑 `enrich_relcn.py` 即可全量更新。

## 释义来源与质量
1. **人工表**（脚本内 `MANUAL_DEF`）：数字/中文/缩写等特殊条目；
2. **主词表继承**：关联词恰为词表词头时，取该词条 `cn` 第一个义项（词表本体是人工精编四级释义，最准）；
3. **有道词典缓存**：其余关联词由有道英汉词典批量抓取（`_fetch_youdao.py`），释义为「词性缩写 + 核心义项」，对形近/音近/近义均真实有效；
4. **括号兜底**：历史 rel 条目中自带「词（释义）」格式的，取括号内中文。
5. 校验：生成后自动检查 rel/relCn 三键长度一一对应、释义非空；抽样 20 条人工核对（验收记录见交付报告）。

## 验收
- 线上（https://zjb-cloud.github.io/kaogong/，浏览器清 SW/缓存）：
  1. 背单词学习页「形近/音近/近义」行显示「词（释义）」，形近/音近带 `≠ 主词`（如 `avoidable（a. 可避免的，可回避的）≠ available`）；
  2. 答案页「关联复习」、背单词「联合记忆」对比组同样带释义；
  3. 旧缓存词条无 relCn 时正常显示原词。
- 红线：rel 原内容、词表本体（w/ph/cn/eg/egCn）、刷题记录/统计/错题本/历史期次均未改动。
