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
├── plant.html          单种植物页（plant.html?id=shu）
├── plants.js           图集逻辑（照片切换、二维码、打印）
├── style.css           全站样式（艾草绿 + 薯紫）
├── plants.css          植物图集样式（照片书）
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
├── vendor/fonts/       植物图集用的字体（EB Garamond、Oswald，OFL）
├── CONTENT-LICENSE.md  内容授权（文字、照片、数据、录音）
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

> 仓库名或域名改了的话，记得同步修改 `plants.js` 顶部的 `SITE`，否则纸质版上的二维码会指错地址。
>
> 改了 `style.css` 或 `.js` 之后，把各个 HTML 里 `?v=20261022b` 这样的版本号改成新的（比如当天日期），浏览器才会读取新文件。

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
| `pos` | 词性：`n` `v` `adj` `pron` `num` `part` `other` |
| `variety` | 乡镇 / 村，例如 `欣山镇`、`孔田镇·某村`。乡镇筛选按这个字段自动生成 |
| `senses` | 释义列表 |
| `examples` | 例句：`{ "text": "", "ipa": "", "gloss": "" }` |
| `tags` | 标签（语义类别等） |
| `audio` | 录音路径，例如 `audio/vu-xa.mp3` |
| `notes` | 备注（公开显示，例如“汉字写法待定”） |
| `internal` | 维护备注（旧记音、待办等），只在管理模式（`?admin=1`）里显示，也只在管理模式里参与搜索 |
| `speaker` | 发音人署名（按发音人意愿填写） |
| `variants` | 其他地方的说法：`[{ "form": "", "ipa": "", "variety": "某乡镇", "note": "" }]`。CSV 写成 `说法::IPA::乡镇::备注`，用 `||` 分隔 |
| `verified` | `true` = 已和发音人核实；不填 = 待核实 |

CSV 列名相同；`senses`、`tags` 用 `||` 分隔，`examples` 写成 `例句::IPA::翻译`，多条用 `||` 分隔。

### 2021 词表

`data/dict.json` 里 id 以 `w21-` 开头的 65 条来自 2021 年的词表（发音人 Juan Zhong，欣山镇）。当时的记音没有标声调，符号也和现在的体例不同，所以**放在 `internal`（维护备注）里，没有填进 `ipa`**，状态都是“待核实”。其中一、五、七、八、十、黄、嘴 7 条已按现行体例转写并填了 `ipa`。按现行体例重新转写后，把 IPA 填进 `ipa`、`verified` 改成 `true`，`internal` 里那句可以删掉。

### 征集词表

`data/wanted.json` 是还没记音的词（亲属称谓、时间、节日、地方、姓氏），显示在词典页的“征集”一节，点一个词就会写好邮件。词典里已经有的词会自动隐藏，所以收到说法、加进 `dict.json` 之后，不用改这个文件。加了 `"keep": true` 的组（目前是姓氏）不自动隐藏，因为“黄”“龙”作姓氏和作颜色、动物不是同一个词。

## 更新植物图集

植物图集是一本可以看、可以听、可以不断补充的数字民族植物学图册。信息层级：**照片 → 安远话发音 → 食用、药用和地方知识 → 照片档案 → 补充资料（IPA、学名、鉴定、记录、文献）**。

- `plants.html`（标本照片书）：封面三竖列（颜色取自照片）→ 目录 + 简介 → **图集**（Mater 式白色标本卡，标签栏只有本地名称和喇叭）→ 从田里到厨房 · 薯 → 关于这份图集（方法、知识来源与参考书目、范围与授权，默认收起）+ 参与。
- `plant.html?id=shu`：每种植物三个跨页，页码接着编：
  1. 标本页（看植物）｜色块页（听它怎么说：大号“听发音”、时长、多条录音、其他地方的说法）
  2. 白纸页（食用与烹饪）｜色块页（药用与传统用途：当地说法 / 文献记录 / 研究证据；没有就写“暂无可靠资料”；地方知识）
  3. 色块页（照片档案；没有就留白）｜白纸页（补充资料：IPA、学名与鉴定依据、科、记录、文献、二维码）
- 新增植物只要加照片和 `data/plants.json` 里的一条记录，页面自动生成。
- 视觉：白纸细框标本页 + 低饱和色块页（土黄、灰粉、灰绿、灰蓝、灰紫、骨白，每种植物自动轮换，也可用 `color` 指定）；白底照片放在色块上用正片叠底；英文标题 Oswald，英文正文和学名 EB Garamond，中文无衬线。

### 数据字段（`data/plants.json`）

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，网址和二维码都用它。**印刷后不要再改** |
| `name` / `ipa` / `dict` | 安远话叫法、IPA、词典词条编号（叫法链接到词典，录音也从词典里取） |
| `recordings` | 同一个叫法的多条录音：`[{ "src", "place", "speaker", "date" }]`；不填就用 `audio` 或词典里的录音 |
| `aliases` | 其他乡镇、村的叫法：`[{ "name", "ipa", "place", "audio" }]`，分别记录，不合并 |
| `gloss` | 一句话释义（可加 `_en`） |
| `edible` | `{ "part": "吃的部位", "stage": "什么时候采", "how": "怎么处理、怎么做" }`（可加 `_en`）；相关食物写在 `derived` |
| `derived` | 用它做的东西：`[{ "name", "ipa", "gloss", "photo", "cutout", "dict" }]` |
| `medicinal` | `{ "local": [{ "text", "place", "by" }], "literature": [{ "text", "work", "page", "area", "url" }], "research": [{ "text", "work", "url" }] }`：当地说法、文献记录、研究证据**分开写**，文献要写研究地点 `area` |
| `uses` / `habitat` / `season` | 其他地方知识 |
| `photos` | 第一张是大图：`{ "src", "caption", "cutout", "stage", "date", "place", "by", "license" }` |
| `mandarin` / `name_en` / `latin` / `latin_status` / `latin_basis` / `family` | 普通话名、英文名、学名、`"verified"` 表示已核实、鉴定依据、科 |
| `color` | 可选：`ochre` `mauve` `sage` `slate` `lilac` `bone` |
| `collected` / `credit` / `variety` / `refs` | 记录地点时间记录者、摄影、说法来源乡镇、参考文献 |

药用部分只写有来源的内容：当地人说的写在 `local`，书和论文写在 `literature`，科学研究结论写在 `research`。网页会注明“传统用途不等于临床疗效，不提供用药建议”。不要从书里复制照片。

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
