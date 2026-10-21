/* =========================================================
   AYHAK · 安远话植物图集 — plants.js
   数据：data/plants.json（中文字段 + 可选 *_en 英文字段）
   plants.html：田野图册首页，这里负责“图集”照片网格。
   plant.html?id=shu：一种植物的小型 photo essay：
       认识这种植物（标本页）→ 不同阶段 → 从植物到食物 →
       语言与记录 → 植物知识与文献（有资料才显示）。
   语言：中文为主，可切换 English（?lang=en 或右上角）；安远话名称、IPA、学名不翻译。
   录音：先用图集里的 audio，没有就用词典里 dict 那个词条的录音。
   二维码（管理模式 ?admin=1）指向 plant.html?id=…，供纸质版扫码听录音。
   ========================================================= */
(() => {
  'use strict';

  const SITE = 'https://juan-zhong.github.io/ay_hak/';
  const DATA_URL = './data/plants.json';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ipa = (s) => (s ? `<span class="ipa">/${esc(s)}/</span>` : '');
  const no = (i) => String(i + 1).padStart(2, '0');

  /* ---------- 语言 ---------- */
  const lang = () => (document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh');
  const t = (zh, en) => (lang() === 'en' ? en : zh);
  const field = (o, k) => (lang() === 'en' && o[`${k}_en`]) || o[k] || '';
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

  /* ---------- 发音按钮、词典链接 ---------- */
  const SPEAKER = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false"><path d="M4 9.2v5.6h3.6L12.5 19V5L7.6 9.2H4z" fill="currentColor"/><path d="M15.6 8.6a4.6 4.6 0 0 1 0 6.8M18.2 6a8.3 8.3 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const AUDIO = new Map();          // 词典编号 → 录音
  const audioOf = (dictId, src) => src || AUDIO.get(dictId) || '';
  const sayBtn = (dictId, src, cls = '') => {
    const a = audioOf(dictId, src);
    return a
      ? `<button type="button" class="say ${cls}" data-play="${esc(a)}" aria-label="${t('听发音', 'Listen')}" title="${t('听发音', 'Listen')}">${SPEAKER}</button>`
      : `<button type="button" class="say ${cls}" disabled aria-label="${t('录音待补', 'Recording pending')}" title="${t('录音待补', 'Recording pending')}">${SPEAKER}</button>`;
  };
  const word = (name, dictId) => (dictId ? `<a class="dict-link" href="./dict.html?w=${encodeURIComponent(dictId)}" title="${t('在词典里查', 'Look up in the dictionary')}">${esc(name)}</a>` : esc(name));

  const photosOf = (p) => (p.photos || (p.photo ? [{ src: p.photo }] : [])).filter((x) => x && x.src);
  const derivedOf = (p) => (p.derived || []).filter((x) => x && x.name);
  const img = (x, alt, eager) => `<img src="${esc(x.src || x.photo)}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} />`;
  // 学名：没有就“学名待鉴定”；有但还没核对标本就加“待核实”
  const latin = (p) => {
    if (!p.latin) return pending('学名待鉴定', 'identification pending');
    return `<i>${esc(p.latin)}</i>${p.latin_status === 'verified' ? '' : ` ${pending('待核实', 'to be verified')}`}`;
  };
  const photoNote = (x) => [field(x, 'caption'), x.stage, x.place, x.date].filter(Boolean).map(esc).join(' · ');

  /* ---------- plants.html：图集照片网格 ---------- */
  function renderIndex(plants, target) {
    const words = plants.reduce((n, p) => n + (p.name ? 1 : 0) + derivedOf(p).length, 0);
    const st = $('#plantStatus');
    if (st) st.textContent = t(`已记录 ${plants.length} / ${target} 种 · ${words} 个叫法`, `${plants.length} of ${target} plants · ${words} names`);
    const grid = $('#plantGrid');
    if (!grid) return;
    // 第一种植物用大图，其余按顺序排；照片标了 wide 的占宽一点的格子
    grid.innerHTML = plants.map((p, i) => {
      const ph = photosOf(p)[0];
      const cls = i === 0 ? 'lead' : (ph && ph.wide ? 'wide' : '');
      return `<article class="spec ${cls}">
        <a class="ph" href="./plant.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">${ph ? img(ph, p.name) : pending('照片待补', 'photo pending')}</a>
        <div class="cap"><span class="no">${no(i)}</span>
          <div class="nm"><b>${word(p.name || '', p.dict)}</b>${ipa(p.ipa)}${sayBtn(p.dict, p.audio, 'sm')}</div>
          <span class="lt">${latin(p)}${field(p, 'mandarin') ? ` · ${esc(field(p, 'mandarin'))}` : ''}</span>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- plant.html：一种植物的 photo essay ---------- */
  const chap = (n, zh, en) => `<p class="chap"><span class="num">${n}</span>${t(zh, en)}</p>`;
  function renderPlant(plants) {
    const id = new URL(location.href).searchParams.get('id');
    const i = Math.max(0, plants.findIndex((p) => p.id === id));
    const p = plants[i];
    const ph = photosOf(p);
    const d = derivedOf(p);
    const col = p.collected || {};
    const audio = audioOf(p.dict, p.audio);
    document.title = `${p.name || p.mandarin} · ${t('安远话植物图集', 'Plants and Plant Knowledge in Anyuan Hakka')} · AYHAK`;
    let n = 0;
    const next = () => String(++n).padStart(2, '0');
    let html = '';

    // 标题
    html += `<header class="wrap p-head">
      <div>
        <p class="crumb"><a href="./plants.html">${t('安远话植物图集', 'Plants of Anyuan')}</a> / <a href="./plants.html#plates">${t('图集', 'Plates')}</a> / No. ${no(i)}</p>
        <p class="p-no">No. ${no(i)}</p>
        <h1 class="p-name">${word(p.name || p.mandarin, p.dict)}</h1>
        <p class="p-ipa">${ipa(p.ipa) || pending('IPA 待补', 'IPA pending')} ${sayBtn(p.dict, p.audio)}${audio ? '' : ` ${pending('录音待补', 'recording pending')}`}</p>
        <p class="p-lat">${latin(p)}</p>
      </div>
      <div>
        ${field(p, 'gloss') ? `<p class="p-gloss">${esc(field(p, 'gloss'))}</p>` : ''}
        <p class="p-meta">${[p.variety || col.place, field(p, 'mandarin')].filter(Boolean).map(esc).join(' · ')}</p>
        ${p.dict ? `<p class="p-meta"><a class="more" href="./dict.html?w=${encodeURIComponent(p.dict)}">${t('在词典里查这个词 →', 'See this word in the dictionary →')}</a></p>` : ''}
      </div>
    </header>`;

    // 01 认识这种植物：Mater 式标本页
    const f = ph[0];
    const aliases = (p.aliases || []).filter((x) => x && x.name);
    const kv = (k, v) => (v ? `<span class="k">${k}</span><span class="v">${v}</span>` : '');
    html += `<section class="sec wrap essay">${chap(next(), '认识这种植物', 'The plant')}
      <div class="specimen">
        <div class="ph">${f ? img(f, field(f, 'caption') || p.name, true) : pending('照片待补', 'photo pending')}</div>
        <div>
          <div class="labelblock">
            <div class="first"><span class="k">${t('当地名称', 'Local name')}:</span><span class="v">${word(p.name || p.mandarin, p.dict)} ${ipa(p.ipa)} ${sayBtn(p.dict, p.audio, 'sm')}</span></div>
            ${kv(t('学名', 'Scientific name') + ':', latin(p))}
            ${kv(t('普通话', 'Mandarin') + ':', esc(field(p, 'mandarin')))}
            ${kv(t('地点', 'Place') + ':', esc(col.place || p.variety || ''))}
            ${kv(t('摄影', 'Photograph') + ':', esc((p.credit || '').replace(/^摄影：/, '')))}
          </div>
          ${f && photoNote(f) ? `<p class="small" style="margin-top:12px"><span style="font-family:var(--serif);font-style:italic;color:var(--clay)">${t('图 1', 'Fig. 1')}</span> ${photoNote(f)}</p>` : ''}
        </div>
      </div>
    </section>`;

    // 02 不同阶段：有什么放什么；只有一张时占整行
    if (ph.length > 1) {
      html += `<section class="sec wrap essay">${chap(next(), '不同阶段', 'Stages')}
        <div class="gallery">${ph.slice(1).map((x, k) => `<figure class="${x.full || ph.length === 2 ? 'full' : ''}">
          <div class="frame${x.cutout ? '' : ' photo'}">${img(x, field(x, 'caption'))}</div>
          <figcaption><span class="no">${t(`图 ${k + 2}`, `Fig. ${k + 2}`)}</span>${photoNote(x)}</figcaption></figure>`).join('')}</div>
      </section>`;
    }

    // 03 从植物到食物
    if (d.length) {
      html += `<section class="sec wrap essay">${chap(next(), '从植物到食物', 'From plant to food')}
        <div class="made">${d.map((x) => `<div>
          <figure class="frame">${x.photo ? img(x, x.name) : ''}</figure>
          <div class="nm"><b>${word(x.name, x.dict)}</b>${ipa(x.ipa)}${sayBtn(x.dict, x.audio, 'sm')}</div>
          ${field(x, 'gloss') ? `<p>${esc(field(x, 'gloss'))}</p>` : ''}
        </div>`).join('')}</div>
      </section>`;
    }

    // 04 语言与记录
    const rows = [
      [t('当地名称', 'Local name'), `${word(p.name, p.dict)} ${ipa(p.ipa)}`],
      [t('录音', 'Recording'), audio ? sayBtn(p.dict, p.audio, 'sm') : pending('待补', 'pending')],
      [t('其他叫法', 'Other names'), aliases.length ? aliases.map((x) => `${esc(x.name)} ${ipa(x.ipa)}${x.place ? `（${esc(x.place)}）` : ''}`).join('；') : pending('待补：别的乡镇、村怎么叫？', 'pending: other townships and villages')],
      [t('相关词', 'Related words'), d.length ? d.map((x) => word(x.name, x.dict)).join('、') : ''],
      [t('记录地点', 'Place'), esc(col.place || p.variety || '')],
      [t('记录时间', 'Date'), esc(col.date || '')],
      [t('记录者', 'Recorded by'), esc(col.by || '')],
    ].filter(([, v]) => v);
    html += `<section class="sec wrap essay">${chap(next(), '语言与记录', 'Language and record')}
      <dl class="record">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <p class="small" style="margin-top:16px">${t('你们那里怎么叫？', 'Is it called something else where you are from?')} <a class="more" href="mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 植物图集：${p.name || p.id}`)}">${t('发邮件告诉我们', 'Email us')}</a></p>
      <div class="qr"><div class="qrbox" data-qr="${esc(p.id)}"></div><p class="small">${t('扫码听发音', 'Scan to listen')}<br>${esc(SITE)}plant.html?id=${esc(p.id)}</p></div>
    </section>`;

    // 05 植物知识与文献：只有真的有资料才显示，三层分开
    const refs = (p.refs || []).filter((r) => r && (r.text || r.text_en));
    const local = field(p, 'uses') || field(p, 'habitat') || field(p, 'season');
    if (refs.length || local) {
      const layer = (k) => refs.filter((r) => (r.layer || 'literature') === k);
      const refHtml = (list) => list.map((r) => `<p>${esc(field(r, 'text'))}<br><span class="small">${esc([r.work, r.edition, r.page ? t(`第 ${r.page} 页`, `p. ${r.page}`) : '', r.area ? t(`研究地点：${r.area}`, `study area: ${r.area}`) : ''].filter(Boolean).join(' · '))}${r.url ? ` · <a href="${esc(r.url)}" rel="noopener">${t('链接', 'link')}</a>` : ''}</span></p>`).join('');
      html += `<section class="sec wrap essay knowledge">${chap(next(), '植物知识与文献', 'Plant knowledge and sources')}<div class="prose">
        ${local || layer('local').length ? `<h3>${t('地方知识', 'Local knowledge')}</h3>${[[t('用途', 'Use'), field(p, 'uses')], [t('生长环境', 'Habitat'), field(p, 'habitat')], [t('季节', 'Season'), field(p, 'season')]].filter(([, v]) => v).map(([k, v]) => `<p><b>${k}</b>　${esc(v)}</p>`).join('')}${refHtml(layer('local'))}` : ''}
        ${layer('botany').length ? `<h3>${t('植物学资料', 'Botanical information')}</h3>${refHtml(layer('botany'))}` : ''}
        ${layer('literature').length ? `<h3>${t('文献记录', 'Published records')}</h3>${refHtml(layer('literature'))}
          <p class="small">${t('文献记录的是传统用途，不代表实际疗效，也不是用药建议；别的地区的记录不代表安远当地的传统。', 'Published records describe traditional uses; they are not evidence of efficacy or medical advice, and records from other regions do not stand for local practice in Anyuan.')}</p>` : ''}
      </div></section>`;
    }

    $('#plant').innerHTML = html;
    if (document.body.classList.contains('show-qr')) drawQR();
    const prev = plants[i - 1], nx = plants[i + 1];
    $('#turn').innerHTML = `
      ${prev ? `<a href="./plant.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}
      <a href="./plants.html#plates">${t('回到图集', 'Back to plates')}</a>
      ${nx ? `<a href="./plant.html?id=${encodeURIComponent(nx.id)}">${esc(nx.name)} →</a>` : '<span></span>'}`;
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
      // 旧的纸质版二维码指向 plants.html#shu：直接打开那种植物
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
