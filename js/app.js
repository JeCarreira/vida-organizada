import {
  supabase,
  getSession,
  signIn,
  signOut,
  signUp,
  listEventsByRange,
  createEvent,
  hasSupabaseConfig,
  formatAuthError,
} from './services/supabase.js';

const areaPalette = {
  'Casa': { color: 'casa', name: 'Areia quente', hex: '#d9c7a6' },
  'Família': { color: 'familia', name: 'Sálvia familiar', hex: '#c7d3b5' },
  'Filhos': { color: 'filhos', name: 'Azul bebé elegante', hex: '#c9dbe7' },
  'Eu': { color: 'eu', name: 'Rosa antigo', hex: '#d6b1bb' },
  'Bem-estar': { color: 'bem-estar', name: 'Verde spa', hex: '#afc8a5' },
  'Casamento': { color: 'casamento', name: 'Lavanda fina', hex: '#c6c5dd' },
  'Projeto / Marca': { color: 'projeto', name: 'Terracota premium', hex: '#c58c66' },
  'Papéis e burocracia': { color: 'papeis', name: 'Taupe burocracia', hex: '#b8afa6' },
  'Finanças': { color: 'financas', name: 'Oliva dourado', hex: '#8f9b74' },
  'Rotinas': { color: 'rotinas', name: 'Linho rotina', hex: '#e7ddbf' },
  'Social / Comunidade': { color: 'social', name: 'Pêssego social', hex: '#eab8a5' },
  'Outro': { color: 'outro', name: 'Neutro suave', hex: '#bbb2a8' },
};

const eventColors = {
  casa: '#d9c7a6',
  familia: '#c7d3b5',
  filhos: '#c9dbe7',
  eu: '#d6b1bb',
  'bem-estar': '#afc8a5',
  casamento: '#c6c5dd',
  projeto: '#c58c66',
  papeis: '#b8afa6',
  financas: '#8f9b74',
  rotinas: '#e7ddbf',
  social: '#eab8a5',
  outro: '#bbb2a8',
  champagne: '#e8d8aa',
  ameixa: '#a58295',
  'azul-profundo': '#8ea4bd',
  areia: '#d9c7a6',
  creme: '#eadfce',
  caramelo: '#c18954',
  castanho: '#6a4b33',
  terracota: '#c58c66',
  'verde-oliva': '#8f9b74',
  salvia: '#c7d3b5',
  'azul-nevoa': '#c9dbe7',
  'rosa-antigo': '#d6b1bb',
  lavanda: '#c6c5dd',
  grafite: '#77706a',
};

const recurrenceLabels = {
  none: '',
  daily: 'diário',
  weekly: 'semanal',
  monthly: 'mensal',
  yearly: 'anual',
};

const recurrenceOccurrences = {
  none: 1,
  daily: 30,
  weekly: 16,
  monthly: 12,
  yearly: 8,
};

const state = {
  page: 'dashboard',
  planningView: 'year',
  currentDate: new Date(),
  selectedDate: new Date(),
  events: [],
  session: null,
};

const el = {
  authScreen: document.getElementById('auth-screen'),
  authForm: document.getElementById('auth-form'),
  authFeedback: document.getElementById('auth-feedback'),
  authEmail: document.getElementById('auth-email'),
  logoutBtn: document.getElementById('logout-btn'),
  pageTitle: document.getElementById('page-title'),
  topbarDate: document.getElementById('topbar-date'),
  pages: [...document.querySelectorAll('.page')],
  menuItems: [...document.querySelectorAll('.menu-item')],
  planningTabs: [...document.querySelectorAll('.planning-tab')],
  planningViews: [...document.querySelectorAll('.planning-view')],
  sidebar: document.getElementById('sidebar'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  stats: document.getElementById('dashboard-stats'),
  upcoming: document.getElementById('dashboard-upcoming'),
  yearLabel: document.getElementById('year-label'),
  yearGrid: document.getElementById('year-grid'),
  calendarLabel: document.getElementById('calendar-label'),
  calendarGrid: document.getElementById('calendar-grid'),
  dayEvents: document.getElementById('day-events'),
  selectedDayLabel: document.getElementById('selected-day-label'),
  weekLabel: document.getElementById('week-label'),
  weekGrid: document.getElementById('week-grid'),
  todayLabel: document.getElementById('today-label'),
  todayEvents: document.getElementById('today-events'),
  eventModal: document.getElementById('event-modal'),
  eventForm: document.getElementById('event-form'),
  eventFeedback: document.getElementById('event-feedback'),
  eventSubmitBtn: document.getElementById('event-submit-btn'),
  quickEventBtn: document.getElementById('quick-event-btn'),
  selectedDayEventBtn: document.getElementById('selected-day-event-btn'),
  areaColorDot: document.getElementById('area-color-dot'),
  areaColorName: document.getElementById('area-color-name'),
  areaColorNote: document.getElementById('area-color-note'),
};

function fmtDate(date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTimeLocal(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); }
function startOfYear(date) { return new Date(date.getFullYear(), 0, 1); }
function endOfYear(date) { return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999); }
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function setMonthSafely(offset) {
  const next = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + offset, 1);
  state.currentDate = next;
  state.selectedDate = new Date(next);
}
function eventColor(name) { return eventColors[name] || '#d9c7a6'; }
function readableTime(dateValue) { return new Date(dateValue).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
function parseChecklist(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((text) => ({ text, done: false }));
}
function checklistProgress(event) {
  const items = Array.isArray(event.checklist) ? event.checklist : [];
  if (!items.length) return '';
  const done = items.filter((item) => item.done).length;
  return `${done}/${items.length}`;
}
function preparationLabel(event) {
  const days = Number(event.prepare_days_before || 0);
  if (!days) return '';
  return `preparar ${days}d antes`;
}
function eventMeta(event) {
  const parts = [];
  if (event.event_type && event.event_type !== 'Normal') parts.push(event.event_type);
  const prep = preparationLabel(event);
  if (prep) parts.push(prep);
  const progress = checklistProgress(event);
  if (progress) parts.push(`checklist ${progress}`);
  if (event.recurrence && event.recurrence !== 'none') parts.push(recurrenceLabels[event.recurrence]);
  return parts.join(' · ');
}
function eventBlock(event, variant = 'month') {
  const color = eventColor(event.color);
  const meta = eventMeta(event);
  return `<article class="event-card event-card--${variant}" style="--event-color:${color}; background:${color};">
    <strong>${escapeHtml(event.title)}</strong>
    <span>${event.all_day ? 'Dia inteiro' : readableTime(event.starts_at)}${meta ? ` · ${escapeHtml(meta)}` : ''}</span>
  </article>`;
}
function addRecurrence(date, recurrence, index) {
  const next = new Date(date);
  if (recurrence === 'daily') next.setDate(next.getDate() + index);
  if (recurrence === 'weekly') next.setDate(next.getDate() + (index * 7));
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + index);
  if (recurrence === 'yearly') next.setFullYear(next.getFullYear() + index);
  return next;
}
function buildRecurringPayload(basePayload, recurrence) {
  const total = recurrenceOccurrences[recurrence] || 1;
  if (total === 1) return [basePayload];

  const start = new Date(basePayload.starts_at);
  const end = basePayload.ends_at ? new Date(basePayload.ends_at) : null;
  const duration = end ? end.getTime() - start.getTime() : null;

  return Array.from({ length: total }, (_, index) => {
    const startsAt = addRecurrence(start, recurrence, index);
    const endsAt = duration === null ? null : new Date(startsAt.getTime() + duration);
    return {
      ...basePayload,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
    };
  });
}

function route(page) {
  state.page = page;
  el.pages.forEach((p) => p.classList.toggle('is-active', p.dataset.page === page));
  el.menuItems.forEach((b) => b.classList.toggle('is-active', b.dataset.page === page));
  el.pageTitle.textContent = ({ dashboard: 'Entrada', planning: 'Planeamento' })[page] || 'Entrada';
  el.sidebar.classList.remove('is-open');
  render();
}

function setPlanningView(view) {
  state.planningView = view;
  el.planningTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.planningView === view));
  el.planningViews.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.planningView === view));
  render();
}

async function refreshEventsForCurrentScope() {
  const starts = [startOfYear(state.currentDate), startOfMonth(state.currentDate), startOfWeek(state.currentDate)];
  const ends = [endOfYear(state.currentDate), endOfMonth(state.currentDate), endOfWeek(state.currentDate)];
  const rangeStart = new Date(Math.min(...starts.map((d) => d.getTime())));
  const rangeEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
  state.events = await listEventsByRange(rangeStart.toISOString(), new Date(rangeEnd.getTime() + 86400000).toISOString());
}

async function navigateCalendar(changeFn) {
  changeFn();
  render();
  try {
    await refreshEventsForCurrentScope();
    render();
  } catch (error) {
    console.error(error);
    if (el.dayEvents) {
      el.dayEvents.innerHTML = `<p class="muted">Não consegui atualizar os eventos agora. ${escapeHtml(error?.message || '')}</p>`;
    }
  }
}

function renderDashboard() {
  const now = new Date();
  const prepWindowEnd = new Date(now);
  prepWindowEnd.setDate(now.getDate() + 30);
  const thisWeekEnd = endOfWeek(now);
  const weekEvents = state.events.filter((e) => new Date(e.starts_at) >= now && new Date(e.starts_at) <= thisWeekEnd);
  const monthEvents = state.events.filter((e) => new Date(e.starts_at).getMonth() === now.getMonth() && new Date(e.starts_at).getFullYear() === now.getFullYear());
  const prepEvents = state.events.filter((e) => {
    const days = Number(e.prepare_days_before || 0);
    if (!days) return false;
    const eventDate = new Date(e.starts_at);
    const prepStart = new Date(eventDate);
    prepStart.setDate(eventDate.getDate() - days);
    return prepStart <= prepWindowEnd && eventDate >= now;
  });
  el.stats.innerHTML = `
    <div class="stat"><div class="muted">Este mês</div><strong>${monthEvents.length} eventos</strong></div>
    <div class="stat"><div class="muted">Esta semana</div><strong>${weekEvents.length} eventos</strong></div>
    <div class="stat"><div class="muted">Preparar</div><strong>${prepEvents.length} planos</strong></div>`;
  const upcoming = [...state.events].filter((e) => new Date(e.starts_at) >= now).slice(0, 6);
  el.upcoming.innerHTML = upcoming.length
    ? upcoming.map((e) => `<div class="list-item event-list-item" style="--event-color:${eventColor(e.color)}"><div><strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(eventMeta(e) || e.area || '')}</div></div><span class="muted">${fmtDate(new Date(e.starts_at))}</span></div>`).join('')
    : '<p class="muted">Sem eventos próximos.</p>';
}

function renderYear() {
  const year = state.currentDate.getFullYear();
  el.yearLabel.textContent = String(year);
  const months = Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
  el.yearGrid.innerHTML = months.map((month) => {
    const count = state.events.filter((event) => {
      const date = new Date(event.starts_at);
      return date.getFullYear() === year && date.getMonth() === month.getMonth();
    }).length;
    return `<button class="year-card" type="button" data-month="${month.getMonth()}"><span>${month.toLocaleDateString('pt-PT', { month: 'long' })}</span><strong>${count}</strong><small>${count === 1 ? 'evento' : 'eventos'}</small></button>`;
  }).join('');
  [...el.yearGrid.querySelectorAll('.year-card')].forEach((card) => card.addEventListener('click', () => {
    state.currentDate = new Date(year, Number(card.dataset.month), 1);
    state.selectedDate = new Date(state.currentDate);
    setPlanningView('month');
  }));
}

function renderCalendar() {
  const base = state.currentDate;
  const today = new Date();
  el.calendarLabel.textContent = base.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekday);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  el.calendarGrid.innerHTML = cells.map((d) => {
    const inMonth = d.getMonth() === base.getMonth();
    const isToday = sameDay(d, today);
    const isSelected = sameDay(d, state.selectedDate);
    const dayEvents = state.events.filter((e) => sameDay(new Date(e.starts_at), d));
    return `<button class="cal-cell ${inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" type="button" data-date="${d.toISOString()}" aria-label="${fmtDate(d)}"><div class="cal-day">${d.getDate()}</div><div class="cal-events">${dayEvents.slice(0, 3).map((ev) => eventBlock(ev, 'month')).join('')}</div></button>`;
  }).join('');
  [...el.calendarGrid.querySelectorAll('.cal-cell')].forEach((btn) => btn.addEventListener('click', () => {
    const clickedDate = new Date(btn.dataset.date);
    state.selectedDate = clickedDate;
    renderDayEvents();
    openEventModal(clickedDate);
  }));
  renderDayEvents();
}

function checklistHtml(event) {
  const items = Array.isArray(event.checklist) ? event.checklist : [];
  if (!items.length) return '';
  return `<ul class="event-checklist">${items.slice(0, 6).map((item) => `<li><span class="fake-check">${item.done ? '✓' : ''}</span>${escapeHtml(item.text)}</li>`).join('')}</ul>`;
}

function renderDayEvents() {
  el.selectedDayLabel.textContent = fmtDate(state.selectedDate);
  const events = state.events.filter((e) => sameDay(new Date(e.starts_at), state.selectedDate));
  el.dayEvents.innerHTML = events.length
    ? events.map((e) => `<article class="day-plan-card" style="--event-color:${eventColor(e.color)}"><div class="day-plan-head"><div><p class="eyebrow">${escapeHtml(e.event_type || 'Evento')}</p><strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(e.area || 'Sem área')}</div></div><div class="muted">${e.all_day ? 'Dia inteiro' : readableTime(e.starts_at)}</div></div>${eventMeta(e) ? `<p class="plan-meta">${escapeHtml(eventMeta(e))}</p>` : ''}${checklistHtml(e)}${e.notes ? `<p class="muted">${escapeHtml(e.notes)}</p>` : ''}</article>`).join('')
    : '<p class="muted">Sem eventos para este dia.</p>';
}

function renderWeek() {
  const start = startOfWeek(state.currentDate);
  const end = endOfWeek(state.currentDate);
  el.weekLabel.textContent = `${fmtDate(start)} — ${fmtDate(end)}`;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  el.weekGrid.innerHTML = days.map((day) => {
    const events = state.events.filter((e) => sameDay(new Date(e.starts_at), day));
    return `<article class="week-day ${sameDay(day, new Date()) ? 'is-today' : ''}"><h5>${day.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit' })}</h5>${events.map((e) => eventBlock(e, 'week')).join('') || '<p class="muted">Sem eventos</p>'}</article>`;
  }).join('');
}

function renderToday() {
  const today = new Date();
  el.todayLabel.textContent = fmtDate(today);
  const events = state.events.filter((e) => sameDay(new Date(e.starts_at), today));
  el.todayEvents.innerHTML = events.length
    ? events.map((e) => `<article class="day-plan-card" style="--event-color:${eventColor(e.color)}"><div class="day-plan-head"><div><p class="eyebrow">${escapeHtml(e.event_type || 'Evento')}</p><strong>${escapeHtml(e.title)}</strong></div><span class="muted">${e.all_day ? 'Dia inteiro' : readableTime(e.starts_at)}</span></div>${eventMeta(e) ? `<p class="plan-meta">${escapeHtml(eventMeta(e))}</p>` : ''}${checklistHtml(e)}</article>`).join('')
    : '<p class="muted">Sem eventos para hoje.</p>';
}

function render() {
  el.topbarDate.textContent = fmtDate(new Date());
  renderDashboard();
  renderYear();
  renderCalendar();
  renderWeek();
  renderToday();
}

function syncAreaColor() {
  const area = el.eventForm.elements.area?.value || 'Casa';
  const palette = areaPalette[area] || areaPalette.Outro;
  const radio = el.eventForm.querySelector(`input[name="color"][value="${palette.color}"]`);
  if (radio) radio.checked = true;
  if (el.areaColorDot) el.areaColorDot.style.setProperty('--event-color', palette.hex);
  if (el.areaColorName) el.areaColorName.textContent = palette.name;
  if (el.areaColorNote) el.areaColorNote.textContent = `${area} fica com ${palette.name.toLowerCase()} por defeito, para manter o calendário harmonioso.`;
}

function syncSmartDefaults() {
  const type = el.eventForm.elements.event_type?.value || 'Normal';
  const prepare = el.eventForm.elements.prepare_days_before;
  const recurrence = el.eventForm.elements.recurrence;
  if (!prepare || !recurrence) return;

  if (type === 'Aniversário') { prepare.value = '14'; recurrence.value = 'yearly'; }
  if (type === 'Natal') { prepare.value = '90'; recurrence.value = 'yearly'; }
  if (type === 'Ocasião especial') { prepare.value = '30'; }
  if (type === 'Viagem') { prepare.value = '30'; }
  if (type === 'Consulta') { prepare.value = '7'; }
  if (type === 'Rotina') { prepare.value = '7'; recurrence.value = 'weekly'; }
}

function openEventModal(date = state.selectedDate) {
  const start = new Date(date);
  start.setHours(start.getHours() || 9, 0, 0, 0);
  state.selectedDate = new Date(date);
  el.eventForm.reset();
  el.eventForm.elements.starts_at.value = fmtDateTimeLocal(start);
  syncAreaColor();
  el.eventFeedback.textContent = '';
  el.eventSubmitBtn.disabled = false;
  el.eventSubmitBtn.textContent = 'Guardar evento';
  el.eventModal.classList.remove('is-hidden');
  el.eventModal.setAttribute('aria-hidden', 'false');
  el.eventForm.elements.title.focus();
}

function closeEventModal() {
  el.eventModal.classList.add('is-hidden');
  el.eventModal.setAttribute('aria-hidden', 'true');
}

async function handleAuthSubmit(ev) {
  ev.preventDefault();
  const fd = new FormData(el.authForm);
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '').trim();
  const submitter = ev.submitter?.dataset.mode || 'login';
  try {
    if (submitter === 'signup') {
      await signUp(email, password);
      el.authFeedback.textContent = 'Conta criada. Podes entrar se a confirmação de email estiver desligada.';
    } else {
      await signIn(email, password);
      el.authFeedback.textContent = 'Sessão iniciada com sucesso.';
    }
  } catch (error) {
    el.authFeedback.textContent = formatAuthError(error);
  }
}

async function handleAddEvent(ev) {
  ev.preventDefault();
  el.eventFeedback.textContent = 'A guardar…';
  el.eventSubmitBtn.disabled = true;
  el.eventSubmitBtn.textContent = 'A guardar…';

  try {
    const fd = new FormData(el.eventForm);
    const startsAt = String(fd.get('starts_at'));
    const endsAtRaw = String(fd.get('ends_at'));
    const recurrence = String(fd.get('recurrence') || 'none');
    const checklist = parseChecklist(fd.get('checklist_text'));
    const basePayload = {
      user_id: state.session.user.id,
      title: String(fd.get('title')).trim(),
      event_type: String(fd.get('event_type') || 'Normal'),
      area: String(fd.get('area')).trim() || null,
      notes: String(fd.get('notes')).trim() || null,
      color: String(fd.get('color')),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      all_day: fd.get('all_day') === 'on',
      prepare_days_before: Number(fd.get('prepare_days_before') || 0),
      recurrence,
      checklist,
      status: Number(fd.get('prepare_days_before') || 0) > 0 ? 'por_preparar' : 'normal',
    };

    const payload = buildRecurringPayload(basePayload, recurrence);
    await createEvent(payload);
    el.eventFeedback.textContent = payload.length > 1 ? `${payload.length} eventos guardados.` : 'Evento guardado.';
    await refreshEventsForCurrentScope();
    render();
    setTimeout(closeEventModal, 650);
  } catch (error) {
    el.eventFeedback.textContent = error?.message ? `Erro: ${error.message}` : 'Não foi possível guardar o evento.';
  } finally {
    el.eventSubmitBtn.disabled = false;
    el.eventSubmitBtn.textContent = 'Guardar evento';
  }
}

async function boot() {
  el.menuItems.forEach((btn) => btn.addEventListener('click', () => route(btn.dataset.page)));
  el.planningTabs.forEach((btn) => btn.addEventListener('click', () => setPlanningView(btn.dataset.planningView)));
  el.mobileMenuBtn.addEventListener('click', () => el.sidebar.classList.toggle('is-open'));
  el.quickEventBtn.addEventListener('click', () => openEventModal(new Date()));
  el.selectedDayEventBtn.addEventListener('click', () => openEventModal(state.selectedDate));
  document.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeEventModal));
  el.eventForm.elements.area.addEventListener('change', syncAreaColor);
  el.eventForm.elements.event_type.addEventListener('change', syncSmartDefaults);

  document.getElementById('prev-year').addEventListener('click', () => navigateCalendar(() => {
    state.currentDate = new Date(state.currentDate.getFullYear() - 1, 0, 1);
    state.selectedDate = new Date(state.currentDate);
  }));
  document.getElementById('next-year').addEventListener('click', () => navigateCalendar(() => {
    state.currentDate = new Date(state.currentDate.getFullYear() + 1, 0, 1);
    state.selectedDate = new Date(state.currentDate);
  }));
  document.getElementById('prev-month').addEventListener('click', () => navigateCalendar(() => setMonthSafely(-1)));
  document.getElementById('next-month').addEventListener('click', () => navigateCalendar(() => setMonthSafely(1)));
  document.getElementById('prev-week').addEventListener('click', () => navigateCalendar(() => {
    const next = new Date(state.currentDate);
    next.setDate(next.getDate() - 7);
    state.currentDate = next;
    state.selectedDate = new Date(next);
  }));
  document.getElementById('next-week').addEventListener('click', () => navigateCalendar(() => {
    const next = new Date(state.currentDate);
    next.setDate(next.getDate() + 7);
    state.currentDate = next;
    state.selectedDate = new Date(next);
  }));

  el.authForm.addEventListener('submit', handleAuthSubmit);
  el.logoutBtn.addEventListener('click', async () => { await signOut(); });
  el.eventForm.addEventListener('submit', handleAddEvent);

  if (!hasSupabaseConfig) {
    document.getElementById('app').style.display = 'none';
    el.authScreen.classList.remove('is-hidden');
    el.authFeedback.textContent = 'Configuração em falta. Preenche o ficheiro public-config.js com as credenciais públicas do Supabase.';
    return;
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    const authenticated = Boolean(session?.user);
    el.authScreen.classList.toggle('is-hidden', authenticated);
    document.getElementById('app').style.display = authenticated ? 'flex' : 'none';
    if (authenticated) {
      el.authEmail.textContent = session.user.email;
      await refreshEventsForCurrentScope();
      route(state.page);
    }
  });

  const session = await getSession();
  state.session = session;
  const authenticated = Boolean(session?.user);
  el.authScreen.classList.toggle('is-hidden', authenticated);
  document.getElementById('app').style.display = authenticated ? 'flex' : 'none';
  if (authenticated) {
    el.authEmail.textContent = session.user.email;
    await refreshEventsForCurrentScope();
    route('dashboard');
  }
}

boot();
