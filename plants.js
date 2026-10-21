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
  const DICT = new Map();           // 词典编号 → 词条
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
  const img = (x, alt, eager) => `<img src="${esc(x.src || x.photo)}" alt="${esc(alt)}"${x.cutout ? ' class="cut"' : ''}${eager ? '' : ' loading="lazy"'} />`;
  // 学名：没有就“学名待鉴定”；有但还没核对标本就加“待核实”
  const latin = (p) => {
    if (!p.latin) return pending('学名待鉴定', 'identification pending');
    return `<i>${esc(p.latin)}</i>${p.latin_status === 'verified' ? '' : ` ${pending('待核实', 'to be verified')}`}`;
  };
  const photoNote = (x) => [field(x, 'caption'), x.stage, x.place, x.date].filter(Boolean).map(esc).join(' · ');

  /* ---------- 页码 ---------- */
  const BOOK_PAGES = 9;             // plants.html 最后一页的页码；每种植物 6 页，接着编
  const PLANT_PAGES = 6;
  const PANELS = ['ochre', 'mauve', 'sage', 'slate', 'lilac', 'bone'];
  const colorOf = (p, i) => (PANELS.includes(p.color) ? p.color : PANELS[i % PANELS.length]);
  const startOf = (i) => BOOK_PAGES + 1 + i * PLANT_PAGES;

  /* ---------- plants.html：目录、图集标本卡（只放本地名称和喇叭） ---------- */
  function renderIndex(plants, target) {
    const words = plants.reduce((n, p) => n + (p.name ? 1 : 0) + derivedOf(p).length, 0);
    const st = $('#plantStatus');
    if (st) st.textContent = t(`已记录 ${plants.length} / ${target} 种 · ${words} 个叫法`, `${plants.length} of ${target} plants · ${words} names`);
    const tc = $('#tocCount'); if (tc) tc.textContent = t(`${plants.length} 种`, `${plants.length} plants`);
    const toc = $('#tocPlants');
    if (toc) toc.innerHTML = plants.map((p, i) => `<li><a href="./plant.html?id=${encodeURIComponent(p.id)}"><span class="n">${no(i)}</span><b>${esc(p.name || p.mandarin)}</b><span class="dots"></span><span class="pg">${startOf(i)}</span></a></li>`).join('');
    const grid = $('#plantGrid');
    if (!grid) return;
    grid.innerHTML = plants.map((p, i) => {
      const ph = photosOf(p)[0];
      return `<article class="spec">
        <span class="no">No. ${no(i)}</span>
        <a class="ph" href="./plant.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">${ph ? img(ph, p.name) : pending('照片待补', 'photo pending')}</a>
        <div class="tag"><span class="k">${t('当地名称', 'Local name')}</span>
          <div class="nm"><b><a href="./plant.html?id=${encodeURIComponent(p.id)}">${esc(p.name || '')}</a></b>${sayBtn(p.dict, p.audio, 'sm')}</div></div>
      </article>`;
    }).join('');
  }

  /* ---------- plant.html：三个跨页 ----------
     1 标本页（看植物）       | 色块页（听它怎么说）
     2 白纸页（食用与烹饪）   | 色块页（药用与传统用途、地方知识）
     3 色块页（照片档案）     | 白纸页（补充资料） */
  const fmtDur = (sec) => (isFinite(sec) && sec > 0 ? `0:${sec < 10 ? '0' : ''}${sec.toFixed(1)}` : '');
  function fillDurations() {
    $$('[data-dur]').forEach((el) => {
      const a = new Audio(); a.preload = 'metadata';
      a.onloadedmetadata = () => { const d = fmtDur(a.duration); if (d) el.textContent = d; };
      a.src = el.dataset.dur;
    });
  }
  function renderPlant(plants, dictById) {
    const id = new URL(location.href).searchParams.get('id');
    const i = Math.max(0, plants.findIndex((p) => p.id === id));
    const p = plants[i];
    const ph = photosOf(p);
    const d = derivedOf(p);
    const col = p.collected || {};
    const ed = p.edible || {};
    const med = p.medicinal || {};
    const de = dictById.get(p.dict) || {};
    const color = colorOf(p, i);
    const n0 = startOf(i);
    document.title = `${p.name || p.mandarin} · ${t('安远话植物图集', 'Plants and Plant Knowledge in Anyuan Hakka')} · AYHAK`;
    const head = `<div class="runhead"><span>安远话植物图集</span><span>No. ${no(i)} · ${esc(p.name || '')}</span></div>`;
    const folio = (k) => `<span class="folio">${n0 + k}</span>`;
    const kv = (k, v) => (v ? `<span class="k">${k}</span><span class="v">${v}</span>` : '');

    // 录音
    let recs = (p.recordings || []).filter((r) => r && r.src);
    const main = audioOf(p.dict, p.audio);
    if (!recs.length && main) recs = [{ src: main, place: p.variety || col.place || de.variety || '', speaker: de.speaker || '' }];
    const variants = (p.aliases || []).filter((x) => x && x.name);
    const recRow = (r, label) => `<li><button type="button" class="say sm" data-play="${esc(r.src)}" aria-label="${t('播放', 'Play')}">${SPEAKER}</button>
      <span>${label ? `<b>${label}</b> · ` : ''}${esc([r.place, r.speaker, r.date].filter(Boolean).join(' · ')) || t('安远话', 'Anyuan Hakka')}</span><span class="dur" data-dur="${esc(r.src)}"></span></li>`;

    const f = ph[0];
    // 1 左：标本页
    const pg1 = `<div class="page sheet specimen">${head}
      <div class="ph">${f ? img(f, field(f, 'caption') || p.name, true) : pending('照片待补', 'photo pending')}</div>
      <div class="labelblock">
        <div class="first"><span class="k">${t('当地名称', 'Local name')}:</span><span class="v">${word(p.name || p.mandarin, p.dict)} ${ipa(p.ipa)} ${sayBtn(p.dict, p.audio, 'sm')}</span></div>
        ${kv(t('地点', 'Place') + ':', esc(p.variety || col.place || ''))}
        ${kv(t('图', 'Fig.') + ' 1:', f ? photoNote(f) : '')}
      </div>${folio(0)}</div>`;
    // 1 右：听它怎么说
    const pg2 = `<div class="page panel-${color}">${head}
      <p class="p-no">No. ${no(i)}</p>
      <div class="nameline"><h1 class="p-name">${esc(p.name || p.mandarin)}</h1>
        ${recs.length ? `<button type="button" class="say xl" data-play="${esc(recs[0].src)}" aria-label="${t('听发音', 'Listen')}">${SPEAKER}<span>${t('听发音', 'Listen')}</span><span class="dur" data-dur="${esc(recs[0].src)}"></span></button>`
          : `<span class="norec">${SPEAKER} ${t('还没有录音', 'No recording yet')}</span>`}</div>
      <p class="p-ipa">${ipa(p.ipa) || pending('IPA 待补', 'IPA pending')} <span class="small">${t('安远话', 'Anyuan Hakka')}${p.variety ? ` · ${esc(p.variety)}` : ''}</span></p>
      ${field(p, 'gloss') ? `<p>${esc(field(p, 'gloss'))}</p>` : ''}
      ${recs.length > 1 ? `<p class="sec-k">${t('不同发音人、不同地方的录音', 'Other recordings')}</p><ul class="recs">${recs.map((r) => recRow(r)).join('')}</ul>` : ''}
      <p class="sec-k">${t('其他地方的说法', 'Other places')}</p>
      ${variants.length ? `<ul class="recs">${variants.map((x) => x.audio ? recRow({ src: x.audio, place: x.place, speaker: x.speaker }, `${esc(x.name)} ${ipa(x.ipa)}`) : `<li><span class="say sm ghost">${SPEAKER}</span><span><b>${esc(x.name)}</b> ${ipa(x.ipa)}${x.place ? ` · ${esc(x.place)}` : ''}</span><span></span></li>`).join('')}</ul>`
        : `<p class="small">${t('待补：别的乡镇、村怎么叫？', 'To be added: names in other townships and villages.')} <a class="ulink" href="mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 植物图集：${p.name || p.id}`)}">${t('告诉我们', 'Tell us')}</a></p>`}
      ${folio(1)}</div>`;
    // 2 左：食用与烹饪
    const edRows = [[t('吃的部位', 'Part eaten'), field(ed, 'part')], [t('什么时候采', 'When gathered'), field(ed, 'stage')], [t('怎么处理、怎么做', 'How it is prepared'), field(ed, 'how')]].filter(([, v]) => v);
    const pg3 = `<div class="page sheet">${head}
      <p class="label">Food · ${t('食用', 'eating')}</p><h2 class="h">${t('食用与烹饪', 'Food and cooking')}</h2>
      <div class="kv">${edRows.map(([k, v]) => `<p><b>${k}</b>　${esc(v)}</p>`).join('') || (d.length ? '' : `<p class="muted">${t('待补充：当地人吃它的哪个部分、怎么做？', 'To be added: which part is eaten, and how it is prepared.')}</p>`)}</div>
      ${d.length ? `<ul class="made">${d.map((x) => `<li><div class="frame">${x.photo ? img(x, x.name) : ''}</div>
        <div><b>${word(x.name, x.dict)}</b> ${sayBtn(x.dict, x.audio, 'sm')}<br>${ipa(x.ipa)}${field(x, 'gloss') ? `<p class="small" style="margin:6px 0 0">${esc(field(x, 'gloss'))}</p>` : ''}</div></li>`).join('')}</ul>` : ''}
      ${folio(2)}</div>`;
    // 2 右：药用与传统用途 + 地方知识
    const Lc = (med.local || []).filter((x) => x && x.text), W = (med.literature || []).filter((x) => x && x.text), R = (med.research || []).filter((x) => x && x.text);
    const src = (r) => esc([r.place, r.by, r.work, r.page ? t(`第 ${r.page} 页`, `p. ${r.page}`) : '', r.area ? t(`研究地点：${r.area}`, `study area: ${r.area}`) : ''].filter(Boolean).join(' · '));
    const part = (h, list) => (list.length ? `<h3>${h}</h3>${list.map((r) => `<p>${esc(field(r, 'text'))}<br><span class="small">${src(r)}${r.url ? ` · <a class="ulink" href="${esc(r.url)}" rel="noopener">${t('链接', 'link')}</a>` : ''}</span></p>`).join('')}` : '');
    const local = [[t('用途', 'Use'), field(p, 'uses')], [t('长在哪里', 'Where it grows'), field(p, 'habitat')], [t('季节', 'Season'), field(p, 'season')]].filter(([, v]) => v);
    const pg4 = `<div class="page panel-${color}">${head}
      <p class="label">Medicine · ${t('药用', 'uses')}</p><h2 class="h">${t('药用与传统用途', 'Medicinal and traditional uses')}</h2>
      ${Lc.length || W.length || R.length ? part(t('当地说法', 'Local knowledge'), Lc) + part(t('文献记录', 'Published records'), W) + part(t('研究证据', 'Research evidence'), R)
        + `<p class="small" style="margin-top:12px">${t('传统用途不等于临床疗效，这里不提供用药建议；别的地区的记录不代表安远当地的传统。', 'Traditional use is not clinical efficacy and this is not medical advice; records from other regions do not stand for local practice in Anyuan.')}</p>`
        : `<p>${t('暂无可靠资料。如果你知道当地人怎么用它，欢迎告诉我们。', 'No reliable information yet. If you know how it is used locally, please tell us.')}</p>`}
      ${local.length ? `<p class="sec-k">${t('地方知识', 'Local knowledge')}</p><div class="kv">${local.map(([k, v]) => `<p><b>${k}</b>　${esc(v)}</p>`).join('')}</div>` : ''}
      ${folio(3)}</div>`;
    // 3 左：照片档案
    const pg5 = ph.length > 1 ? `<div class="page panel-${color}">${head}
      <p class="label">Archive · ${t('照片档案', 'photographs')}</p>
      <div class="stages">${ph.slice(1).map((x, k) => `<figure><div class="frame">${img(x, field(x, 'caption'))}</div><figcaption><span class="no">${t(`图 ${k + 2}`, `Fig. ${k + 2}`)}</span>${photoNote(x)}</figcaption></figure>`).join('')}</div>
      ${folio(4)}</div>` : `<div class="page blank panel-bone"><span class="endmark">AYHAK</span>${folio(4)}</div>`;
    // 3 右：补充资料
    const refs = (p.refs || []).filter((r) => r && (r.text || r.work));
    const pg6 = `<div class="page sheet">${head}
      <p class="label">Reference · ${t('补充资料', 'details')}</p><h2 class="h">${t('补充资料', 'Reference')}</h2>
      <dl class="facts">${[
        [t('当地名称', 'Local name'), word(p.name, p.dict)],
        ['IPA', ipa(p.ipa) || pending('待补', 'pending')],
        [t('普通话', 'Mandarin'), esc(field(p, 'mandarin'))],
        [t('英文', 'English'), esc(p.name_en || '')],
        [t('学名', 'Scientific name'), latin(p) + (p.latin_basis ? `<br><span class="small">${t('鉴定依据', 'Basis')}：${esc(p.latin_basis)}</span>` : '')],
        [t('科', 'Family'), esc(p.family || '')],
        [t('其他叫法', 'Other names'), variants.map((x) => `${esc(x.name)}${x.place ? `（${esc(x.place)}）` : ''}`).join('；')],
        [t('记录', 'Record'), esc([col.place || p.variety, col.date, col.by].filter(Boolean).join(' · '))],
        [t('摄影', 'Photographs'), esc((p.credit || '').replace(/^摄影：/, ''))],
      ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${refs.length ? `<p class="sec-k">${t('参考文献', 'References')}</p><ul class="refs">${refs.map((r) => `<li>${esc(field(r, 'text'))}<span class="src">${esc([r.work, r.page, r.area].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : ''}
      <p class="small" style="margin-top:auto">${p.dict ? `<a class="ulink" href="./dict.html?w=${encodeURIComponent(p.dict)}">${t('在词典里查这个词', 'See this word in the dictionary')}</a>　` : ''}<a class="ulink" href="mailto:juanzhon@buffalo.edu?subject=${encodeURIComponent(`AYHAK 植物图集：${p.name || p.id}`)}">${t('补充或更正', 'Add or correct')}</a></p>
      <div class="qr"><div class="qrbox" data-qr="${esc(p.id)}"></div><p class="small">${t('扫码听发音', 'Scan to listen')}<br>${esc(SITE)}plant.html?id=${esc(p.id)}</p></div>
      ${folio(5)}</div>`;

    $('#plant').innerHTML = `<section class="spread">${pg1}${pg2}</section><section class="spread">${pg3}${pg4}</section><section class="spread last">${pg5}${pg6}</section>`;
    fillDurations();
    if (document.body.classList.contains('show-qr')) drawQR();
    const prev = plants[i - 1], nx = plants[i + 1];
    $('#turn').innerHTML = `
      ${prev ? `<a href="./plant.html?id=${encodeURIComponent(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}
      <a href="./plants.html#plates">${t('目录', 'Contents')}</a>
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
    $$('.say.playing').forEach((x) => x.classList.remove('playing'));
    player = new Audio(b.dataset.play);
    b.classList.add('playing');
    player.onended = () => b.classList.remove('playing');
    player.play().catch(() => { b.classList.remove('playing'); alert(t('录音载入失败', 'Could not load the recording')); });
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
        (Array.isArray(dj) ? dj : dj.entries || []).forEach((e) => { if (e && e.id) { DICT.set(e.id, e); if (e.audio) AUDIO.set(e.id, e.audio); } });
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
    const render = () => { if (isPlant) renderPlant(plants, DICT); else { renderIndex(plants, target); statics(); } };
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
