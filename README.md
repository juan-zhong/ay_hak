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
│   ├── recordings.json 已发布到网站的五百句录音
│   └── plants.json     植物数据
├── images/
│   ├── gallery/        首页“安远影像”的照片
│   └── plants/         植物图集照片
├── audio/              录音文件（mp3 / m4a / wav）
├── tools/publish_recordings.py  把审核通过的五百句录音发布到网站（国内可播）
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

## 管理模式

词典的录音上传、数据导入导出，以及植物图集的二维码和打印，只给维护者用，平时不显示。在网址后面加 `?admin=1` 打开（比如 `…/ay_hak/dict.html?admin=1`），浏览器会记住；加 `?admin=0` 关闭。这只是把按钮藏起来，不是密码保护。

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

植物图集是一本持续增加内容的田野摄影图册（An evolving photographic fieldbook）。网页连续浏览，不分页码；纸质版用打印样式另排。

- `plants.html`：首页。封面大图 → 简介 → 图集（照片网格）→ 从田里到日常 → 薯 → 方法 → 植物知识与文献 → 关于本图集 → 参与。
- `plant.html?id=shu`：每种植物一篇小型 photo essay，按数据自动生成：认识这种植物（白纸细框标本页 + 标签栏）→ 不同阶段 → 从植物到食物 → 语言与记录 → 植物知识与文献（有资料才出现）。
- 新增植物只要加照片和 `data/plants.json` 里的一条记录，不用改页面。
- 配色：暖纸白 `#F5F2EA`、墨黑 `#252721`、石灰灰 `#77766E`、分隔线 `#D5D0C5`；深橄榄绿 `#4D5842` 只用于链接、录音、导航；陶土红 `#A65F43` 只用于章节编号。颜色主要来自照片。

### 数据字段（`data/plants.json`）

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，网址和二维码都用它（`plant.html?id=shu`）。**印刷后不要再改** |
| `name` / `ipa` | 安远话叫法和 IPA（不带斜杠，五度调值上标数字） |
| `dict` | 词典里对应的词条编号（如 `pl-shu`），叫法链接到词典，录音也从词典里取 |
| `gloss` / `mandarin` | 简短释义、普通话名（可加 `_en`） |
| `latin` / `latin_status` | 学名；`latin_status: "verified"` 表示已对照标本和可靠植物志核实，否则网页显示“待核实” |
| `photos` | 照片列表，第一张是标本页大图：`{ "src", "caption", "caption_en", "cutout": true, "wide": true, "stage": "块茎", "date": "2026-10", "place": "欣山镇", "by": "Juan Zhong", "license": "CC BY-NC" }`。`cutout` = 白底照；`wide` = 横图；`stage/place/date` 会显示在图注里 |
| `aliases` | 其他乡镇、村的叫法：`[{ "name", "ipa", "place" }]`，分别记录，不合并 |
| `collected` | `{ "place", "date", "by" }` 记录地点、时间、记录者 |
| `uses` / `habitat` / `season` | **地方知识**：当地人实际分享的用途、生长环境、季节 |
| `refs` | 资料：`[{ "layer": "local / botany / literature", "text": "自己概括的要点", "work": "书名或论文", "page", "area": "研究地点", "url" }]` |
| `derived` | 用它做的东西：`[{ "name", "ipa", "gloss", "photo", "cutout", "dict" }]` |
| `audio` / `variety` / `credit` | 录音（不填就用词典里的）、说法来源乡镇、摄影署名 |

**知识分三层，不要混在一起**：`uses` 等写当地人实际说的；`layer: "botany"` 写核对过的植物学资料；`layer: "literature"` 写文献记载的用途，必须注明文献和研究地点（`area`）。网页会自动注明“文献记录的是传统用途，不代表实际疗效，也不是用药建议”。不要从书里复制照片或扫描书页。

### 照片

- 建议按植物分文件夹：`images/plants/shu/plant-01.jpg`、`tuber-01.jpg`、`food-01.jpg`。旧照片的路径不用改。
- **标本照**（第一张）：放在白纸上，白天窗边散射光，不开闪光灯，四周多留白，一张只拍一样东西，竖拍。
- 有什么拍什么，不必凑齐：生长环境 → 整株 → 叶、花、果等细节 → 吃的部位 → 采收后 → 加工过程 → 做好的食物 → 记录过程。识别植物需要多角度、看得清形态的照片。
- iPhone 的 HEIC 先转 JPG（长边 2000px 左右）：`sips -s format jpeg -Z 2000 照片.HEIC --out images/plants/shu/xxx.jpg`。
- 白底不纯也没关系，可以统一处理成纯白（文件名加 `-w`）。
- 有人物、私人地点的照片，先确认能不能公开。

### 纸质版

管理模式（`?admin=1`）下，植物页可以打开“二维码”，点“打印/存PDF”用打印样式排版，二维码可见，可以直接存成 PDF 做校样。

## 实用安远话五百句

- 句子在 `data/sentences.json`：20 类，每类 25 句。`zh` 是普通话提示句，`hanzi`、`ipa` 可以以后补上安远话的写法和标音。
- 大家在网页上录音（或上传手机里的录音），必须勾选“同意公开”才能提交；“同意用于研究”另外勾。
- 录音存到你的 Google Drive：`AYHAK-Sentences/` 文件夹，每条记在表格“AYHAK-五百句录音”里，状态默认“待审核”。
- **审核**：在表格里把“状态”改成“公开”，几分钟内就会出现在网站上（想马上出现，在 Apps Script 里手动运行一次 `clearCache`）。改成“不公开”就会撤下。
- **国内点播**：审核通过的录音要“发布到网站”，放进仓库的 `audio/sentences/`，网页直接从网站播放，**不经过 Google，国内也能听**。步骤：
  1. 在 Google 表格“AYHAK-五百句录音”里把要公开的行改成“公开”；
  2. 下载这张表（文件 → 下载 → CSV），再把 Drive 里的 `AYHAK-Sentences` 文件夹下载下来解压；
  3. 在仓库根目录运行：`python3 tools/publish_recordings.py --sheet 表格.csv --audio-dir AYHAK-Sentences`（需要 ffmpeg：`brew install ffmpeg`）；
  4. 把 `audio/sentences/` 和 `data/recordings.json` 上传到 GitHub。
  邮件、石墨表单等其他渠道收到的录音，也可以整理成同样列名的表格（加一列“文件名”），用同一个命令发布。
- **上传**仍然走 Google，在国内需要能打开 Google 的网络；页面上会提示国内用户改用邮件寄录音。

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
