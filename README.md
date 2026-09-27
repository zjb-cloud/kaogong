# 学习工作台 · 考公刷题 + 四级核心 2000 词

一个移动端优先的本地学习站：**考公政治常识闯关刷题** + **四级核心 2000 词卡片背诵**，支持**多档案（多用户）**和**跨设备云同步**。

## 访问地址

| 场景 | 地址 |
| --- | --- |
| **公网（任何网络、任何设备都能开）** | **https://zjb-cloud.github.io/kaogong/** |
| 本机 | http://127.0.0.1:8899/ |
| 同一 WiFi 的手机 / 平板 | http://192.168.3.21:8899/ |
| 直达某期某题 | http://127.0.0.1:8899/#/q/3/1 |
| 某期总结 | http://127.0.0.1:8899/#/r/3 |
| 背单词第 5 批 | http://127.0.0.1:8899/#/v/b/5 |
| 云同步设置 | http://127.0.0.1:8899/#/sync |

> 站点已托管在 **GitHub Pages**（仓库 `zjb-cloud/kaogong`，public），发布脚本 = `publish.ps1`。
> 每天 8:00 / 20:00 定时任务生成新内容后会调用它自动上线，约 30 秒全网生效。
> 手动发布：`powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Message "说明"`
> 发布内容白名单：index.html / app.css / app.js / README.md / data/*.js；令牌存在 `.gh_token`（已进 `.gitignore`，不会提交）。
> 本地部署目录 = `C:\Users\Administrator\kgpages`（只放要发布的文件，不要往里塞源码/词库）。

## 一、考公刷题

首页选期 → 逐题：**知识点 → 题目 → 判定 → 解析 → 易错点 → 本题小结** → 10 题走完 → **全期总结**（正确率环、错题回顾、全部知识点速记、易错对照、下期方向）。

- 单选点选项即判定；多选选完点「确认答案」
- 键盘：`1~4` 选项、`Enter` 确认 / 下一题、`←` 上一题
- 进度存本机浏览器，刷新续做；结算页可「重做这期」

## 二、背单词（四级核心 2000）

- 词表来源：四级大纲词（4615）→ 按真实英语词频排序 → 剔掉最高频 2200 个基础词和 3-4 字母的短词 → 取 **2000 个**（`build_vocab.py`）
- 排期：2026-09-27 → 2026-11-15 共 **50 天**，**每天 2 批 × 20 词**，共 100 批
- 每张卡：**单词 + 音标 + 例句（英中）+ 拓展（形近 / 音近 / 近义）**，点「🔊」可发音
- 学完标记 **不认识 / 模糊 / 认识**；标了前两类的自动进生词本
- 「复习」用生词本做英译中四选一测试；批次学完出小结（认识率环 + 本批词表）

## 三、多档案（多用户）与云同步

- **多档案**：首次打开建一个档案（昵称 + 可选 4 位密码）；每个档案的刷题进度、单词掌握度、生词本互相独立。顶栏 `⇄` 切换档案。
- **云同步（跨设备，只认账号不认设备）**：顶栏 `☁`
  1. 在设备 A：进 `☁` → 「生成同步码」→ 得到形如 `ABCD-EFGH-JKLM` 的码，本机档案和进度自动上传
  2. 在设备 B（手机 / 平板 / 另一台电脑）：打开同一个网址 → 档案页点「☁ 我已有同步码」→ 填码 → 云端档案出现 → 选「西瓜」进入，进度一模一样
  3. 之后每次答题 / 背词会自动同步（改动后 2.5 秒）；也可手动「立即同步」
- 实现：`textdb.dev` 公开 KV（无需注册，CORS 全开），key = `kg-<同步码>`；本地与云端**按条目合并**（每条带时间戳取新的），所以两端同时用也不会互相覆盖
- 同步空间里可以放多个档案 → 别人用自己的昵称新建档案，进度同空间但互不干扰
- ⚠️ 同步码就是钥匙，别乱发；这是轻量同步（公开 KV + 客户端校验），**不要放敏感内容**。密码只做本地区分，不是账号系统。

## 四、文件结构

```
kaogong/
├─ index.html          页面骨架
├─ app.css / app.js    样式与全部逻辑（原生 JS，无依赖）
├─ data/
│  ├─ issue-001..003.json   考公每一期内容（源）
│  ├─ vocab-plan.json       2000 词背诵清单（词 + 音标 + 释义）
│  ├─ vocab-001.json        单词批次内容（例句 + 拓展）
│  ├─ issues.js / vocab.js / vocab_plan.js   ← build_data.py 生成，前端实际读取
│  └─ public_url.txt        公网地址（如有）
├─ build_data.py       合并 + 校验 + 生成上面三个 js；--next / --next-batch 取号
├─ build_vocab.py      生成 2000 词清单（需要 vocab_src/ 里的词库文件）
├─ vocab_src/          原始词库（四级大纲、英语词频表）
├─ serve.bat           手动启动网页服务
└─ README.md
```

## 五、新增内容

### 考公新一期
1. 写 `data/issue-00N.json`（`--next` 取号）
2. `python build_data.py`，有 WARN 按提示改
3. 刷新网页即可

考公 JSON 结构：
```json
{ "issue": 4, "date": "2026-09-28", "session": "am", "title": "主题", "difficulty": "基础",
  "items": [{ "kp": {"title":"考点","module":"马原 · 辩证法","points":["要点"]},
              "q": {"type":"single","stem":"题干","options":["A项"],"answer":["B"],"explain":"解析"},
              "tip": "易错点", "recap": "小结" }],
  "summary": { "oneLiners": ["速记"], "pitfalls": [["易混A","易混B"]], "next": "下期方向" } }
```
规则：`items` 恰好 10 条；`type` = single / multi；单选 1 个答案、多选 ≥2；字母只用 A/B/C/D。

### 单词新一批
1. 写 `data/vocab-00M.json`（`--next-batch` 取号），从 `vocab-plan.json` 取第 `(M-1)*20+1` 到 `M*20` 这 20 个词，顺序不变
2. 每个词补 `eg`（英文例句）、`egCn`（翻译）、`rel.form / rel.sound / rel.syn`
3. `python build_data.py`

单词 JSON 结构：
```json
{ "batch": 2, "date": "2026-09-27", "session": "pm",
  "words": [{ "w": "word", "ph": "音标", "cn": "中文", "eg": "例句", "egCn": "翻译",
              "rel": { "form": ["形近"], "sound": ["音近"], "syn": ["近义"] } }] }
```

## 六、发布与自启

### 发布到公网
```powershell
cd C:\Users\Administrator\.openclaw\workspace\kaogong
powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Message "改了xxx"
```
- 脚本做的事：同步文件 → `git commit` → `git push` → GitHub Pages 自动重建
- 更新内容后 URL 后加 `?v=时间戳` 或强刷可跳过缓存

### 本机服务

- 启动：双击 `serve.bat`，或 `python -m http.server 8899 --bind 0.0.0.0 --directory <本目录>`
- 已放 `serve.bat` 到开机启动目录（`shell:startup` → `kaogong_web.bat`），重启电脑自动开服
- 取消自启：删掉启动目录里的 `kaogong_web.bat`
- 防火墙已放行 8899（规则名 `kaogong web 8899`），移除：`netsh advfirewall firewall delete rule name="kaogong web 8899"`

## 七、关于 token

网页是纯静态本地页面，**刷题、背单词、复习都不消耗任何模型 token**（全在浏览器里跑）。
只有每天 8:00 / 20:00 定时生成新一期内容 + 新一批单词时才调用模型。
