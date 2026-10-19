/* =========================================================
   AYHAK · 安远话词典 — app.js
   纯静态：读取 data/dict.json；浏览器里的修改存 localStorage；
   录音存 IndexedDB，可选上传到 Google Drive（Apps Script Web App）。
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 配置 ---------- */
  // 部署 apps_script.gs 后，把 Web App URL 填在这里；留空 = 关闭上传按钮
  const DRIVE_UPLOAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycby7Poi19-pkfrG0Ey2JhF_GbiS4B6_CKcZ1sG6ThOta9kOYKsAh4uOnn4qDxfyB1HF5pw/exec';
  // 换成仓库里新版 apps_script.gs 时，填和脚本里 UPLOAD_TOKEN 一样的字符串；旧版脚本不需要
  const DRIVE_UPLOAD_TOKEN = '';

  const DATA_URL = './data/dict.json';
  const LS_DATA = 'ayhak.dict.entries.v1';
  const LS_STARS = 'ayhak.dict.stars.v1';
  const LS_PREFS = 'ayhak.dict.prefs.v1';
  const IDB_NAME = 'ayhak-audio';
  const IDB_STORE = 'recordings';

  const POS_LABEL = { n: '名词', v: '动词', adj: '形容词', pron: '代词', part: '语气词', other: '其他' };

  /* ---------- 小工具 ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const toList = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : String(v).split('||').map((s) => s.trim()).filter(Boolean));

  // 模糊匹配用的归一化：小写、去声调上标/数字、去方括号和斜杠、去附加符号
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹˥˦˧˨˩';
  function norm(s) {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ͜͡]/g, '')
      .replace(new RegExp(`[${SUP}0-9]`, 'g'), '')
      .replace(/[\[\]\/().,，。、;；:：!?！？"'“”‘’\-_·ˑː‿]/g, '')
      .replace(/\s+/g, '');
  }
  function isSubseq(needle, hay) {
    let i = 0;
    for (let j = 0; j < hay.length && i < needle.length; j++) if (hay[j] === needle[i]) i++;
    return i === needle.length;
  }

  /* ---------- 数据规范化 ---------- */
  let seq = 0;
  function slug(e) {
    const base = norm(e.roman || '') || norm(e.hanzi || '') || 'w';
    return `${base.slice(0, 24)}-${(++seq).toString(36)}`;
  }
  function normalizeEntry(raw) {
    const e = {
      id: String(raw.id || '').trim(),
      hanzi: String(raw.hanzi || raw.word || '').trim(),
      roman: String(raw.roman || raw.romanization || '').trim(),
      ipa: String(raw.ipa || '').trim(),
      pos: String(raw.pos || 'other').trim() || 'other',
      variety: String(raw.variety || raw.town || '').trim(),
      senses: toList(raw.senses),
      examples: [],
      tags: toList(raw.tags),
      audio: String(raw.audio || '').trim(),
      notes: String(raw.notes || '').trim(),
      speaker: String(raw.speaker || '').trim(),
    };
    if (!POS_LABEL[e.pos]) e.pos = 'other';
    const exs = Array.isArray(raw.examples) ? raw.examples : toList(raw.examples);
    e.examples = exs.map((x) => {
      if (typeof x === 'object' && x) return { text: String(x.text || '').trim(), ipa: String(x.ipa || '').trim(), gloss: String(x.gloss || '').trim() };
      const parts = String(x).split('::').map((s) => s.trim());
      if (parts.length >= 3) return { text: parts[0], ipa: parts[1], gloss: parts.slice(2).join('::') };
      return { text: parts[0] || '', ipa: '', gloss: parts[1] || '' };
    }).filter((x) => x.text);
    if (!e.id) e.id = slug(e);
    return e;
  }
  function normalizeAll(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter((r) => r && (r.hanzi || r.word || r.roman || r.ipa)).map((r) => {
      const e = normalizeEntry(r);
      while (seen.has(e.id)) e.id = `${e.id}-${(++seq).toString(36)}`;
      seen.add(e.id);
      return e;
    });
  }
  function buildIndex(e) {
    e._f = {
      hanzi: norm(e.hanzi), roman: norm(e.roman), ipa: norm(e.ipa),
      senses: norm(e.senses.join(' ')),
      ex: norm(e.examples.map((x) => `${x.text} ${x.ipa} ${x.gloss}`).join(' ')),
      rest: norm(`${e.tags.join(' ')} ${e.notes} ${e.variety}`),
    };
    return e;
  }

  /* ---------- 状态 ---------- */
  const state = {
    entries: [],
    source: 'repo',
    q: '',
    variety: 'all',
    pos: 'all',
    starredOnly: false,
    showIPA: true,
    showAudio: true,
    activeId: null,
    stars: new Set(ls.get(LS_STARS, [])),
    shown: [],
  };
  Object.assign(state, (({ showIPA = true, showAudio = true }) => ({ showIPA, showAudio }))(ls.get(LS_PREFS, {})));

  /* ---------- 搜索 ---------- */
  function score(e, nq, rawq) {
    if (!nq) return 1;
    const f = e._f;
    if (rawq && e.hanzi === rawq) return 100;
    let s = 0;
    const tryField = (val, w) => {
      if (!val) return;
      if (val === nq) s = Math.max(s, 90 * w);
      else if (val.startsWith(nq)) s = Math.max(s, 70 * w);
      else if (val.includes(nq)) s = Math.max(s, 50 * w);
    };
    tryField(f.hanzi, 1); tryField(f.roman, 1); tryField(f.ipa, 1);
    tryField(f.senses, 0.8); tryField(f.ex, 0.5); tryField(f.rest, 0.4);
    if (!s && nq.length >= 2) {
      if (isSubseq(nq, f.roman) || isSubseq(nq, f.ipa) || isSubseq(nq, f.hanzi)) s = 15;
      else if (isSubseq(nq, f.senses)) s = 8;
    }
    return s;
  }
  function runSearch() {
    const rawq = state.q.trim();
    const nq = norm(rawq);
    const out = [];
    for (const e of state.entries) {
      if (state.variety !== 'all' && e.variety !== state.variety) continue;
      if (state.pos !== 'all' && e.pos !== state.pos) continue;
      if (state.starredOnly && !state.stars.has(e.id)) continue;
      const s = score(e, nq, rawq);
      if (s > 0) out.push([s, e]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].hanzi.localeCompare(b[1].hanzi, 'zh-Hans-CN'));
    state.shown = out.map((x) => x[1]);
    renderResults();
  }

  /* ---------- 渲染：结果列表 ---------- */
  function renderResults() {
    const box = $('#results');
    $('#resultMeta').textContent = `${state.shown.length} 条`;
    if (!state.shown.length) {
      box.innerHTML = `<p class="none">${state.entries.length ? '没有找到。换个写法试试，或者<a href="mailto:juanzhon@buffalo.edu?subject=AYHAK%20词典">告诉我们这个词</a>。' : '词典还是空的，可以在“数据”里导入。'}</p>`;
      return;
    }
    box.innerHTML = state.shown.slice(0, 300).map((e) => `
      <button class="result${e.id === state.activeId ? ' is-active' : ''}" data-id="${esc(e.id)}" role="option" aria-selected="${e.id === state.activeId}">
        ${state.stars.has(e.id) ? '<span class="star">★</span>' : ''}
        <span class="hw">${esc(e.hanzi || e.roman)}</span>${state.showIPA && e.ipa ? `<span class="ipa">[${esc(e.ipa)}]</span>` : ''}
        <div class="gl">${esc([e.variety, e.senses[0]].filter(Boolean).join(' · '))}</div>
      </button>`).join('');
  }

  /* ---------- 渲染：词条 ---------- */
  function renderEntry() {
    const box = $('#entry');
    const e = state.entries.find((x) => x.id === state.activeId);
    ['#btnStar', '#btnCopy', '#btnLink'].forEach((s) => { $(s).disabled = !e; });
    if (!e) {
      box.className = 'entry empty';
      box.innerHTML = '<p>先搜一个词，或者点左边的结果。</p>';
      $('#btnStar').textContent = '☆';
      $('#btnStar').classList.remove('is-on');
      return;
    }
    const starred = state.stars.has(e.id);
    $('#btnStar').textContent = starred ? '★' : '☆';
    $('#btnStar').classList.toggle('is-on', starred);

    box.className = 'entry';
    box.innerHTML = `
      <div class="headword">${esc(e.hanzi || e.roman)}</div>
      <div class="pron">
        ${e.roman && e.hanzi ? `<span class="roman">${esc(e.roman)}</span>` : ''}
        ${state.showIPA && e.ipa ? `<span class="ipa">[${esc(e.ipa)}]</span>` : ''}
      </div>
      <div class="meta">
        <span class="tag">${esc(POS_LABEL[e.pos] || '其他')}</span>
        ${e.variety ? `<span class="tag">${esc(e.variety)}</span>` : '<span class="tag pending">乡镇待补</span>'}
        ${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>

      ${e.senses.length ? `<h4>释义</h4><ol class="senses">${e.senses.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}

      ${e.examples.length ? `<h4>例句</h4>${e.examples.map((x) => `
        <div class="ex">
          <div class="src">${esc(x.text)}</div>
          ${state.showIPA && x.ipa ? `<span class="ipa">[${esc(x.ipa)}]</span>` : ''}
          ${x.gloss ? `<div class="tr">${esc(x.gloss)}</div>` : ''}
        </div>`).join('')}` : ''}

      ${e.notes ? `<h4>备注</h4><p class="notes">${esc(e.notes)}</p>` : ''}

      ${state.showAudio ? `<h4>发音</h4><div class="audio-box" id="audioBox"><p class="small">载入中…</p></div>` : ''}

      ${e.speaker ? `<p class="credit">发音人 / 提供者：${esc(e.speaker)}</p>` : ''}
    `;
    if (state.showAudio) renderAudio(e);
  }

  /* ---------- 录音：IndexedDB ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('浏览器不支持 IndexedDB'));
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore(IDB_STORE, { keyPath: 'key', autoIncrement: true });
        s.createIndex('entryId', 'entryId');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(IDB_STORE, mode);
      const out = fn(tx.objectStore(IDB_STORE));
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
    });
  }
  const recList = (entryId) => idb('readonly', (s) => s.index('entryId').getAll(entryId));
  const recAdd = (rec) => idb('readwrite', (s) => s.add(rec));
  const recPut = (rec) => idb('readwrite', (s) => s.put(rec));
  const recDel = (key) => idb('readwrite', (s) => s.delete(key));
  const recClear = () => idb('readwrite', (s) => s.clear());

  /* ---------- 录音：界面 ---------- */
  let recorder = null;
  let recChunks = [];
  let recEntryId = null;
  const urls = [];
  const revokeAll = () => { while (urls.length) URL.revokeObjectURL(urls.pop()); };

  async function renderAudio(e) {
    const box = $('#audioBox');
    if (!box) return;
    revokeAll();
    let recs = [];
    let idbErr = '';
    try { recs = await recList(e.id); } catch (err) { idbErr = err.message || String(err); }
    if (state.activeId !== e.id || !$('#audioBox')) return;

    const canRec = !!(navigator.mediaDevices && window.MediaRecorder);
    const recording = recorder && recorder.state === 'recording' && recEntryId === e.id;

    const rows = [];
    if (e.audio) rows.push(`<div class="audio-row"><span class="small">词典录音</span><audio controls preload="none" src="${esc(e.audio)}"></audio></div>`);
    recs.sort((a, b) => b.created - a.created).forEach((r) => {
      const u = URL.createObjectURL(r.blob); urls.push(u);
      const when = new Date(r.created).toLocaleString('zh-CN', { hour12: false });
      rows.push(`<div class="audio-row">
        <span class="small">本机 · ${esc(when)}</span>
        <audio controls src="${u}"></audio>
        <a class="btn sm btn-ghost" href="${u}" download="${esc(fileName(e, r))}">下载</a>
        ${DRIVE_UPLOAD_ENDPOINT ? (r.driveUrl ? `<a class="btn sm btn-ghost" href="${esc(r.driveUrl)}" target="_blank" rel="noopener">已上传 ↗</a>` : `<button class="btn sm" data-up="${r.key}">上传到 Drive</button>`) : ''}
        <button class="btn sm btn-ghost" data-del="${r.key}">删除</button>
      </div>`);
    });
    if (!rows.length) rows.push('<p class="small" style="margin-bottom:8px">还没有录音。</p>');

    box.innerHTML = `${rows.join('')}
      <div class="audio-row">
        ${canRec ? (recording
          ? `<button class="btn sm btn-danger" id="btnRecStop"><span class="rec-dot"></span>停止录音</button>`
          : `<button class="btn sm primary" id="btnRec">● 录一条</button>`)
          : '<span class="small">这个浏览器不支持网页录音。</span>'}
        <span class="small" id="recStatus">${esc(idbErr)}</span>
      </div>`;

    $('#btnRec')?.addEventListener('click', () => startRec(e));
    $('#btnRecStop')?.addEventListener('click', stopRec);
    $$('[data-del]', box).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('删除这条本机录音？')) return;
      await recDel(Number(b.dataset.del));
      renderAudio(e);
    }));
    $$('[data-up]', box).forEach((b) => b.addEventListener('click', () => upload(e, recs.find((r) => r.key === Number(b.dataset.up)), b)));
  }

  function fileName(e, r) {
    const ext = (r.mime || '').includes('ogg') ? 'ogg' : (r.mime || '').includes('mp4') ? 'm4a' : 'webm';
    const d = new Date(r.created);
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    return `${e.id}_${e.hanzi || 'x'}_${e.variety || 'na'}_${stamp}.${ext}`.replace(/[\\/:*?"<>|\s]+/g, '-');
  }

  async function startRec(e) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const pref = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
      recorder = new MediaRecorder(stream, pref ? { mimeType: pref } : undefined);
      recChunks = [];
      recEntryId = e.id;
      recorder.ondataavailable = (ev) => ev.data.size && recChunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks, { type: recorder.mimeType || 'audio/webm' });
        const target = state.entries.find((x) => x.id === recEntryId);
        try { await recAdd({ entryId: recEntryId, blob, mime: blob.type, created: Date.now() }); }
        catch (err) { alert(`保存录音失败：${err.message || err}`); }
        recorder = null;
        if (target && state.activeId === target.id) renderAudio(target);
      };
      recorder.start();
      renderAudio(e);
    } catch (err) {
      alert(`无法开始录音：${err.message || err}\n请确认浏览器已允许使用麦克风（需要 https 或 localhost）。`);
    }
  }
  function stopRec() { if (recorder && recorder.state === 'recording') recorder.stop(); }

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  async function upload(e, rec, btn) {
    if (!rec || !DRIVE_UPLOAD_ENDPOINT) return;
    btn.disabled = true; btn.textContent = '上传中…';
    try {
      const b64 = await blobToBase64(rec.blob);
      // 同时带上新旧两版 Apps Script 需要的字段（data / dataBase64、entryId）
      const payload = {
        token: DRIVE_UPLOAD_TOKEN,
        entryId: e.id,
        filename: fileName(e, rec),
        mimeType: rec.mime || 'audio/webm',
        data: b64,
        dataBase64: b64,
        meta: { id: e.id, hanzi: e.hanzi, ipa: e.ipa, variety: e.variety, speaker: e.speaker },
      };
      // text/plain 避免 CORS 预检，Apps Script 才能收到
      const res = await fetch(DRIVE_UPLOAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '上传失败');
      rec.driveUrl = j.url || j.viewUrl || '';
      await recPut(rec);
      renderAudio(e);
    } catch (err) {
      btn.disabled = false; btn.textContent = '重试上传';
      alert(`上传失败：${err.message || err}`);
    }
  }

  /* ---------- 选择词条 / 链接 ---------- */
  function select(id, push = true) {
    if (recorder && recorder.state === 'recording' && recEntryId !== id) stopRec();
    state.activeId = id;
    renderResults();
    renderEntry();
    if (push) {
      const u = new URL(location.href);
      if (id) u.searchParams.set('w', id); else u.searchParams.delete('w');
      history.replaceState(null, '', u);
    }
  }
  function entryText(e) {
    return [
      `${e.hanzi}${e.roman ? ` ${e.roman}` : ''}${e.ipa ? ` [${e.ipa}]` : ''}`,
      `${POS_LABEL[e.pos] || ''}${e.variety ? ` · ${e.variety}` : ''}`,
      ...e.senses.map((s, i) => `${i + 1}. ${s}`),
      ...e.examples.map((x) => `例：${x.text}${x.ipa ? ` [${x.ipa}]` : ''}${x.gloss ? ` — ${x.gloss}` : ''}`),
    ].filter(Boolean).join('\n');
  }
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      t.remove();
    }
    const old = btn.textContent; btn.textContent = '✓'; setTimeout(() => { btn.textContent = old; }, 900);
  }

  /* ---------- 筛选 chips ---------- */
  function renderVarietyChips() {
    const group = $('#varietyChips');
    const vs = [...new Set(state.entries.map((e) => e.variety).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    if (state.variety !== 'all' && !vs.includes(state.variety)) state.variety = 'all';
    group.innerHTML = `<span class="chip-label">乡镇</span>` +
      [['all', '全部'], ...vs.map((v) => [v, v])].map(([v, l]) => `<button class="chip${state.variety === v ? ' is-active' : ''}" data-variety="${esc(v)}">${esc(l)}</button>`).join('');
  }
  function bindChips() {
    $('#varietyChips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-variety]'); if (!b) return;
      state.variety = b.dataset.variety;
      $$('#varietyChips .chip').forEach((c) => c.classList.toggle('is-active', c === b));
      runSearch();
    });
    $('#posChips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-pos]'); if (!b) return;
      state.pos = b.dataset.pos;
      $$('#posChips .chip').forEach((c) => c.classList.toggle('is-active', c === b));
      runSearch();
    });
  }

  /* ---------- CSV ---------- */
  const CSV_COLS = ['id', 'hanzi', 'roman', 'ipa', 'pos', 'variety', 'senses', 'examples', 'tags', 'audio', 'notes', 'speaker'];
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    return rows.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }
  const csvCell = (v) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  function toCSV(list) {
    const lines = [CSV_COLS.join(',')];
    for (const e of list) {
      lines.push(CSV_COLS.map((k) => {
        let v = e[k];
        if (k === 'senses' || k === 'tags') v = v.join('||');
        if (k === 'examples') v = v.map((x) => [x.text, x.ipa, x.gloss].filter((p, i) => i !== 1 || p).join('::')).join('||');
        return csvCell(String(v ?? ''));
      }).join(','));
    }
    return '﻿' + lines.join('\r\n');
  }
  const clean = (e) => { const { _f, ...rest } = e; return rest; };

  function download(name, text, type) {
    const u = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: u, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- 数据管理 ---------- */
  function setEntries(list, source) {
    state.entries = normalizeAll(list).map(buildIndex);
    state.source = source;
    $('#heroStatus').textContent = `${state.entries.length} 条词条 · ${[...new Set(state.entries.map((e) => e.variety).filter(Boolean))].length} 个乡镇/村`;
    $('#resetStatus').textContent = `当前数据来源：${source === 'local' ? '本机浏览器（已导入）' : '仓库 data/dict.json'}`;
    renderVarietyChips();
    runSearch();
  }
  async function loadRepo() {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`读取 ${DATA_URL} 失败（${res.status}）`);
    const j = await res.json();
    return Array.isArray(j) ? j : (j.entries || []);
  }

  function bindManage() {
    $('#btnImport').addEventListener('click', async () => {
      const f = $('#fileImport').files[0];
      const st = $('#importStatus');
      if (!f) { st.textContent = '请先选择文件'; return; }
      try {
        const text = await f.text();
        let list;
        if (/\.csv$/i.test(f.name) || f.type.includes('csv')) list = parseCSV(text);
        else { const j = JSON.parse(text); list = Array.isArray(j) ? j : (j.entries || []); }
        const norm = normalizeAll(list);
        if (!norm.length) throw new Error('文件里没有可用的词条');
        if (!ls.set(LS_DATA, norm.map(clean))) throw new Error('浏览器存储空间不足');
        setEntries(norm, 'local');
        select(null);
        st.textContent = `已导入 ${norm.length} 条（${f.name}）`;
      } catch (err) { st.textContent = `导入失败：${err.message || err}`; }
    });
    $('#btnExport').addEventListener('click', () => {
      const out = { name: 'AYHAK 安远话词典', exported: today(), entries: state.entries.map(clean) };
      download(`ayhak-dict-${today()}.json`, JSON.stringify(out, null, 2), 'application/json');
      $('#exportStatus').textContent = `已导出 ${state.entries.length} 条`;
    });
    $('#btnExportCSV').addEventListener('click', () => {
      download(`ayhak-dict-${today()}.csv`, toCSV(state.entries), 'text/csv;charset=utf-8');
      $('#exportStatus').textContent = `已导出 ${state.entries.length} 条（CSV）`;
    });
    $('#btnClearAudio').addEventListener('click', async () => {
      if (!confirm('清空这个浏览器里保存的所有录音？已经上传到 Drive 的不受影响。')) return;
      try { await recClear(); $('#exportStatus').textContent = '本机录音已清空'; renderEntry(); }
      catch (err) { $('#exportStatus').textContent = `清空失败：${err.message || err}`; }
    });
    $('#btnReset').addEventListener('click', async () => {
      if (!confirm('丢掉本机导入的数据，回到仓库里的词典？')) return;
      ls.del(LS_DATA);
      try { setEntries(await loadRepo(), 'repo'); select(null); }
      catch (err) { $('#resetStatus').textContent = err.message; }
    });
  }

  function renderExamples() {
    const sample = [{
      id: 'vu-xa', hanzi: '屋下', roman: 'vu xa', ipa: 'vu⁴⁵.xɑ³⁴', pos: 'n', variety: '欣山镇',
      senses: ['家；家里'], examples: [{ text: '（例句）', ipa: '', gloss: '（普通话翻译）' }],
      tags: ['居住'], audio: 'audio/vu-xa.mp3', notes: '', speaker: '',
    }];
    $('#jsonExample').textContent = JSON.stringify({ entries: sample }, null, 2);
    $('#csvExample').textContent = toCSV(normalizeAll(sample)).replace(/^﻿/, '');
  }

  /* ---------- 启动 ---------- */
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    $('#toggleIPA').checked = state.showIPA;
    $('#toggleAudio').checked = state.showAudio;

    let q = null;
    const doSearch = () => { state.q = $('#q').value; runSearch(); };
    $('#q').addEventListener('input', () => { clearTimeout(q); q = setTimeout(doSearch, 120); });
    $('#q').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { doSearch(); if (state.shown[0]) select(state.shown[0].id); }
    });
    $('#btnSearch').addEventListener('click', () => { doSearch(); if (state.shown[0]) select(state.shown[0].id); });
    $('#results').addEventListener('click', (ev) => { const b = ev.target.closest('.result'); if (b) select(b.dataset.id); });

    $('#toggleIPA').addEventListener('change', (ev) => { state.showIPA = ev.target.checked; ls.set(LS_PREFS, { showIPA: state.showIPA, showAudio: state.showAudio }); renderResults(); renderEntry(); });
    $('#toggleAudio').addEventListener('change', (ev) => { state.showAudio = ev.target.checked; ls.set(LS_PREFS, { showIPA: state.showIPA, showAudio: state.showAudio }); renderEntry(); });
    $('#toggleStarred').addEventListener('change', (ev) => { state.starredOnly = ev.target.checked; runSearch(); });

    $('#btnStar').addEventListener('click', () => {
      const id = state.activeId; if (!id) return;
      state.stars.has(id) ? state.stars.delete(id) : state.stars.add(id);
      ls.set(LS_STARS, [...state.stars]);
      if (state.starredOnly) runSearch(); else renderResults();
      renderEntry();
    });
    $('#btnCopy').addEventListener('click', (ev) => {
      const e = state.entries.find((x) => x.id === state.activeId); if (e) copy(entryText(e), ev.currentTarget);
    });
    $('#btnLink').addEventListener('click', (ev) => {
      const u = new URL(location.href); u.hash = 'search'; copy(u.toString(), ev.currentTarget);
    });

    bindChips();
    bindManage();
    renderExamples();

    const local = ls.get(LS_DATA, null);
    try {
      if (Array.isArray(local) && local.length) setEntries(local, 'local');
      else setEntries(await loadRepo(), 'repo');
    } catch (err) {
      setEntries([], 'repo');
      $('#results').innerHTML = `<p class="none">${esc(err.message)}<br>如果是直接双击打开的 HTML 文件，请改用本地服务器（见 README）。</p>`;
    }

    const w = new URL(location.href).searchParams.get('w');
    if (w && state.entries.some((e) => e.id === w)) select(w, false);
    else if (state.shown[0]) select(state.shown[0].id, false);
  }

  window.addEventListener('beforeunload', stopRec);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
