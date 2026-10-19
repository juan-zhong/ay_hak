/**
 * AYHAK 安远话词典 — 录音上传到 Google Drive
 *
 * 用法：
 * 1. script.google.com 新建项目，把本文件全部粘进去。
 * 2. 修改下面的 UPLOAD_TOKEN（和 app.js 里的 DRIVE_UPLOAD_TOKEN 一致）。
 * 3. 部署 → 新部署 → Web App；执行身份：我；访问权限：任何人。
 * 4. 把 Web App URL 填进 app.js 的 DRIVE_UPLOAD_ENDPOINT。
 *
 * 录音保存在 Drive 的 FOLDER_NAME 文件夹，按乡镇分子文件夹；
 * 同时在同一文件夹的 "AYHAK-Audio-log" 表格里记一行，方便整理。
 */

const FOLDER_NAME = 'AYHAK-Audio';
const UPLOAD_TOKEN = 'change-me';           // ← 改成只有你知道的字符串；留空则不检查口令
const MAX_BYTES = 20 * 1024 * 1024;         // 单个文件上限 20 MB
const ALLOWED_TYPES = /^audio\//;

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (UPLOAD_TOKEN && body.token !== UPLOAD_TOKEN) return json_({ ok: false, error: '口令不对' });

    const mime = String(body.mimeType || 'audio/webm');
    if (!ALLOWED_TYPES.test(mime)) return json_({ ok: false, error: '只接受音频文件' });

    const bytes = Utilities.base64Decode(String(body.data || body.dataBase64 || ''));
    if (!bytes.length) return json_({ ok: false, error: '文件是空的' });
    if (bytes.length > MAX_BYTES) return json_({ ok: false, error: '文件太大' });

    const meta = body.meta || {};
    const name = String(body.filename || ('recording-' + Date.now() + '.webm')).replace(/[\\\/:*?"<>|]+/g, '-').slice(0, 180);

    const root = folder_(DriveApp.getRootFolder(), FOLDER_NAME);
    const sub = folder_(root, String(meta.variety || '未标乡镇').slice(0, 60));
    const file = sub.createFile(Utilities.newBlob(bytes, mime, name));
    file.setDescription(JSON.stringify(meta));

    log_(root, [new Date(), meta.id || '', meta.hanzi || '', meta.ipa || '', meta.variety || '', meta.speaker || '', name, file.getUrl()]);

    return json_({ ok: true, id: file.getId(), url: file.getUrl(), name: name });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'AYHAK audio upload', folder: FOLDER_NAME });
}

function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function log_(root, row) {
  const NAME = 'AYHAK-Audio-log';
  const files = root.getFilesByName(NAME);
  let ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(NAME);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    ss.getSheets()[0].appendRow(['时间', '词条 id', '汉字', 'IPA', '乡镇', '发音人', '文件名', '链接']);
  }
  ss.getSheets()[0].appendRow(row);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
