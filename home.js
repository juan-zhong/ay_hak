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
    lb.innerHTML = '<button class="lb-close" aria-label="关闭">×</button><figure><img alt="" /><figcaption></figcaption></figure>';
    document.body.appendChild(lb);
    const close = () => lb.classList.remove('open');
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lb-close')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    imgs.forEach((img) => {
      img.tabIndex = 0;
      const open = () => {
        $('img', lb).src = img.currentSrc || img.src;
        $('img', lb).alt = img.alt;
        const cap = img.closest('figure')?.querySelector('figcaption');
        $('figcaption', lb).innerHTML = cap ? cap.innerHTML : img.alt;
        lb.classList.add('open');
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  nextMeetup();
  lightbox();
})();
