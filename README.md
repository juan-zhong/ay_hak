# AYHAK · 安远话

AYHAK 安远话记录计划的独立网站：**安远话词典**和**安远话植物图集**。纯静态网页，不需要服务器，直接放在 GitHub Pages 上就能用。

- 项目主页：<https://juan-zhong.github.io/me/fieldwork-zh.html>
- 本站：<https://juan-zhong.github.io/ay_hak/>
- 仓库：<https://github.com/juan-zhong/ay_hak>

## 文件

```
ay_hak/
├── index.html          词典页
├── app.js              词典逻辑（搜索、筛选、收藏、录音、导入导出）
├── plants.html         植物图集页
├── plants.js           图集逻辑（筛选、二维码、打印）
├── style.css           两页共用样式（沿用个人网站 AYHAK 页面的风格）
├── apps_script.gs      可选：录音上传到 Google Drive 的 Apps Script
├── data/
│   ├── dict.json       词典数据
│   └── plants.json     植物数据
├── images/plants/      植物照片（JPG）
├── audio/              录音文件（mp3 / m4a / wav）
├── vendor/qrcode.js    二维码库（qrcode-generator，MIT），本地存放，不依赖 CDN
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

## 本地预览

网页要用 `fetch` 读取 JSON，直接双击 HTML 打不开数据。请在文件夹里运行：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 更新词典

两种方式：

- **直接改 `data/dict.json`**，提交到 GitHub。
- 用 Excel / Google Sheets 维护，导出 CSV，在网页“数据”区导入检查，确认无误后点“导出 JSON”，用导出的文件替换 `data/dict.json`。

网页“数据”区导入的内容只保存在当前浏览器，**不会**改动线上网站。

### 词条字段

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，用在链接里（`index.html?w=vu-xa`）。建议用拼音或英文，不要改动 |
| `hanzi` | 汉字写法 |
| `roman` | 拼写（可选） |
| `ipa` | IPA，不带方括号，例如 `vu⁴⁵.xɑ³⁴` |
| `pos` | 词性：`n` `v` `adj` `pron` `part` `other` |
| `variety` | 乡镇 / 村，例如 `欣山镇`、`孔田镇·某村`。乡镇筛选按这个字段自动生成 |
| `senses` | 释义列表 |
| `examples` | 例句：`{ "text": "", "ipa": "", "gloss": "" }` |
| `tags` | 标签（语义类别等） |
| `audio` | 录音路径，例如 `audio/vu-xa.mp3` |
| `notes` | 备注 |
| `speaker` | 发音人署名（按发音人意愿填写） |

CSV 列名相同；`senses`、`tags` 用 `||` 分隔，`examples` 写成 `例句::IPA::翻译`，多条用 `||` 分隔。

## 更新植物图集

编辑 `data/plants.json`，照片放进 `images/plants/`，录音放进 `audio/`。顶部的 `target` 是计划收录的种数（22），首页显示“已上线 x / 22 种”。

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，也是二维码指向的锚点（`plants.html#shu`）。**印刷后不要再改** |
| `name` / `ipa` | 安远话叫法和 IPA。IPA 不带斜杠，网页会显示成 `/sé/` |
| `gloss` | 简短释义 |
| `mandarin` / `latin` | 普通话名、学名 |
| `category` | `蔬菜` `野菜` `块根` `水果` `豆类` `花` `香料` `其他` |
| `photos` | 照片列表，按生长阶段排：`[{ "src": "images/plants/shu-tuber.jpg", "caption": "整个的薯" }]` |
| `habitat` / `season` / `uses` | 生长环境、季节、吃法 |
| `derived` | 用它做的食物：`[{ "name": "薯粄", "ipa": "sé.pɑ̃̌", "gloss": "薯做的米粄", "photo": "…", "audio": "audio/shu-ban.mp3" }]` |
| `audio` | 叫法的录音，例如 `audio/shu.mp3` |
| `variety` | 说法来源的乡镇 / 村 |
| `notes` / `credit` | 备注、署名 |

**iPhone 的 HEIC 照片浏览器大多显示不了**，请先转成 JPG（长边 1600px 左右即可）。macOS 上：

```bash
sips -s format jpeg -Z 1600 照片.HEIC --out images/plants/xxx.jpg
```

### 纸质版

植物页打开“二维码”可以预览每张卡片的二维码；点“打印 / 存 PDF”会用打印样式排版（每种植物不跨页，二维码可见），可以直接存成 PDF 做校样。

## 录音上传到 Google Drive

`app.js` 顶部的 `DRIVE_UPLOAD_ENDPOINT` 已经填好了你之前部署的 Apps Script 地址，词典页录完音点“上传到 Drive”就能用，录音进入 Drive 的 `DialectAudio` 文件夹。

想升级到仓库里新版的 `apps_script.gs`（按乡镇分文件夹、自动记一张登记表、可设口令）：

1. 打开原来的 Apps Script 项目，用新版 `apps_script.gs` 替换全部代码。
2. 设置 `UPLOAD_TOKEN`（留空则不检查口令），并把同一串填进 `app.js` 的 `DRIVE_UPLOAD_TOKEN`。
3. 部署 → 管理部署 → 编辑 → 版本选“新版本” → 部署。这样网址不变，`app.js` 不用改。

新旧两版脚本 `app.js` 都兼容。

⚠️ 网站是公开的，上传地址和口令谁都能在 `app.js` 里看到。不采录的时候可以把 `DRIVE_UPLOAD_ENDPOINT` 改成空字符串，关闭上传按钮。

## 伦理

录音、照片和发音人信息都需要事先征得同意；署名方式由发音人决定。

---

© Juan Zhong · AYHAK
