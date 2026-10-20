/* =========================================================
   AYHAK · 安远话植物图集 — plants.js
   数据：data/plants.json
   plants.html：整本照片书（封面、目录、图集、文章页），这里只负责
                目录里的植物、图集里的照片排列。
   plant.html?id=shu：一种植物的几个跨页（大图、叫法和录音、
                不同阶段的照片、用它做的东西、资料信息）。
   二维码（管理模式 ?admin=1）指向 plant.html?id=…，供纸质版扫码听录音。
   ========================================================= */
(() => {
  'use strict';

  const SITE = 'https://juan-zhong.github.io/ay_hak/';
  const DATA_URL = './data/plants.json';
  const BOOK_PAGES = 13;           // plants.html 的最后一页页码，植物页从下一页开始编

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ipa = (s) => (s ? `<span class="ipa">/${esc(s)}/</span>` : '');
  const no = (i) => String(i + 1).padStart(2, '0');
  const playBtn = (src, cls = '') => (src ? `<button class="play ${cls}" data-play="${esc(src)}" aria-label="播放录音">▶</button>` : '');

  // 管理模式：网址加 ?admin=1 打开（二维码、打印），?admin=0 关闭
  try {
    const v = new URL(location.href).searchParams.get('admin');
    if (v === '1') localStorage.setItem('ayhak.admin', '1');
    if (v === '0') localStorage.removeItem('ayhak.admin');
    if (localStorage.getItem('ayhak.admin') === '1') document.documentElement.classList.add('admin');
  } catch { /* 无法存储时忽略 */ }

  const photosOf = (p) => (p.photos || (p.photo ? [{ src: p.photo }] : [])).filter((x) => x && x.src);
  const derivedOf = (p) => (p.derived || []).filter((x) => x && x.name);

  /* ---------- 一种植物分成哪几页 ---------- */
  function pagesOf(p, i, total) {
    const ph = photosOf(p);
    const d = derivedOf(p);
    const pages = ['plate', 'name'];
    if (ph.length > 1) pages.push('stages');
    if (d.length) pages.push('made');
    pages.push('info');
    if (pages.length % 2) pages.push('blank');   // 凑成整跨页
    return pages;
  }
  function startPages(plants) {
    let n = BOOK_PAGES + 1;
    return plants.map((p, i) => { const s = n; n += pagesOf(p, i).length; return s; });
  }

  /* ---------- plants.html：目录和图集 ---------- */
  function renderIndex(plants, target) {
    const starts = startPages(plants);
    const words = plants.reduce((n, p) => n + (p.name ? 1 : 0) + derivedOf(p).length, 0);
    const st = $('#plantStatus');
    if (st) st.textContent = `已上线 ${plants.length} / ${target} 种 · ${words} 个叫法`;
    const tc = $('#tocCount');
    if (tc) tc.textContent = `${plants.length} 种`;
    const toc = $('#tocPlants');
    if (toc) {
      toc.innerHTML = plants.map((p, i) => `<li><a href="./plant.html?id=${encodeURIComponent(p.id)}">
        <span class="n">${no(i)}</span><b>${esc(p.name || p.mandarin)}</b><span class="sub">${esc(p.mandarin && p.mandarin !== p.name ? p.mandarin : '')}</span>
        <span class="dots"></span><span class="pg">${starts[i]}</span></a></li>`).join('');
    }
    const grid = $('#plantGrid');
    if (!grid) return;
    grid.innerHTML = plants.map((p, i) => {
      const ph = photosOf(p)[0];
      return `<a href="./plant.html?id=${encodeURIComponent(p.id)}" data-i="${i}">
        <div class="ph">${ph ? `<img src="${esc(ph.src)}" alt="${esc(p.name)}" loading="lazy" />` : ''}</div>
        <div class="nm"><span class="no">${no(i)}</span><b>${esc(p.name || '')}</b>
          ${p.mandarin ? `<span class="zh">${esc(p.mandarin)}</span>` : ''}
          ${p.latin ? `<span class="lat">${esc(p.latin)}</span>` : ''}</div>
      </a>`;
    }).join('');
  }

  /* ---------- plant.html：一种植物的跨页 ---------- */
  function page(kind, p, i, n, cls = '') {
    const ph = photosOf(p);
    const d = derivedOf(p);
    const head = `<div class="runhead"><span>安远话植物图集</span><span>No. ${no(i)} · ${esc(p.category || '其他')}</span></div>`;
    const folio = `<span class="folio">${n}</span>`;
    if (kind === 'plate') {
      const f = ph[0];
      return `<div class="page ${cls}">${head}
        <figure class="plate fill"><div class="ph">${f ? `<img src="${esc(f.src)}" alt="${esc(f.caption || p.name)}" />` : '<p class="pending">照片待补</p>'}</div>
          ${f ? `<figcaption><span class="no">图 1</span>${esc(f.caption || p.name)}</figcaption>` : ''}</figure>${folio}</div>`;
    }
    if (kind === 'name') {
      const rows = [
        ['普通话', esc(p.mandarin)],
        ['学名', p.latin ? `<i>${esc(p.latin)}</i>` : '<span class="pending">待鉴定</span>'],
        ['说法来源', p.variety ? esc(p.variety) : '<span class="pending">待补</span>'],
        ['生长环境', esc(p.habitat)],
        ['季节', esc(p.season)],
      ].filter(([, v]) => v);
      return `<div class="page center ${cls}">${head}
        <p class="label">Plate ${no(i)}</p>
        <h1 class="p-name">${esc(p.name || p.mandarin)}</h1>
        <div class="p-ipa">${ipa(p.ipa) || '<span class="pending">IPA 待补</span>'} ${p.audio ? playBtn(p.audio) : '<span class="pending">录音待补</span>'}</div>
        ${p.gloss ? `<p>${esc(p.gloss)}</p>` : ''}
        <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        ${folio}</div>`;
    }
    if (kind === 'stages') {
      return `<div class="page ${cls}">${head}
        <p class="label">Look · 看植物</p>
        <div class="stages">${ph.slice(1).map((x, k) => `<figure class="plate"><img src="${esc(x.src)}" alt="${esc(x.caption || '')}" loading="lazy" />
          <figcaption><span class="no">图 ${k + 2}</span>${esc(x.caption || '')}</figcaption></figure>`).join('')}</div>
        ${folio}</div>`;
    }
    if (kind === 'made') {
      return `<div class="page ${cls}">${head}
        <p class="label">Kitchen · 用${esc(p.name || p.mandarin)}做的</p>
        <ul class="made">${d.map((x) => `<li>
          ${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy" />` : '<div></div>'}
          <div><b>${esc(x.name)}</b>${ipa(x.ipa)} ${playBtn(x.audio, 'sm')}${x.gloss ? `<p class="small" style="margin:6px 0 0">${esc(x.gloss)}</p>` : ''}</div>
        </li>`).join('')}</ul>${folio}</div>`;
    }
    if (kind === 'info') {
      const rows = [
        ['摄影', esc((p.credit || '').replace(/^摄影：/, ''))],
        ['说法来源', esc(p.variety)],
        ['授权', '照片和录音按发音人授权使用，未经许可请勿转载'],
      ].filter(([, v]) => v);
      return `<div class="page bottom ${cls}">${head}
        ${p.uses ? `<p class="label">Use · 在安远怎么用</p><p>${esc(p.uses)}</p>` : ''}
        ${p.notes ? `<p class="small">${esc(p.notes)}</p>` : ''}
        <p class="label" style="margin-top:18px">Record · 资料信息</p>
        <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="small">你们那里怎么叫？<a class="ulink" href="mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 植物图集：${p.name || p.id}`)}">发邮件告诉我们</a></p>
        <div class="qr"><div class="qrbox" data-qr="${esc(p.id)}"></div><p class="small">扫码听发音<br>${esc(SITE)}plant.html?id=${esc(p.id)}</p></div>
        ${folio}</div>`;
    }
    return `<div class="page blank ${cls}"><span class="endmark">AYHAK · 安远话植物图集</span>${folio}</div>`;   // 留白页
  }

  function renderPlant(plants) {
    const id = new URL(location.href).searchParams.get('id');
    const i = Math.max(0, plants.findIndex((p) => p.id === id));
    const p = plants[i];
    const start = startPages(plants)[i];
    document.title = `${p.name || p.mandarin} · 安远话植物图集 · AYHAK`;
    const kinds = pagesOf(p, i);
    let html = '';
    for (let k = 0; k < kinds.length; k += 2) {
      html += `<section class="spread${k + 2 >= kinds.length ? ' last' : ''}">${page(kinds[k], p, i, start + k)}${page(kinds[k + 1], p, i, start + k + 1)}</section>`;
    }
    $('#plant').innerHTML = html;
    const prev = plants[i - 1], next = plants[i + 1];
    $('#turn').innerHTML = `
      ${prev ? `<a href="./plant.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}
      <a href="./plants.html#plates">目录</a>
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
    player.play().catch(() => alert('录音载入失败'));
  });

  async function init() {
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    let plants = [], target = 22;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`读取 ${DATA_URL} 失败（${res.status}）`);
      const j = await res.json();
      plants = (Array.isArray(j) ? j : j.plants || []).filter((p) => p && p.id);
      target = (!Array.isArray(j) && j.target) || plants.length;
    } catch (err) {
      const box = $('#plantGrid') || $('#plant');
      if (box) box.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
      return;
    }
    if (document.body.classList.contains('book-plant')) {
      renderPlant(plants);
      $('#toggleQR')?.addEventListener('change', (e) => { document.body.classList.toggle('show-qr', e.target.checked); if (e.target.checked) drawQR(); });
      $('#btnPrint')?.addEventListener('click', () => { drawQR(); setTimeout(() => window.print(), 150); });
      window.addEventListener('beforeprint', drawQR);
    } else {
      // 旧的纸质版二维码指向 plants.html#shu：直接翻到那一页
      const h = decodeURIComponent(location.hash.slice(1));
      if (h && plants.some((p) => p.id === h)) { location.replace(`./plant.html?id=${encodeURIComponent(h)}`); return; }
      renderIndex(plants, target);
    }
  }
  init();
})();
