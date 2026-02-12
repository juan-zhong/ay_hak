赣南客家话词典（静态版）- 2026-02-12

你得到的是一个能直接部署到 GitHub Pages 的词典页面：
- 模糊搜索（汉字/转写/IPA/释义/例句/英文关键词）
- 录音：保存到本机（IndexedDB）+ 下载
- 上传到“你的 Google Drive”：需要部署 Apps Script（见下）

======================
A) 部署到 GitHub Pages
======================
把以下文件放到仓库根目录：
- index.html
- style.css
- app.js
- data/entries.json
- apps_script.gs（这个只是给你拷贝用，不需要放到 Pages）

Settings -> Pages -> main / root

=============================
B) 打开“上传到我的 Drive”
=============================
1) 在 Google Drive 建一个文件夹（建议叫 DialectAudio）
2) 打开 https://script.google.com/
3) 新建项目，把 apps_script.gs 的内容全粘进去
4) （可选）把脚本里的 FOLDER_ID 改成你的文件夹 ID：
   - 打开该文件夹，URL 里 /folders/ 后面那串就是 ID
5) 部署：Deploy -> New deployment -> Web app
   - Execute as: Me
   - Who has access: Anyone
6) 复制 Web App URL（通常以 /exec 结尾）
7) 打开 app.js，把 DRIVE_UPLOAD_ENDPOINT 粘进去

完成后，网页里录音保存到本机后，点“上传到我的 Drive”就会进你的 Drive 文件夹。

注：这是“上传到你的盘（收集投稿）”，访客不需要登录。
