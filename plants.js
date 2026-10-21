/* =========================================================
   AYHAK · 安远话植物图集 — plants.js
   数据：data/plants.json（中文字段 + 可选的 *_en 英文字段）
   plants.html：整本照片书（封面、目录、图集、文章页），这里只负责
                目录里的植物、图集里的照片排列。
   plant.html?id=shu：一种植物的几个跨页（大图、叫法和录音、
                不同阶段的照片、用它做的东西、资料信息）。
   语言：中文为主，可切换 English（?lang=en 或页面右上角）。两种语言
         共用同一份植物数据；安远话名称、IPA、学名不翻译。
   二维码（管理模式 ?admin=1）指向 plant.html?id=…，供纸质版扫码听录音。
   ========================================================= */
(() => {
  'use strict';

  const SITE = 'https://juan-zhong.github.io/ay_hak/';
  const DATA_URL = './data/plants.json';
  const BOOK_PAGES = 15;           // plants.html 的最后一页页码，植物页从下一页开始编
  const CAT_EN = { 块根: 'Roots & tubers', 野菜: 'Wild greens', 蔬菜: 'Vegetables', 花: 'Flowers', 水果: 'Fruit', 豆类: 'Legumes', 香料: 'Herbs & spices', 其他: 'Other' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ipa = (s) => (s ? `<span class="ipa">/${esc(s)}/</span>` : '');
  const no = (i) => String(i + 1).padStart(2, '0');
  // 发音按钮：喇叭图标。有录音就能点，没有录音时灰掉并提示“录音待补”
  const SPEAKER = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false"><path d="M4 9.2v5.6h3.6L12.5 19V5L7.6 9.2H4z" fill="currentColor"/><path d="M15.6 8.6a4.6 4.6 0 0 1 0 6.8M18.2 6a8.3 8.3 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const AUDIO = new Map();          // 词典编号 → 录音
  const sayBtn = (dictId, src, cls = '') => {
    const a = src || AUDIO.get(dictId) || '';
    return a
      ? `<button type="button" class="say ${cls}" data-play="${esc(a)}" aria-label="${t('听发音', 'Listen')}" title="${t('听发音', 'Listen')}">${SPEAKER}</button>`
      : `<button type="button" class="say ${cls}" disabled aria-label="${t('录音待补', 'Recording pending')}" title="${t('录音待补', 'Recording pending')}">${SPEAKER}</button>`;
  };
  // 叫法链接到词典里的词
  const word = (name, dictId) => (dictId ? `<a class="dict-link" href="./dict.html?w=${encodeURIComponent(dictId)}" title="${t('在词典里查', 'Look up in the dictionary')}">${esc(name)}</a>` : esc(name));

  /* ---------- 语言 ---------- */
  const lang = () => (document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh');
  const t = (zh, en) => (lang() === 'en' ? en : zh);
  const field = (o, k) => (lang() === 'en' && o[`${k}_en`]) || o[k] || '';
  const cat = (p) => t(p.category || '其他', CAT_EN[p.category] || p.category || 'Other');
  const pending = (zh, en) => `<span class="pending">${t(zh, en)}</span>`;
  function setLang(l, rerender) {
    document.documentElement.setAttribute('data-lang', l);
    document.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'zh-CN');
    try { localStorage.setItem('ayhak.plants.lang', l); } catch { /* ignore */ }
    if (rerender) rerender();
  }
  (() => {
    let l = null;
    try { l = new URL(location.href).searchParams.get('lang') || localStorage.getItem('ayhak.plants.lang'); } catch { /* ignore */ }
    setLang(l === 'en' ? 'en' : 'zh');
  })();

  // 管理模式：网址加 ?admin=1 打开（二维码、打印），?admin=0 关闭
  try {
    const v = new URL(location.href).searchParams.get('admin');
    if (v === '1') localStorage.setItem('ayhak.admin', '1');
    if (v === '0') localStorage.removeItem('ayhak.admin');
    if (localStorage.getItem('ayhak.admin') === '1') document.documentElement.classList.add('admin');
  } catch { /* 无法存储时忽略 */ }

  const photosOf = (p) => (p.photos || (p.photo ? [{ src: p.photo }] : [])).filter((x) => x && x.src);
  const derivedOf = (p) => (p.derived || []).filter((x) => x && x.name);
  const latin = (p) => (p.latin ? `<i class="lat">${esc(p.latin)}</i>` : pending('待鉴定', 'identification pending'));

  /* ---------- 一种植物分成哪几页 ---------- */
  function pagesOf(p) {
    const pages = ['plate', 'name'];
    if (photosOf(p).length > 1) pages.push('stages');
    if (derivedOf(p).length) pages.push('made');
    pages.push('info');
    if (pages.length % 2) pages.push('blank');   // 凑成整跨页
    return pages;
  }
  function startPages(plants) {
    let n = BOOK_PAGES + 1;
    return plants.map((p) => { const s = n; n += pagesOf(p).length; return s; });
  }

  /* ---------- plants.html：目录和图集 ---------- */
  function renderIndex(plants, target) {
    const starts = startPages(plants);
    const words = plants.reduce((n, p) => n + (p.name ? 1 : 0) + derivedOf(p).length, 0);
    const st = $('#plantStatus');
    if (st) st.textContent = t(`已上线 ${plants.length} / ${target} 种 · ${words} 个叫法`, `${plants.length} of ${target} plants online · ${words} names`);
    const tc = $('#tocCount');
    if (tc) tc.textContent = t(`${plants.length} 种`, `${plants.length} plants`);
    const toc = $('#tocPlants');
    if (toc) {
      toc.innerHTML = plants.map((p, i) => `<li><a href="./plant.html?id=${encodeURIComponent(p.id)}">
        <span class="n">${no(i)}</span><b>${esc(p.name || p.mandarin)}</b>${p.ipa ? `<span class="sub">${ipa(p.ipa)}</span>` : ''}
        <span class="dots"></span><span class="pg">${starts[i]}</span></a></li>`).join('');
    }
    const grid = $('#plantGrid');
    if (!grid) return;
    // 当地名称、照片、发音为主；学名辅助，没有就写“待鉴定”
    grid.innerHTML = plants.map((p, i) => {
      const ph = photosOf(p)[0];
      return `<div class="item">
        <a class="ph" href="./plant.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">${ph ? `<img src="${esc(ph.src)}" alt="${esc(p.name)}" loading="lazy" />` : ''}</a>
        <div class="nm"><span class="no">${no(i)}</span><b>${word(p.name || '', p.dict)}</b>${ipa(p.ipa)}${sayBtn(p.dict, p.audio, 'sm')}</div>
        <div class="nm2">${latin(p)}${field(p, 'mandarin') ? ` · <span>${esc(field(p, 'mandarin'))}</span>` : ''}</div>
      </div>`;
    }).join('');
  }

  /* ---------- plant.html：一种植物的跨页 ---------- */
  function page(kind, p, i, n) {
    const ph = photosOf(p);
    const d = derivedOf(p);
    const head = `<div class="runhead"><span>安远话植物图集</span><span>No. ${no(i)} · ${esc(cat(p))}</span></div>`;
    const folio = `<span class="folio">${n}</span>`;
    const fig = (k) => t(`图 ${k}`, `Fig. ${k}`);
    if (kind === 'plate') {
      const f = ph[0];
      return `<div class="page">${head}
        <figure class="plate fill"><div class="ph">${f ? `<img src="${esc(f.src)}" alt="${esc(f.caption || p.name)}" />` : pending('照片待补', 'photo pending')}</div>
          ${f ? `<figcaption><span class="no">${fig(1)}</span>${esc(field(f, 'caption') || p.name)}</figcaption>` : ''}</figure>${folio}</div>`;
    }
    if (kind === 'name') {
      const rows = [
        [t('普通话', 'Mandarin'), esc(field(p, 'mandarin'))],
        [t('学名', 'Scientific name'), latin(p)],
        [t('说法来源', 'Where said'), p.variety ? esc(p.variety) : pending('待补', 'pending')],
        [t('生长环境', 'Habitat'), esc(field(p, 'habitat'))],
        [t('季节', 'Season'), esc(field(p, 'season'))],
      ].filter(([, v]) => v);
      return `<div class="page center">${head}
        <p class="label">Plate ${no(i)}</p>
        <h1 class="p-name">${word(p.name || p.mandarin, p.dict)}</h1>
        <p class="p-sub">Local name · Pronunciation · Botanical identification</p>
        <div class="p-ipa">${ipa(p.ipa) || pending('IPA 待补', 'IPA pending')} ${sayBtn(p.dict, p.audio)}${(p.audio || AUDIO.get(p.dict)) ? '' : pending('录音待补', 'recording pending')}</div>
        ${p.dict ? `<p class="small"><a class="ulink" href="./dict.html?w=${encodeURIComponent(p.dict)}">${t('在词典里查这个词 →', 'See this word in the dictionary →')}</a></p>` : ''}
        ${field(p, 'gloss') ? `<p>${esc(field(p, 'gloss'))}</p>` : ''}
        <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${folio}</div>`;
    }
    if (kind === 'stages') {
      return `<div class="page">${head}
        <p class="label">Look · ${t('看植物', 'the plant')}</p>
        <div class="stages">${ph.slice(1).map((x, k) => `<figure class="plate"><img src="${esc(x.src)}" alt="${esc(x.caption || '')}" loading="lazy" />
          <figcaption><span class="no">${fig(k + 2)}</span>${esc(field(x, 'caption'))}</figcaption></figure>`).join('')}</div>
        ${folio}</div>`;
    }
    if (kind === 'made') {
      return `<div class="page">${head}
        <p class="label">Kitchen · ${t(`用${esc(p.name || p.mandarin)}做的`, `made with ${esc(p.name)}`)}</p>
        <ul class="made">${d.map((x) => `<li>
          ${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy" />` : '<div></div>'}
          <div><b>${word(x.name, x.dict)}</b>${ipa(x.ipa)} ${sayBtn(x.dict, x.audio, 'sm')}${field(x, 'gloss') ? `<p class="small" style="margin:6px 0 0">${esc(field(x, 'gloss'))}</p>` : ''}</div>
        </li>`).join('')}</ul>${folio}</div>`;
    }
    if (kind === 'info') {
      const rows = [
        [t('摄影', 'Photographs'), esc((p.credit || '').replace(/^摄影：/, ''))],
        [t('说法来源', 'Where said'), esc(p.variety)],
        [t('授权', 'Permissions'), t('照片和录音按发音人授权使用，未经许可请勿转载', 'Photographs and recordings are used with speakers’ consent; please do not republish without permission')],
      ].filter(([, v]) => v);
      return `<div class="page bottom">${head}
        ${field(p, 'uses') ? `<p class="label">Use · ${t('在安远怎么用', 'in Anyuan')}</p><p>${esc(field(p, 'uses'))}</p>` : ''}
        ${field(p, 'notes') ? `<p class="small">${esc(field(p, 'notes'))}</p>` : ''}
        <p class="label" style="margin-top:18px">Record · ${t('资料信息', 'details')}</p>
        <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="small">${t('你们那里怎么叫？', 'Is it called something else where you are from?')} <a class="ulink" href="mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 植物图集：${p.name || p.id}`)}">${t('发邮件告诉我们', 'Email us')}</a></p>
        <div class="qr"><div class="qrbox" data-qr="${esc(p.id)}"></div><p class="small">${t('扫码听发音', 'Scan to listen')}<br>${esc(SITE)}plant.html?id=${esc(p.id)}</p></div>
        ${folio}</div>`;
    }
    return `<div class="page blank"><span class="endmark">AYHAK · 安远话植物图集</span>${folio}</div>`;   // 留白页
  }

  function renderPlant(plants) {
    const id = new URL(location.href).searchParams.get('id');
    const i = Math.max(0, plants.findIndex((p) => p.id === id));
    const p = plants[i];
    const start = startPages(plants)[i];
    document.title = `${p.name || p.mandarin} · ${t('安远话植物图集', 'Plants and Plant Knowledge in Anyuan Hakka')} · AYHAK`;
    const kinds = pagesOf(p);
    let html = '';
    for (let k = 0; k < kinds.length; k += 2) {
      html += `<section class="spread${k + 2 >= kinds.length ? ' last' : ''}">${page(kinds[k], p, i, start + k)}${page(kinds[k + 1], p, i, start + k + 1)}</section>`;
    }
    $('#plant').innerHTML = html;
    if (document.body.classList.contains('show-qr')) drawQR();
    const prev = plants[i - 1], next = plants[i + 1];
    $('#turn').innerHTML = `
      ${prev ? `<a href="./plant.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}
      <a href="./plants.html#plates">${t('目录', 'Contents')}</a>
      ${next ? `<a href="./plant.html?id=${encodeURIComponent(next.id)}">${esc(next.name)} →</a>` : '<span></span>'}`;
  }

  function drawQR() {
    if (typeof window.qrcode !== 'function') return;
    $$('[data-qr]').forEach((el) => {
      if (el.childElementCount) return;
      const qr = window.qrcode(0, 'M');
      qr.addData(`${SITE}plant.html?id=${el.dataset.qr}`);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    });
  }

  let player = null;
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-play]');
    if (!b) return;
    if (player) player.pause();
    player = new Audio(b.dataset.play);
    player.play().catch(() => alert(t('录音载入失败', 'Could not load the recording')));
  });

  async function init() {
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    let plants = [], target = 22;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(DATA_URL, { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${DATA_URL} ${res.status}`);
      const j = await res.json();
      plants = (Array.isArray(j) ? j : j.plants || []).filter((p) => p && p.id);
      target = (!Array.isArray(j) && j.target) || plants.length;
      // 录音：先用图集里的，没有再用词典里的
      try {
        const dj = await (await fetch('./data/dict.json', { cache: 'no-cache' })).json();
        (Array.isArray(dj) ? dj : dj.entries || []).forEach((e) => { if (e && e.id && e.audio) AUDIO.set(e.id, e.audio); });
      } catch { /* 词典读不到就只用图集里的录音 */ }
      plants.forEach((p) => {
        if (p.dict && p.audio) AUDIO.set(p.dict, p.audio);
        derivedOf(p).forEach((x) => { if (x.dict && x.audio) AUDIO.set(x.dict, x.audio); });
      });
    } catch (err) {
      const box = $('#plantGrid') || $('#plant');
      if (box) box.innerHTML = `<p class="muted">${t('图集没有载入成功', 'The atlas could not be loaded')}（${esc(err.message)}）。${t('请刷新页面再试一次。', 'Please refresh the page.')}</p>`;
      return;
    }
    const isPlant = document.body.classList.contains('book-plant');
    if (!isPlant) {
      // 旧的纸质版二维码指向 plants.html#shu：直接翻到那一页
      const h = decodeURIComponent(location.hash.slice(1));
      if (h && plants.some((p) => p.id === h)) { location.replace(`./plant.html?id=${encodeURIComponent(h)}`); return; }
    }
    const statics = () => $$('[data-say]').forEach((el) => { el.innerHTML = sayBtn(el.dataset.say, '', 'sm'); });
    const render = () => { if (isPlant) renderPlant(plants); else { renderIndex(plants, target); statics(); } };
    $$('[data-setlang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.setlang, render)));
    render();
    if (isPlant) {
      $('#toggleQR')?.addEventListener('change', (e) => { document.body.classList.toggle('show-qr', e.target.checked); if (e.target.checked) drawQR(); });
      $('#btnPrint')?.addEventListener('click', () => { drawQR(); setTimeout(() => window.print(), 150); });
      window.addEventListener('beforeprint', drawQR);
    }
  }
  init();
})();
