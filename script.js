'use strict';

// ── Hebrew date helpers ──────────────────────────────────────────────────────
const HE_DAYS  = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                   'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  const d = parseDate(iso);
  return `${d.getDate()} ${HE_MONTHS[d.getMonth()]} ${d.getFullYear()} (${HE_DAYS[d.getDay()]})`;
}

function formatDateRange(start, end) {
  if (start === end) return formatDate(start);
  const s = parseDate(start), e = parseDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${HE_MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function getWeekLabel(isoDate) {
  const d = parseDate(isoDate);
  // Find Monday of the week (ISO week starts Mon)
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmtShort = (dt) => `${dt.getDate()} ${HE_MONTHS[dt.getMonth()]}`;
  return `${fmtShort(mon)} – ${fmtShort(sun)}`;
}

function getWeekKey(isoDate) {
  const d = parseDate(isoDate);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + diff);
  // Format locally to avoid UTC-shift crossing midnight
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, '0');
  const dd = String(mon.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ── ICS generation ───────────────────────────────────────────────────────────
function toICSDate(iso) {
  return iso.replace(/-/g, '');
}

function generateICS(event) {
  const uid = `gdud9220-${event.id}-${Date.now()}@gantt`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const startDate = toICSDate(event.start);
  const endDate   = toICSDate(
    // ICS all-day end is exclusive, so add one day
    (() => {
      const d = parseDate(event.end);
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dd}`;
    })()
  );
  const desc = event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}\n` : '';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gdud9220//Gantt//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}Z`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${event.name}`,
    `CATEGORIES:${event.category}`,
    desc,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(l => l !== '').join('\r\n');
}

function downloadICS(event) {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  // Direct navigation triggers Calendar app on iOS instead of opening a tab
  window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ── State ────────────────────────────────────────────────────────────────────
let allEvents      = [];
let allCategories  = [];
let activeFilter   = 'all';
let activeEvent    = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const legendBar   = document.getElementById('legend-bar');
const filterBar   = document.getElementById('filter-bar');
const timeline    = document.getElementById('timeline');
const overlay     = document.getElementById('modal-overlay');
const modalTitle  = document.getElementById('modal-title');
const modalMeta   = document.getElementById('modal-meta');
const modalNotes  = document.getElementById('modal-notes');
const modalBadge  = document.getElementById('modal-cat-badge');
const icsBtn      = document.getElementById('ics-btn');
const modalClose  = document.getElementById('modal-close');

// ── Render ───────────────────────────────────────────────────────────────────
function getCatColor(catName) {
  const cat = allCategories.find(c => c.name === catName);
  return cat ? cat.color : '#4285F4';
}

function buildLegend() {
  legendBar.innerHTML = '';
  allCategories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${cat.color}"></span><span>${cat.name}</span>`;
    legendBar.appendChild(item);
  });
}

function buildFilters() {
  // "הכל" button already in HTML; add one per category
  allCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.cat = cat.name;
    btn.textContent = cat.name;
    btn.style.setProperty('--cat-color', cat.color);
    filterBar.appendChild(btn);
  });

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.cat;
    applyFilter();
  });

  // Style active button color dynamically
  filterBar.addEventListener('click', () => updateFilterBtnStyles());
  updateFilterBtnStyles();
}

function updateFilterBtnStyles() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.classList.contains('active')) {
      const cat = allCategories.find(c => c.name === btn.dataset.cat);
      btn.style.background = cat ? cat.color : '#4285F4';
      btn.style.color = '#000';
    } else {
      btn.style.background = '';
      btn.style.color = '';
    }
  });
  // "all" button
  const allBtn = filterBar.querySelector('[data-cat="all"]');
  if (allBtn && allBtn.classList.contains('active')) {
    allBtn.style.background = '#4285F4';
    allBtn.style.color = '#fff';
  }
}

function buildTimeline() {
  timeline.innerHTML = '';
  const today = todayISO();

  // Group events by week, then by day
  const weekMap = new Map(); // weekKey -> { label, days: Map(isoDate -> [events]) }

  allEvents.forEach(evt => {
    const wKey = getWeekKey(evt.start);
    if (!weekMap.has(wKey)) {
      weekMap.set(wKey, { label: getWeekLabel(evt.start), days: new Map() });
    }
    const week = weekMap.get(wKey);
    const dKey = evt.start;
    if (!week.days.has(dKey)) week.days.set(dKey, []);
    week.days.get(dKey).push(evt);
  });

  // Sort weeks
  const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  sortedWeeks.forEach(([wKey, weekData]) => {
    const weekBlock = document.createElement('section');
    weekBlock.className = 'week-block';
    weekBlock.dataset.weekKey = wKey;

    const wHeader = document.createElement('div');
    wHeader.className = 'week-header';
    wHeader.innerHTML = `<span class="week-label">שבוע</span><span class="week-range">${weekData.label}</span>`;
    weekBlock.appendChild(wHeader);

    // Sort days
    const sortedDays = [...weekData.days.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    sortedDays.forEach(([dKey, dayEvents]) => {
      const dayGroup = document.createElement('div');
      dayGroup.className = 'day-group';
      dayGroup.dataset.dayKey = dKey;

      const isToday = dKey === today;
      const dayLbl = document.createElement('div');
      dayLbl.className = 'day-label';
      dayLbl.innerHTML = (isToday ? '<span class="today-marker">היום</span>' : '') + formatDate(dKey);
      dayGroup.appendChild(dayLbl);

      dayEvents.forEach(evt => {
        const card = buildCard(evt);
        dayGroup.appendChild(card);
      });

      weekBlock.appendChild(dayGroup);
    });

    timeline.appendChild(weekBlock);
  });

  if (timeline.children.length === 0) {
    timeline.innerHTML = '<div class="empty-state">אין אירועים</div>';
  }
}

function buildCard(evt) {
  const color = getCatColor(evt.category);
  const card = document.createElement('div');
  card.className = 'event-card' + (evt.start !== evt.end ? ' span-event' : '');
  card.dataset.eventId = evt.id;
  card.dataset.cat = evt.category;
  card.innerHTML = `
    <div class="event-color-bar" style="background:${color}"></div>
    <div class="event-body">
      <div class="event-name">${escHtml(evt.name)}</div>
      ${evt.start !== evt.end ? `<div class="event-meta">${escHtml(formatDateRange(evt.start, evt.end))}</div>` : ''}
    </div>
    <span class="event-cat-chip" style="background:${color}">${escHtml(evt.category)}</span>
  `;
  card.addEventListener('click', () => openModal(evt));
  return card;
}

function applyFilter() {
  document.querySelectorAll('.event-card').forEach(card => {
    const match = activeFilter === 'all' || card.dataset.cat === activeFilter;
    card.classList.toggle('hidden', !match);
  });

  // Hide day groups where all cards are hidden
  document.querySelectorAll('.day-group').forEach(dg => {
    const anyVisible = [...dg.querySelectorAll('.event-card')].some(c => !c.classList.contains('hidden'));
    dg.classList.toggle('all-hidden', !anyVisible);
  });

  // Hide week blocks where all day groups are hidden
  document.querySelectorAll('.week-block').forEach(wb => {
    const anyVisible = [...wb.querySelectorAll('.day-group')].some(d => !d.classList.contains('all-hidden'));
    wb.classList.toggle('all-hidden', !anyVisible);
  });
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openModal(evt) {
  activeEvent = evt;
  const color = getCatColor(evt.category);

  modalBadge.textContent = evt.category;
  modalBadge.style.background = color;

  modalTitle.textContent = evt.name;

  modalMeta.innerHTML = `
    <div><strong>תאריך:</strong> ${formatDateRange(evt.start, evt.end)}</div>
    <div><strong>קטגוריה:</strong> ${escHtml(evt.category)}</div>
  `;

  if (evt.notes && evt.notes.trim()) {
    modalNotes.textContent = evt.notes;
    modalNotes.classList.add('has-notes');
  } else {
    modalNotes.classList.remove('has-notes');
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  activeEvent = null;
}

overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
modalClose.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
icsBtn.addEventListener('click', () => { if (activeEvent) downloadICS(activeEvent); });

// ── Utility ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('data/events.json');
    const data = await res.json();
    allEvents     = data.events     || [];
    allCategories = data.categories || [];

    // Only show categories that have events
    const usedCats = new Set(allEvents.map(e => e.category));
    allCategories = allCategories.filter(c => usedCats.has(c.name));

    buildLegend();
    buildFilters();
    buildTimeline();
    updateFilterBtnStyles();

    // Auto-scroll to today or nearest future event
    const today = todayISO();
    const nearestCard = document.querySelector(`.day-group[data-day-key="${today}"]`)
      || [...document.querySelectorAll('.day-group')]
           .find(dg => dg.dataset.dayKey >= today);
    if (nearestCard) {
      setTimeout(() => nearestCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  } catch (err) {
    timeline.innerHTML = '<div class="empty-state">שגיאה בטעינת נתונים</div>';
    console.error(err);
  }
}

init();
