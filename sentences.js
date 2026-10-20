/* =========================================================
   AYHAK · 实用安远话五百句 — sentences.js
   句子：data/sentences.json
   录音：Apps Script 后台（apps_script.gs）
     GET  ?action=list           公开的录音列表
     GET  ?action=audio&rid=…    一条公开录音（base64）
     POST {action:'sentence', …} 上传，进入“待审核”
   ========================================================= */
(() => {
  'use strict';

  // 和 app.js 用同一个 Apps Script 部署；换国内后台时只改这里
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycby7Poi19-pkfrG0Ey2JhF_GbiS4B6_CKcZ1sG6ThOta9kOYKsAh4uOnn4qDxfyB1HF5pw/exec';
  const MAX_SECONDS = 60;
  const MAX_BYTES = 3 * 1024 * 1024;
  const LS_ME = 'ayhak.sentences.me.v1';
  const LS_MINE = 'ayhak.sentences.mine.v1';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  const state = { cats: [], sentences: [], recs: {}, cat: 0, q: '', onlyEmpty: false, onlyHas: false, svc: 'loading' };

  /* ---------- 读数据 ---------- */
  async function loadSentences() {
    const j = await (await fetch('./data/sentences.json', { cache: 'no-cache' })).json();
    state.cats = j.categories || [];
    state.sentences = j.sentences || [];
    if (state.cats.length) state.cat = state.cats[0].id;   // 默认先显示第一类，不一次铺开五百句
  }
  // 已发布到网站的录音（放在仓库 audio/sentences/，国内也能播）
  async function loadStatic() {
    try {
      const j = await (await fetch('./data/recordings.json', { cache: 'no-cache' })).json();
      return (j.recordings || []).filter((r) => r && r.sid && r.file);
    } catch { return []; }
  }
  function addRecs(list) {
    list.forEach((r) => {
      const arr = (state.recs[r.sid] ||= []);
      if (!arr.some((x) => x.rid && x.rid === r.rid)) arr.push(r);
    });
  }
  async function loadRecordings() {
    state.recs = {};
    addRecs(await loadStatic());             // 先放网站上的，保证国内能听
    if (!ENDPOINT) { state.svc = 'off'; return; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${ENDPOINT}?action=list`, { signal: ctrl.signal });
      clearTimeout(t);
      const j = await res.json();
      if (!j.ok || !Array.isArray(j.recordings)) throw new Error(j.error || 'list');
      addRecs(j.recordings);                 // 再补上 Google 里已公开、还没发布到网站的
      state.svc = 'on';
    } catch {
      state.svc = 'down';
    }
  }

  /* ---------- 渲染 ---------- */
  function renderStatus() {
    const has = state.sentences.filter((s) => (state.recs[s.id] || []).length).length;
    const total = Object.values(state.recs).reduce((n, a) => n + a.length, 0);
    $('#sStatus').textContent = total ? `500 句 · 已有 ${has} 句有录音 · 共 ${total} 条录音` : '500 句';
    const note = {
      on: '',
      off: '录音功能还没有开通，现在可以先看句子。',
      down: '网站上的录音可以直接听。上传录音需要能打开 Google 的网络；在国内不方便上传的话，也可以把录音发邮件给我们。',
      loading: '',
    }[state.svc];
    $('#svcNote').textContent = note;
  }

  function renderCats() {
    const box = $('#catChips');
    box.innerHTML = [{ id: 0, name: '全部' }, ...state.cats].map((c) =>
      `<button class="chip${state.cat === c.id ? ' is-active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  }

  function matches(s) {
    if (state.cat && !state.q.trim() && s.cat !== state.cat) return false;   // 搜索时在全部五百句里找
    const n = (state.recs[s.id] || []).length;
    if (state.onlyEmpty && n) return false;
    if (state.onlyHas && !n) return false;
    if (state.q) {
      const q = state.q.trim();
      if (!(`${s.zh} ${s.hanzi} ${s.ipa} ${(state.recs[s.id] || []).map((r) => r.hanzi).join(' ')}`.includes(q) || String(s.n) === q)) return false;
    }
    return true;
  }

  function sentenceCard(s) {
    const recs = state.recs[s.id] || [];
    const mine = ls.get(LS_MINE, []).filter((m) => m.sid === s.id);
    return `<article class="sentence" id="${s.id}">
      <div class="s-head">
        <span class="s-no">${s.n}</span>
        <div class="s-text">
          <div class="s-zh">${esc(s.zh)}</div>
          ${s.hanzi || s.ipa ? `<div class="s-ay">${esc(s.hanzi)}${s.ipa ? ` <span class="ipa">[${esc(s.ipa)}]</span>` : ''}</div>` : ''}
        </div>
        <button class="btn sm${recs.length ? ' btn-ghost' : ' primary'}" data-rec="${s.id}">● 我来录</button>
      </div>
      ${recs.length ? `<div class="s-recs">${recs.map((r) => `
        <button class="rec-chip" data-rid="${esc(r.rid)}" aria-label="播放 ${esc(r.place)} 的录音">
          <span class="play-ico">▶</span><span>${esc(r.place)}${r.nick ? ` · ${esc(r.nick)}` : ''}</span>
        </button>${r.hanzi ? `<span class="small rec-hz">${esc(r.hanzi)}</span>` : ''}`).join('')}</div>` : ''}
      ${mine.length ? `<p class="small mine">你已提交 ${mine.length} 条录音，审核后会出现在这里。</p>` : ''}
    </article>`;
  }

  function renderList() {
    const list = state.sentences.filter(matches);
    $('#listMeta').textContent = `显示 ${list.length} 句`;
    const box = $('#sentenceList');
    if (!list.length) { box.innerHTML = '<p class="muted">没有找到。</p>'; return; }
    // 按类别分组显示
    const byCat = new Map();
    list.forEach((s) => { if (!byCat.has(s.cat)) byCat.set(s.cat, []); byCat.get(s.cat).push(s); });
    box.innerHTML = [...byCat].map(([cid, ss]) => {
      const c = state.cats.find((x) => x.id === cid) || { name: '' };
      return `<h3 class="cat-title">${esc(c.name)}</h3>${ss.map(sentenceCard).join('')}`;
    }).join('');
  }

  /* ---------- 点播 ---------- */
  const audioCache = new Map();
  let player = null;
  async function play(btn) {
    const rid = btn.dataset.rid;
    if (player) player.pause();
    $$('.rec-chip.playing').forEach((b) => b.classList.remove('playing'));
    btn.classList.add('loading');
    try {
      const r = Object.values(state.recs).flat().find((x) => x.rid === rid);
      let url = r && r.file ? r.file : audioCache.get(rid);
      if (!url) {
        const j = await (await fetch(`${ENDPOINT}?action=audio&rid=${encodeURIComponent(rid)}`)).json();
        if (!j.ok) throw new Error(j.error || '读取失败');
        const bin = Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0));
        url = URL.createObjectURL(new Blob([bin], { type: j.mime || 'audio/webm' }));
        audioCache.set(rid, url);
      }
      player = new Audio(url);
      btn.classList.add('playing');
      player.onended = () => btn.classList.remove('playing');
      await player.play();
    } catch (err) {
      alert(`播放失败：${err.message || err}`);
    } finally {
      btn.classList.remove('loading');
    }
  }

  /* ---------- 录音面板 ---------- */
  let cur = null;          // 当前句子
  let rec = null;          // MediaRecorder
  let chunks = [];
  let blob = null;
  let timer = null;
  let started = 0;

  function openSheet(sid) {
    cur = state.sentences.find((s) => s.id === sid);
    if (!cur) return;
    if (state.svc !== 'on') {
      if (confirm('现在连不上上传服务（在国内需要能打开 Google 的网络）。\n要改成发邮件寄录音吗？')) {
        location.href = `mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 五百句 ${cur.n}：${cur.zh}`)}&body=${encodeURIComponent(`句子 ${cur.n}：${cur.zh}\n\n我的乡镇或村：\n昵称（可不填）：\n同意在网站上公开：是 / 否\n同意用于研究：是 / 否\n\n（请把录音作为附件）`)}`;
      }
      return;
    }
    blob = null;
    $('#sheetNo').textContent = `第 ${cur.n} 句`;
    $('#sheetTitle').textContent = cur.zh;
    $('#recPreview').hidden = true; $('#recPreview').removeAttribute('src');
    $('#recMsg').textContent = '';
    $('#recTime').textContent = '';
    $('#recLabel').textContent = '按一下开始录';
    $('#recBtn').classList.remove('on');
    const f = $('#recForm');
    f.reset();
    const me = ls.get(LS_ME, {});
    f.place.value = me.place || ''; f.nick.value = me.nick || '';
    updateSubmit();
    $('#sheet').hidden = false;
    document.body.classList.add('sheet-open');
  }
  function closeSheet() {
    stopRec();
    $('#sheet').hidden = true;
    document.body.classList.remove('sheet-open');
  }
  function updateSubmit() {
    const f = $('#recForm');
    $('#recSubmit').disabled = !(blob && f.place.value.trim() && f.consentPublic.checked);
  }
  function setBlob(b) {
    if (b.size > MAX_BYTES) { $('#recMsg').textContent = '录音太长了，请控制在一分钟以内。'; return; }
    blob = b;
    const p = $('#recPreview');
    p.src = URL.createObjectURL(b); p.hidden = false;
    $('#recMsg').textContent = '先听一遍，没问题就填好下面的信息提交。';
    updateSubmit();
  }

  async function startRec() {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      $('#recMsg').textContent = '这个浏览器不能直接录音，请用下面的“上传手机里的录音”。微信里打不开录音的话，点右上角用浏览器打开。';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t));
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer);
        $('#recBtn').classList.remove('on');
        $('#recLabel').textContent = '重录';
        setBlob(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        rec = null;
      };
      rec.start();
      started = Date.now();
      $('#recBtn').classList.add('on');
      $('#recLabel').textContent = '录好了，按一下停止';
      timer = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        $('#recTime').textContent = `${s} 秒`;
        if (s >= MAX_SECONDS) stopRec();
      }, 250);
    } catch (err) {
      $('#recMsg').textContent = `打不开麦克风：${err.message || err}。请允许浏览器使用麦克风，或用下面的上传。`;
    }
  }
  function stopRec() { if (rec && rec.state === 'recording') rec.stop(); }

  function b64(b) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(r.error);
      r.readAsDataURL(b);
    });
  }
  async function submit(ev) {
    ev.preventDefault();
    const f = ev.target;
    if (!blob) return;
    const btn = $('#recSubmit'); btn.disabled = true;
    $('#recMsg').textContent = '上传中…';
    try {
      const payload = {
        action: 'sentence', sid: cur.id, zh: cur.zh,
        place: f.place.value.trim(), nick: f.nick.value.trim(), hanzi: f.hanzi.value.trim(),
        consentPublic: f.consentPublic.checked, consentResearch: f.consentResearch.checked,
        website: f.website.value,
        mimeType: blob.type || 'audio/webm', data: await b64(blob),
      };
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      let j; try { j = JSON.parse(await res.text()); } catch { throw new Error('录音后台没有正常回应（Apps Script 部署的访问权限需要设成“任何人”）'); }
      if (!j.ok) throw new Error(j.error || '上传失败');
      ls.set(LS_ME, { place: payload.place, nick: payload.nick });
      const mine = ls.get(LS_MINE, []); mine.push({ sid: cur.id, rid: j.rid, at: Date.now() }); ls.set(LS_MINE, mine);
      $('#recMsg').innerHTML = `收到了，谢谢！录音编号 <b>${esc(j.rid)}</b>，审核后会公开在这一句下面。`;
      renderList();
      setTimeout(closeSheet, 2200);
    } catch (err) {
      $('#recMsg').textContent = `上传失败：${err instanceof TypeError ? '连不上录音后台。可能是后台的访问权限没有设成“任何人”，或者当前网络打不开 Google。' : (err.message || err)}`;
      btn.disabled = false;
    }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $('#catChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = Number(b.dataset.cat); renderCats(); renderList();
    });
    let t = null;
    $('#sq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; renderList(); }, 150); });
    $('#onlyEmpty').addEventListener('change', (e) => { state.onlyEmpty = e.target.checked; if (e.target.checked) { $('#onlyHas').checked = false; state.onlyHas = false; } renderList(); });
    $('#onlyHas').addEventListener('change', (e) => { state.onlyHas = e.target.checked; if (e.target.checked) { $('#onlyEmpty').checked = false; state.onlyEmpty = false; } renderList(); });
    $('#sentenceList').addEventListener('click', (e) => {
      const r = e.target.closest('[data-rec]'); if (r) { openSheet(r.dataset.rec); return; }
      const p = e.target.closest('[data-rid]'); if (p) play(p);
    });
    $('#sheetClose').addEventListener('click', closeSheet);
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
    $('#recBtn').addEventListener('click', () => (rec ? stopRec() : startRec()));
    $('#recFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) setBlob(f); });
    $('#recForm').addEventListener('input', updateSubmit);
    $('#recForm').addEventListener('change', updateSubmit);
    $('#recForm').addEventListener('submit', submit);
  }

  async function init() {
    bind();
    try { await loadSentences(); } catch { $('#sentenceList').innerHTML = '<p class="muted">句子读取失败，请刷新。</p>'; return; }
    renderCats(); renderList(); renderStatus();
    await loadRecordings();
    renderStatus(); renderList();
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
  init();
})();
