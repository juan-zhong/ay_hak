# AYHAK · 安远话

AYHAK 安远话记录计划的网站：项目主页、**安远话词典**和**安远话植物图集**。纯静态网页，不需要服务器，放在 GitHub Pages 上。

- 项目主页：<https://juan-zhong.github.io/ay_hak/>（English）· <https://juan-zhong.github.io/ay_hak/index-zh.html>（中文）
- 词典：<https://juan-zhong.github.io/ay_hak/dict.html>
- 植物图集：<https://juan-zhong.github.io/ay_hak/plants.html>
- 实用安远话五百句：<https://juan-zhong.github.io/ay_hak/sentences.html>
- 仓库：<https://github.com/juan-zhong/ay_hak>

原来个人网站上的 `me/fieldwork.html` 和 `me/fieldwork-zh.html` 已经搬到这里，分别成为 `index.html`（English）和 `index-zh.html`（中文）。

## 文件

```
ay_hak/
├── index.html          项目主页（English）
├── index-zh.html       项目主页（中文）
├── gallery.html        安远影像（全部照片，可点开看大图）
├── home.js             首页脚本：下一次复健会、看大图
├── favicon.svg         网站图标
├── dict.html           词典页
├── app.js              词典逻辑（搜索、筛选、收藏、录音、导入导出）
├── sentences.html      实用安远话五百句（大家录音、审核后公开）
├── sentences.js        五百句逻辑（录音、上传、点播）
├── plants.html         植物图集页
├── plants.js           图集逻辑（照片切换、二维码、打印）
├── style.css           全站样式（艾草绿 + 薯紫）
├── apps_script.gs      录音上传到 Google Drive 的 Apps Script
├── data/
│   ├── dict.json       词典数据
│   ├── meetups.json    复健会日期（首页自动显示下一次）
│   ├── sentences.json  五百句（普通话提示句，可补安远话写法和 IPA）
│   ├── wanted.json     征集词表（词典页“征集”一节）
│   └── plants.json     植物数据
├── images/
│   ├── gallery/        首页“安远影像”的照片
│   └── plants/         植物图集照片
├── audio/              录音文件（mp3 / m4a / wav）
├── vendor/qrcode.js    二维码库（qrcode-generator，MIT），本地存放，不依赖 CDN
├── LICENSE
└── .nojekyll           让 GitHub Pages 按原样发布
```

## 部署 / 更新网站

仓库 `ay_hak` 已开启 GitHub Pages（`main` 分支、根目录），推送后一两分钟网站自动更新。

```bash
git clone https://github.com/juan-zhong/ay_hak.git
cd ay_hak
# ……修改文件……
git add -A
git commit -m "说明这次改了什么"
git push
```

> 仓库名或域名改了的话，记得同步修改 `plants.js` 顶部的 `CANONICAL_URL`，否则纸质版上的二维码会指错地址。
>
> 改了 `style.css` 或 `.js` 之后，把各个 HTML 里 `?v=20261019b` 这样的版本号改成新的（比如当天日期），浏览器才会读取新文件。

## 本地预览

网页要用 `fetch` 读取 JSON，直接双击 HTML 打不开数据。请在文件夹里运行：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>（英文主页）、<http://localhost:8000/index-zh.html>（中文主页）或 <http://localhost:8000/dict.html>（词典）。


## 更新复健会日期

编辑 `data/meetups.json`：`time` 填北京时间的开始时间（如 `"20:00"`），`dates` 填这一季每次活动的日期（如 `["2026-10-23", "2026-11-06"]`）。首页会自动显示最近的一次；如果访客不在中国，还会换算成他们当地的时间。日期为空时，首页提示看日历或发邮件。

## 更新词典

两种方式：

- **直接改 `data/dict.json`**，提交到 GitHub。
- 用 Excel / Google Sheets 维护，导出 CSV，在网页“数据”区导入检查，确认无误后点“导出 JSON”，用导出的文件替换 `data/dict.json`。

网页“数据”区导入的内容只保存在当前浏览器，**不会**改动线上网站。

### 词条字段

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，用在链接里（`dict.html?w=vu-xa`；搜索链接写成 `dict.html?q=屋下`）。建议用拼音或英文，不要改动 |
| `hanzi` | 汉字写法 |
| `roman` | 拼写（可选） |
| `ipa` | IPA，不带方括号，例如 `vu⁴⁵.ha³⁴` |
| `pos` | 词性：`n` `v` `adj` `pron` `part` `other` |
| `variety` | 乡镇 / 村，例如 `欣山镇`、`孔田镇·某村`。乡镇筛选按这个字段自动生成 |
| `senses` | 释义列表 |
| `examples` | 例句：`{ "text": "", "ipa": "", "gloss": "" }` |
| `tags` | 标签（语义类别等） |
| `audio` | 录音路径，例如 `audio/vu-xa.mp3` |
| `notes` | 备注 |
| `speaker` | 发音人署名（按发音人意愿填写） |
| `variants` | 其他地方的说法：`[{ "form": "", "ipa": "", "variety": "某乡镇", "note": "" }]`。CSV 写成 `说法::IPA::乡镇::备注`，用 `||` 分隔 |
| `verified` | `true` = 已和发音人核实；不填 = 待核实 |

CSV 列名相同；`senses`、`tags` 用 `||` 分隔，`examples` 写成 `例句::IPA::翻译`，多条用 `||` 分隔。

### 2021 词表

`data/dict.json` 里 id 以 `w21-` 开头的 65 条来自 2021 年的词表（发音人 Juan Zhong，欣山镇）。当时的记音没有标声调，符号也和现在的体例不同，所以**放在 `notes` 里，没有填进 `ipa`**，状态都是“待核实”。按现行体例重新转写后，把 IPA 填进 `ipa`、`verified` 改成 `true`，备注里那句可以删掉。

### 征集词表

`data/wanted.json` 是还没记音的词（亲属称谓、时间、节日、地方、姓氏），显示在词典页的“征集”一节，点一个词就会写好邮件。词典里已经有的词会自动隐藏，所以收到说法、加进 `dict.json` 之后，不用改这个文件。

## 更新植物图集

编辑 `data/plants.json`，照片放进 `images/plants/`，录音放进 `audio/`。顶部的 `target` 是计划收录的种数（22），首页显示“已上线 x / 22 种”。

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，也是二维码指向的锚点（`plants.html#shu`）。**印刷后不要再改** |
| `name` / `ipa` | 安远话叫法和 IPA。IPA 不带斜杠，网页会显示成 `/seɪ³²⁴/`；声调用五度调值上标数字 |
| `gloss` | 简短释义 |
| `mandarin` / `latin` | 普通话名、学名 |
| `category` | `蔬菜` `野菜` `块根` `水果` `豆类` `花` `香料` `其他` |
| `photos` | 照片列表，按生长阶段排：`[{ "src": "images/plants/shu-tuber.jpg", "caption": "整个的薯" }]` |
| `habitat` / `season` / `uses` | 生长环境、季节、吃法 |
| `derived` | 用它做的食物：`[{ "name": "薯粄", "ipa": "seɪ³²⁴.pɑ̃⁴¹", "gloss": "薯做的米粄", "photo": "…", "audio": "audio/shu-ban.mp3" }]` |
| `audio` | 叫法的录音，例如 `audio/shu.mp3` |
| `variety` | 说法来源的乡镇 / 村 |
| `notes` / `credit` | 备注、署名 |

**iPhone 的 HEIC 照片浏览器大多显示不了**，请先转成 JPG（长边 1600px 左右即可）。macOS 上：

```bash
sips -s format jpeg -Z 1600 照片.HEIC --out images/plants/xxx.jpg
```

### 纸质版

植物页打开“二维码”可以预览每张卡片的二维码；点“打印 / 存 PDF”会用打印样式排版（每种植物不跨页，二维码可见），可以直接存成 PDF 做校样。

## 实用安远话五百句

- 句子在 `data/sentences.json`：20 类，每类 25 句。`zh` 是普通话提示句，`hanzi`、`ipa` 可以以后补上安远话的写法和标音。
- 大家在网页上录音（或上传手机里的录音），必须勾选“同意公开”才能提交；“同意用于研究”另外勾。
- 录音存到你的 Google Drive：`AYHAK-Sentences/` 文件夹，每条记在表格“AYHAK-五百句录音”里，状态默认“待审核”。
- **审核**：在表格里把“状态”改成“公开”，几分钟内就会出现在网站上（想马上出现，在 Apps Script 里手动运行一次 `clearCache`）。改成“不公开”就会撤下。
- **注意**：Google 的服务在中国大陆打不开，国内的访客可以看句子，但不能上传和收听，页面上会提示。

## 录音上传到 Google Drive

`app.js` 顶部的 `DRIVE_UPLOAD_ENDPOINT` 已经填好了你之前部署的 Apps Script 地址，词典页录完音点“上传到 Drive”就能用，录音进入 Drive 的 `DialectAudio` 文件夹。

**五百句要用到新版的 `apps_script.gs`，必须先更新部署，否则五百句页面会显示“连不上录音服务”。** 新版同时负责词典录音和五百句，还加了上传频率限制。更新方法：

1. 打开原来的 Apps Script 项目，用新版 `apps_script.gs` 替换全部代码。
2. 设置 `UPLOAD_TOKEN`（留空则不检查口令），并把同一串填进 `app.js` 的 `DRIVE_UPLOAD_TOKEN`。
3. 部署 → 管理部署 → 编辑 → 版本选“新版本” → 部署。这样网址不变，`app.js` 不用改。

新旧两版脚本 `app.js` 都兼容。

⚠️ 网站是公开的，上传地址和口令谁都能在 `app.js` 里看到。不采录的时候可以把 `DRIVE_UPLOAD_ENDPOINT` 改成空字符串，关闭上传按钮。

## 伦理

录音、照片和发音人信息都需要事先征得同意；署名方式由发音人决定。

---

© Juan Zhong · AYHAK
