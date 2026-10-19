/* =========================================================
   AYHAK · 安远话植物图集 — plants.js
   读取 data/plants.json，渲染卡片：多张照片（不同生长阶段）、
   叫法 + IPA + 录音、学名、环境和吃法，以及用它做的食物。
   二维码指向每种植物的网页锚点，供纸质版扫码听录音。
   ========================================================= */
(() => {
  'use strict';

  // 二维码要印在纸上，所以固定指向正式网址（仓库改名或换域名时改这里）
  const CANONICAL_URL = 'https://juan-zhong.github.io/ay_hak/plants.html';
  const DATA_URL = './data/plants.json';
  const CAT_ORDER = ['蔬菜', '野菜', '块根', '水果', '豆类', '花', '香料', '其他'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ͡]/g, '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹0-9.\[\]\/\s]/g, '');
  const pending = (label) => `<span class="tag pending">${esc(label)}待补</span>`;
  const ipa = (s) => (s ? `<span class="ipa">/${esc(s)}/</span>` : '');
  const playBtn = (src, label = '▶') => (src ? `<button class="play" data-play="${esc(src)}" aria-label="播放录音">${label}</button>` : '');

  const state = { plants: [], target: 22, cat: 'all', q: '' };

  function photos(p) {
    const list = (p.photos || (p.photo ? [{ src: p.photo }] : [])).filter((x) => x && x.src);
    if (!list.length) return '<div class="photo"><div class="nophoto">照片待补</div></div>';
    const [first] = list;
    return `
      <div class="photo"><img src="${esc(first.src)}" alt="${esc(first.caption || p.name)}" loading="lazy" data-main /></div>
      ${list.length > 1 ? `<div class="thumbs">${list.map((x, i) => `
        <button class="thumb${i ? '' : ' is-active'}" data-src="${esc(x.src)}" data-cap="${esc(x.caption || '')}" aria-label="${esc(x.caption || `照片 ${i + 1}`)}">
          <img src="${esc(x.src)}" alt="" loading="lazy" /></button>`).join('')}</div>` : ''}
      <p class="photo-cap small" data-cap>${esc(first.caption || '')}</p>`;
  }

  function derived(p) {
    const d = (p.derived || []).filter((x) => x && x.name);
    if (!d.length) return '';
    return `<h4>用${esc(p.name || p.mandarin)}做的</h4>
      <ul class="derived">${d.map((x) => `
        <li>
          ${x.photo ? `<img src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy" />` : '<span class="dph"></span>'}
          <span class="dname"><b>${esc(x.name)}</b> ${ipa(x.ipa)} ${playBtn(x.audio)}${x.gloss ? `<br><span class="small">${esc(x.gloss)}</span>` : ''}</span>
        </li>`).join('')}</ul>`;
  }

  function card(p) {
    const rows = [
      ['普通话', esc(p.mandarin)],
      ['学名', p.latin ? `<i>${esc(p.latin)}</i>` : ''],
      ['生长环境', esc(p.habitat)],
      ['季节', esc(p.season)],
      ['说法来源', esc(p.variety)],
    ].filter(([, v]) => v);
    return `
      <article class="plant" id="${esc(p.id)}">
        ${photos(p)}
        <div class="body">
          <div class="name">${esc(p.name || p.mandarin || '（未命名）')}${ipa(p.ipa)} ${playBtn(p.audio)}</div>
          ${p.gloss ? `<p class="gloss">${esc(p.gloss)}</p>` : ''}
          <div class="tags">
            <span class="tag">${esc(p.category || '其他')}</span>
            ${p.name ? '' : pending('安远话叫法')}
            ${p.ipa ? '' : pending('IPA ')}
            ${p.audio ? '' : pending('录音')}
          </div>
          ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
          ${p.uses ? `<p class="desc">${esc(p.uses)}</p>` : ''}
          ${derived(p)}
          ${p.notes ? `<p class="desc muted" style="font-size:14px;">${esc(p.notes)}</p>` : ''}
          <div class="foot">
            <button class="btn sm btn-ghost" data-link="${esc(p.id)}">复制链接</button>
            ${p.credit ? `<span class="small">${esc(p.credit)}</span>` : ''}
          </div>
          <div class="qr"><div class="qrbox" data-qr="${esc(p.id)}"></div><p class="small">扫码听发音<br>${esc(CANONICAL_URL)}#${esc(p.id)}</p></div>
        </div>
      </article>`;
  }

  function searchText(p) {
    const d = (p.derived || []).map((x) => `${x.name} ${x.ipa} ${x.gloss}`).join(' ');
    return norm(`${p.name} ${p.ipa} ${p.mandarin} ${p.latin} ${p.gloss} ${p.habitat} ${p.uses} ${p.notes} ${p.variety} ${d}`);
  }

  function render() {
    const nq = norm(state.q);
    const list = state.plants.filter((p) =>
      (state.cat === 'all' || (p.category || '其他') === state.cat) && (!nq || searchText(p).includes(nq)));
    $('#plantGrid').innerHTML = list.length ? list.map(card).join('') : '<p class="muted">没有找到。</p>';
    if (document.body.classList.contains('show-qr')) drawQR();
  }

  function drawQR() {
    if (typeof window.qrcode !== 'function') return;
    $$('[data-qr]').forEach((el) => {
      if (el.childElementCount) return;
      const qr = window.qrcode(0, 'M');
      qr.addData(`${CANONICAL_URL}#${el.dataset.qr}`);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    });
  }

  function renderCats() {
    const rank = (c) => { const i = CAT_ORDER.indexOf(c); return i < 0 ? 99 : i; };
    const cats = [...new Set(state.plants.map((p) => p.category || '其他'))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'zh-Hans-CN'));
    $('#catChips').innerHTML = '<span class="chip-label">类别</span>' +
      [['all', '全部'], ...cats.map((c) => [c, c])].map(([v, l]) => `<button class="chip${state.cat === v ? ' is-active' : ''}" data-cat="${esc(v)}">${esc(l)}</button>`).join('');
  }

  let player = null;
  function bind() {
    $('#pq').addEventListener('input', (ev) => { state.q = ev.target.value; render(); });
    $('#catChips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat;
      $$('#catChips .chip').forEach((c) => c.classList.toggle('is-active', c === b));
      render();
    });
    $('#toggleQR').addEventListener('change', (ev) => {
      document.body.classList.toggle('show-qr', ev.target.checked);
      if (ev.target.checked) drawQR();
    });
    $('#btnPrint').addEventListener('click', () => { drawQR(); setTimeout(() => window.print(), 150); });
    window.addEventListener('beforeprint', drawQR);

    $('#plantGrid').addEventListener('click', async (ev) => {
      const thumb = ev.target.closest('.thumb');
      if (thumb) {
        const cardEl = thumb.closest('.plant');
        const main = $('[data-main]', cardEl);
        main.src = thumb.dataset.src; main.alt = thumb.dataset.cap;
        $('[data-cap]', cardEl).textContent = thumb.dataset.cap;
        $$('.thumb', cardEl).forEach((t) => t.classList.toggle('is-active', t === thumb));
        return;
      }
      const play = ev.target.closest('[data-play]');
      if (play) {
        if (player) player.pause();
        player = new Audio(play.dataset.play);
        player.play().catch(() => alert('录音载入失败'));
        return;
      }
      const link = ev.target.closest('[data-link]');
      if (link) {
        const u = `${location.origin}${location.pathname}#${link.dataset.link}`;
        try { await navigator.clipboard.writeText(u); } catch { prompt('复制这个链接：', u); return; }
        const old = link.textContent; link.textContent = '已复制'; setTimeout(() => { link.textContent = old; }, 900);
      }
    });
  }

  async function init() {
    $('#year').textContent = new Date().getFullYear();
    bind();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`读取 ${DATA_URL} 失败（${res.status}）`);
      const j = await res.json();
      state.plants = (Array.isArray(j) ? j : j.plants || []).filter((p) => p && p.id);
      state.target = (!Array.isArray(j) && j.target) || state.plants.length;
      const words = state.plants.reduce((n, p) => n + (p.name ? 1 : 0) + (p.derived || []).length, 0);
      $('#plantStatus').textContent = `已上线 ${state.plants.length} / ${state.target} 种 · ${words} 个叫法 · 江西安远`;
      renderCats();
      render();
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch (err) {
      $('#plantGrid').innerHTML = `<p class="muted">${esc(err.message)}。如果是直接双击打开的 HTML 文件，请改用本地服务器（见 README）。</p>`;
    }
  }

  init();
})();
