/**
 * AYHAK 录音后台（Google Apps Script）
 * 同一个部署同时负责：
 *   A. 词典页的录音上传（app.js）
 *   B. 实用安远话五百句：大家上传录音 → 你审核 → 公开后所有人都能点播（sentences.js）
 *
 * 部署 / 更新：
 * 1. 打开原来的 Apps Script 项目，用本文件替换全部代码。
 * 2. 设置上传口令（只需一次）：左侧齿轮“项目设置” → 最下面“脚本属性” → 添加脚本属性，
 *    属性名填 UPLOAD_TOKEN，值填你自己定的口令。口令只存在这里，不写进仓库里的任何文件。
 *    没设口令时，词典和五百句的上传都会被拒绝（点播不受影响）。
 * 3. 部署 → 管理部署 → 编辑 → 版本选“新版本” → 部署。网址不变，网页不用改。
 *    （第一次部署：部署 → 新部署 → Web App；执行身份：我；访问权限：任何人。）
 * 4. 第一次有人上传五百句录音后，Drive 里会出现：
 *      AYHAK-Sentences/            录音文件，按句子编号分文件夹
 *      AYHAK-五百句录音（表格）      每条录音一行
 *
 * 审核：打开表格，把“状态”一栏从“待审核”改成“公开”，这条录音就会出现在网站上；
 *       改成“不公开”或删掉这一行，网站上就不再显示。录音文件本身留在你的 Drive 里。
 *
 * 注意：Google 的服务在中国大陆无法直接访问。国内用户需要另换后台（见 README）。
 */

// ---------- A. 词典录音 ----------
const FOLDER_NAME = 'AYHAK-Audio';
// 上传口令放在“项目设置 → 脚本属性”的 UPLOAD_TOKEN 里（见文件开头），词典和五百句共用。
// 网页上第一次上传时会请你输入口令，只保存在你自己的浏览器里。

// ---------- B. 五百句 ----------
const S_FOLDER = 'AYHAK-Sentences';
const S_SHEET = 'AYHAK-五百句录音';
const S_HEADER = ['时间', '录音编号', '句子编号', '普通话', '安远话写法', '昵称', '乡镇/村', '同意公开', '同意研究', '状态', '文件 ID', '备注'];
const S_PUBLIC = '公开';
const S_PENDING = '待审核';
const S_MAX_BYTES = 3 * 1024 * 1024;       // 一条录音最大 3 MB（约 1 分钟）
const S_MAX_PER_10MIN = 40;                 // 全站每 10 分钟最多收多少条，防刷

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = /^audio\//;

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'sentence') return sentenceUpload_(body);
    return dictUpload_(body);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'list') return json_({ ok: true, recordings: publicList_() });
    if (p.action === 'audio') return json_(publicAudio_(String(p.rid || '')));
    return json_({ ok: true, service: 'AYHAK audio', actions: ['list', 'audio'] });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ===== A. 词典录音（和原来一样） ===== */
function dictUpload_(body) {
  if (!tokenOk_(body.token)) return json_({ ok: false, error: '上传口令不对', code: 'token' });
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('d-count') || 0);                                   // 词典上传也限流，防刷
  if (n >= 30) return json_({ ok: false, error: '上传太频繁，请过几分钟再试' });
  cache.put('d-count', String(n + 1), 600);
  const mime = String(body.mimeType || 'audio/webm');
  if (!ALLOWED_TYPES.test(mime)) return json_({ ok: false, error: '只接受音频文件' });
  const bytes = Utilities.base64Decode(String(body.data || body.dataBase64 || ''));
  if (!bytes.length) return json_({ ok: false, error: '文件是空的' });
  if (bytes.length > MAX_BYTES) return json_({ ok: false, error: '文件太大' });
  const meta = body.meta || {};
  const name = clean_(body.filename || ('recording-' + Date.now() + '.webm'), 180);
  const root = folder_(DriveApp.getRootFolder(), FOLDER_NAME);
  const sub = folder_(root, clean_(meta.variety || '未标乡镇', 60));
  const file = sub.createFile(Utilities.newBlob(bytes, mime, name));
  file.setDescription(JSON.stringify(meta));
  dictLog_(root, [new Date(), cell_(meta.id, 80), cell_(meta.hanzi, 80), cell_(meta.ipa, 120), cell_(meta.variety, 60), cell_(meta.speaker, 60), cell_(name, 180), file.getUrl()]);
  return json_({ ok: true, id: file.getId(), url: file.getUrl(), viewUrl: file.getUrl(), name: name });
}

function dictLog_(root, row) {
  const NAME = 'AYHAK-Audio-log';
  const files = root.getFilesByName(NAME);
  let ss;
  if (files.hasNext()) ss = SpreadsheetApp.open(files.next());
  else {
    ss = SpreadsheetApp.create(NAME);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    ss.getSheets()[0].appendRow(['时间', '词条 id', '汉字', 'IPA', '乡镇', '发音人', '文件名', '链接']);
  }
  ss.getSheets()[0].appendRow(row);
}

/* ===== B. 五百句 ===== */
function sentenceUpload_(b) {
  if (b.website) return json_({ ok: true });                                   // 机器人填的隐藏栏位
  if (!tokenOk_(b.token)) return json_({ ok: false, error: '上传口令不对', code: 'token' });
  if (!b.consentPublic) return json_({ ok: false, error: '需要同意在网站上公开播放' });
  const sid = String(b.sid || '');
  if (!/^s\d{3}$/.test(sid)) return json_({ ok: false, error: '句子编号不对' });
  const place = clean_(b.place, 40);
  if (!place) return json_({ ok: false, error: '请填写乡镇或村' });
  const mime = String(b.mimeType || 'audio/webm');
  if (!ALLOWED_TYPES.test(mime)) return json_({ ok: false, error: '只接受音频文件' });
  const bytes = Utilities.base64Decode(String(b.data || ''));
  if (!bytes.length) return json_({ ok: false, error: '录音是空的' });
  if (bytes.length > S_MAX_BYTES) return json_({ ok: false, error: '录音太长了，请控制在一分钟以内' });

  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('s-count') || 0);
  if (n >= S_MAX_PER_10MIN) return json_({ ok: false, error: '现在上传的人太多，请过几分钟再试' });
  cache.put('s-count', String(n + 1), 600);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rid = 'r' + Utilities.formatDate(new Date(), 'Asia/Shanghai', 'yyMMddHHmmss') + Math.floor(Math.random() * 1000);
    const ext = mime.indexOf('mp4') >= 0 || mime.indexOf('m4a') >= 0 ? 'm4a' : mime.indexOf('ogg') >= 0 ? 'ogg' : mime.indexOf('mpeg') >= 0 ? 'mp3' : mime.indexOf('wav') >= 0 ? 'wav' : 'webm';
    const root = folder_(DriveApp.getRootFolder(), S_FOLDER);
    const sub = folder_(root, sid);
    const file = sub.createFile(Utilities.newBlob(bytes, mime, sid + '_' + rid + '.' + ext));
    sheet_().appendRow([new Date(), rid, sid, cell_(b.zh, 200), cell_(b.hanzi, 200), cell_(b.nick, 30), cell_(place, 40),
      '是', b.consentResearch ? '是' : '否', S_PENDING, file.getId(), '']);
    return json_({ ok: true, rid: rid, status: S_PENDING });
  } finally {
    lock.releaseLock();
  }
}

function sheet_() {
  const root = folder_(DriveApp.getRootFolder(), S_FOLDER);
  const it = root.getFilesByName(S_SHEET);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(S_SHEET);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    const sh = ss.getSheets()[0];
    sh.appendRow(S_HEADER);
    sh.setFrozenRows(1);
    // “状态”一栏做成下拉选单
    const rule = SpreadsheetApp.newDataValidation().requireValueInList([S_PENDING, S_PUBLIC, '不公开'], true).build();
    sh.getRange(2, S_HEADER.indexOf('状态') + 1, 2000, 1).setDataValidation(rule);
  }
  return ss.getSheets()[0];
}

function rows_() {
  const sh = sheet_();
  const v = sh.getDataRange().getValues();
  const h = v.shift() || [];
  const ix = (k) => h.indexOf(k);
  return v.map((r) => ({
    time: r[ix('时间')], rid: String(r[ix('录音编号')]), sid: String(r[ix('句子编号')]),
    hanzi: String(r[ix('安远话写法')] || ''), nick: String(r[ix('昵称')] || ''), place: String(r[ix('乡镇/村')] || ''),
    status: String(r[ix('状态')] || ''), fileId: String(r[ix('文件 ID')] || ''),
  }));
}

// 只列出“公开”的录音；结果缓存 5 分钟
function publicList_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('s-list');
  if (hit) return JSON.parse(hit);
  const list = rows_().filter((r) => r.status === S_PUBLIC && r.fileId).map((r) => ({
    rid: r.rid, sid: r.sid, hanzi: r.hanzi, nick: r.nick, place: r.place,
    date: r.time instanceof Date ? Utilities.formatDate(r.time, 'Asia/Shanghai', 'yyyy-MM-dd') : '',
  }));
  try { cache.put('s-list', JSON.stringify(list), 300); } catch (e) { /* 太大就不缓存 */ }
  return list;
}

// 只返回“公开”录音的音频（base64）
function publicAudio_(rid) {
  if (!/^r\d+$/.test(rid)) return { ok: false, error: '录音编号不对' };
  const r = rows_().find((x) => x.rid === rid);
  if (!r || r.status !== S_PUBLIC) return { ok: false, error: '这条录音还没有公开' };
  const blob = DriveApp.getFileById(r.fileId).getBlob();
  return { ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

/* ===== 工具 ===== */
function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
// 上传口令：存在脚本属性 UPLOAD_TOKEN 里；没设就一律拒绝上传
function tokenOk_(t) {
  const want = PropertiesService.getScriptProperties().getProperty('UPLOAD_TOKEN');
  return !!want && typeof t === 'string' && t === want;
}
// 写进表格的文字：以 = + - @ 开头的前面加 ' ，表格就当普通文字，不会当公式执行
function cell_(s, max) {
  const v = clean_(s, max);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function clean_(s, max) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max || 100);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 审核时手动运行一次可以清掉列表缓存，让刚改成“公开”的录音马上出现
function clearCache() {
  CacheService.getScriptCache().remove('s-list');
}
