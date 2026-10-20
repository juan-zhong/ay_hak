/* AYHAK 首页：下一次复健会、照片放大 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const lang = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const T = {
    zh: { next: '下一次', bj: '北京时间', local: '你所在地是', none: '具体日期请看日历，或发邮件问我们。', wk: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] },
    en: { next: 'Next meetup', bj: 'Beijing time', local: 'Your time:', none: 'See the calendar for dates, or email us.', wk: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  }[lang];

  async function nextMeetup() {
    const box = $('#nextMeetup');
    if (!box) return;
    try {
      const res = await fetch('./data/meetups.json', { cache: 'no-cache' });
      const j = await res.json();
      const time = /^\d{1,2}:\d{2}$/.test(j.time || '') ? j.time : '';
      const now = Date.now();
      // 北京时间 = UTC+8，无夏令时
      const toUTC = (d) => Date.parse(`${d}T${time || '23:59'}:00+08:00`);
      const next = (j.dates || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && toUTC(d) + (j.minutes || 90) * 60000 > now).sort()[0];
      if (!next) { box.innerHTML = `<span class="small">${T.none}</span>`; return; }
      const [y, m, d] = next.split('-').map(Number);
      const wk = T.wk[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      const bj = lang === 'zh' ? `${m} 月 ${d} 日（${wk}）${time ? ` ${time}` : ''}` : `${wk}, ${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}${time ? `, ${time}` : ''}`;
      let local = '';
      if (time) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== 'Asia/Shanghai' && tz !== 'Asia/Hong_Kong' && tz !== 'Asia/Taipei') {
          const f = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
          local = `<span class="small">${T.local} ${f.format(new Date(toUTC(next)))}</span>`;
        }
      }
      box.innerHTML = `<span class="next-label">${T.next}</span><b>${bj}</b> <span class="small">${T.bj}</span>${local ? `<br>${local}` : ''}`;
    } catch {
      box.innerHTML = `<span class="small">${T.none}</span>`;
    }
  }

  // 点照片看大图
  function lightbox() {
    const imgs = [...document.querySelectorAll('.gallery-grid img')];
    if (!imgs.length) return;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="关闭">×</button><figure><figcaption></figcaption></figure>';
    const big = document.createElement('img');
    document.body.appendChild(lb);
    const close = () => lb.classList.remove('open');
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lb-close')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    imgs.forEach((img) => {
      img.tabIndex = 0;
      const open = () => {
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        if (!big.isConnected) $('figure', lb).prepend(big);
        const cap = img.closest('figure')?.querySelector('figcaption');
        $('figcaption', lb).innerHTML = cap ? cap.innerHTML : img.alt;
        lb.classList.add('open');
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  // 每日一词：按日期从词典里挑一个，每天换一个
  async function wordOfDay() {
    const box = $('#wotd'); if (!box) return;
    try {
      const j = await (await fetch('./data/dict.json', { cache: 'no-cache' })).json();
      const list = (Array.isArray(j) ? j : j.entries || []).filter((e) => e.hanzi && e.senses && e.senses.length);
      if (!list.length) return;
      const d = new Date(); const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
      const e = list[day % list.length];
      const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      box.href = `./dict.html?w=${encodeURIComponent(e.id)}`;
      box.innerHTML = `<span class="wotd-label">${lang === 'zh' ? '今天学一个词' : 'Word of the day'}</span>
        <div class="wotd-hw">${esc(e.hanzi)}${e.ipa ? `<span class="ipa">[${esc(e.ipa)}]</span>` : ''}</div>
        <div class="wotd-gl">${esc(e.senses[0])}${e.variety ? ` · ${esc(e.variety)}` : ''}</div>`;
    } catch { /* 词典读不到就不显示 */ }
  }

  nextMeetup();
  lightbox();
  wordOfDay();
})();
