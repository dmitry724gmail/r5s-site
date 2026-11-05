(() => {
  'use strict';
  const container = document.getElementById('events-list');
  const status = document.getElementById('events-status');
  if (!container) return;
  const scriptUrl = document.currentScript.src;
  const base = new URL('../../', scriptUrl);
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  // Explicit parts avoid relying on locale-specific date ordering.
  const parts = new Intl.DateTimeFormat('en', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part = t => parts.find(p => p.type === t).value;
  const currentDate = `${part('year')}-${part('month')}-${part('day')}`;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z'));
  function safeUrl(value, image=false) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, base);
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      if (image && url.origin !== base.origin && url.protocol !== 'https:') return null;
      return url.href;
    } catch { return null; }
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function render(events) {
    if (!Array.isArray(events)) throw Error('Invalid events list');
    const items = events.filter(e => e && e.published === true && typeof e.title === 'string' && validDate(e.date) && (!e.hidePast || (validDate(e.endDate) && e.endDate >= e.date ? e.endDate : e.date) >= currentDate)).sort((a,b)=>a.date.localeCompare(b.date));
    container.replaceChildren();
    for (const event of items) {
      const card = el('article','season-event');
      const imageUrl = safeUrl(event.image,true);
      if (imageUrl) {
        const image = el('img','season-event-image');
        image.src=imageUrl; image.alt=event.imageAlt || event.title;
        image.loading='lazy'; image.decoding='async'; image.width=800;image.height=500;
        image.addEventListener('error',()=>image.remove(),{once:true});card.append(image);
      }
      const body = el('div','season-event-body');
      const date = el('time','season-event-date',new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(event.date+'T12:00:00Z')) + (event.time ? ' · '+event.time : ''));
      date.dateTime=event.date;body.append(date,el('h3','',event.title),el('p','season-event-location',event.location || ''),el('p','season-event-description',event.description || ''));
      const url = safeUrl(event.link);
      if (url) {const link=el('a','text-link','Подробнее');link.href=url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}
      card.append(body);container.append(card);
    }
    status.textContent=items.length ? `Мероприятий: ${items.length}` : 'Новые мероприятия скоро появятся.';
  }
  fetch(new URL('data/events.json',base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>render(data.events)).catch(()=>{status.textContent='Не удалось загрузить афишу. Попробуйте обновить страницу позже.';});
})();
