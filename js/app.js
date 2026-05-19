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

const state = {
  page: 'dashboard',
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
  sidebar: document.getElementById('sidebar'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  stats: document.getElementById('dashboard-stats'),
  upcoming: document.getElementById('dashboard-upcoming'),
  calendarLabel: document.getElementById('calendar-label'),
  calendarGrid: document.getElementById('calendar-grid'),
  dayEvents: document.getElementById('day-events'),
  selectedDayLabel: document.getElementById('selected-day-label'),
  weekLabel: document.getElementById('week-label'),
  weekGrid: document.getElementById('week-grid'),
  todayLabel: document.getElementById('today-label'),
  todayEvents: document.getElementById('today-events'),
  eventForm: document.getElementById('event-form'),
};

function fmtDate(date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

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
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function eventColor(name) {
  return ({
    areia: '#a18464',
    castanho: '#6a4b33',
    grafite: '#3f3f42',
  })[name] || '#6a4b33';
}

function route(page) {
  state.page = page;
  el.pages.forEach((p) => p.classList.toggle('is-active', p.dataset.page === page));
  el.menuItems.forEach((b) => b.classList.toggle('is-active', b.dataset.page === page));
  el.pageTitle.textContent = ({
    dashboard: 'Dashboard',
    calendar: 'Calendário',
    week: 'Semana',
    today: 'Hoje',
  })[page];
  el.sidebar.classList.remove('is-open');
  render();
}

async function refreshEventsForCurrentScope() {
  const rangeStart = new Date(Math.min(startOfMonth(state.currentDate), startOfWeek(state.currentDate)));
  const rangeEnd = new Date(Math.max(endOfMonth(state.currentDate), endOfWeek(state.currentDate)));
  state.events = await listEventsByRange(
    rangeStart.toISOString(),
    new Date(rangeEnd.getTime() + 86400000).toISOString(),
  );
}

function renderDashboard() {
  const now = new Date();
  const thisWeekEnd = endOfWeek(now);
  const weekEvents = state.events.filter((e) => new Date(e.starts_at) >= now && new Date(e.starts_at) <= thisWeekEnd);
  const monthEvents = state.events.filter((e) => new Date(e.starts_at).getMonth() === now.getMonth());

  el.stats.innerHTML = `
    <div class="stat"><div class="muted">Este mês</div><strong>${monthEvents.length} eventos</strong></div>
    <div class="stat"><div class="muted">Esta semana</div><strong>${weekEvents.length} eventos</strong></div>
    <div class="stat"><div class="muted">Hoje</div><strong>${state.events.filter((e) => sameDay(new Date(e.starts_at), now)).length} eventos</strong></div>`;

  const upcoming = [...state.events].filter((e) => new Date(e.starts_at) >= now).slice(0, 6);

  el.upcoming.innerHTML = upcoming.length
    ? upcoming.map((e) => `<div class="list-item"><span>${e.title}</span><span class="muted">${fmtDate(new Date(e.starts_at))}</span></div>`).join('')
    : '<p class="muted">Sem eventos próximos.</p>';
}

function renderCalendar() {
  const base = state.currentDate;
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
    const dayEvents = state.events.filter((e) => sameDay(new Date(e.starts_at), d));

    return `<button class="cal-cell ${inMonth ? '' : 'is-out'}" data-date="${d.toISOString()}"><div class="cal-day">${d.getDate()}</div>${dayEvents.slice(0, 3).map((ev) => `<span class="cal-dot" style="background:${eventColor(ev.color)}"></span>`).join('')}</button>`;
  }).join('');

  [...el.calendarGrid.querySelectorAll('.cal-cell')].forEach((btn) => btn.addEventListener('click', () => {
    state.selectedDate = new Date(btn.dataset.date);
    renderDayEvents();
  }));

  renderDayEvents();
}

function renderDayEvents() {
  el.selectedDayLabel.textContent = fmtDate(state.selectedDate);
  const events = state.events.filter((e) => sameDay(new Date(e.starts_at), state.selectedDate));

  el.dayEvents.innerHTML = events.length
    ? events.map((e) => `<div class="list-item"><div><strong>${e.title}</strong><div class="muted">${e.area || 'Sem área'}</div></div><div class="muted">${new Date(e.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div></div>`).join('')
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

    return `<article class="week-day"><h5>${day.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit' })}</h5>${events.map((e) => `<div class="event-tag" style="border-color:${eventColor(e.color)}">${e.title}</div>`).join('') || '<p class="muted">Sem eventos</p>'}</article>`;
  }).join('');
}

function renderToday() {
  const today = new Date();
  el.todayLabel.textContent = fmtDate(today);

  const events = state.events.filter((e) => sameDay(new Date(e.starts_at), today));

  el.todayEvents.innerHTML = events.length
    ? events.map((e) => `<div class="list-item"><span>${e.title}</span><span class="muted">${new Date(e.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')
    : '<p class="muted">Sem eventos para hoje.</p>';
}

function render() {
  el.topbarDate.textContent = fmtDate(new Date());
  renderDashboard();
  renderCalendar();
  renderWeek();
  renderToday();
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
      el.authFeedback.textContent = 'Conta criada. Verifica o email se a confirmação estiver ativa.';
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

  const fd = new FormData(el.eventForm);
  const startsAt = String(fd.get('starts_at'));
  const endsAtRaw = String(fd.get('ends_at'));

  const payload = {
    user_id: state.session.user.id,
    title: String(fd.get('title')).trim(),
    area: String(fd.get('area')).trim() || null,
    notes: String(fd.get('notes')).trim() || null,
    color: String(fd.get('color')),
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
    all_day: fd.get('all_day') === 'on',
  };

  await createEvent(payload);
  el.eventForm.reset();
  await refreshEventsForCurrentScope();
  render();
}

async function boot() {
  el.menuItems.forEach((btn) => btn.addEventListener('click', () => route(btn.dataset.page)));
  el.mobileMenuBtn.addEventListener('click', () => el.sidebar.classList.toggle('is-open'));

  document.getElementById('prev-month').addEventListener('click', async () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    await refreshEventsForCurrentScope();
    render();
  });

  document.getElementById('next-month').addEventListener('click', async () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    await refreshEventsForCurrentScope();
    render();
  });

  document.getElementById('prev-week').addEventListener('click', async () => {
    state.currentDate.setDate(state.currentDate.getDate() - 7);
    await refreshEventsForCurrentScope();
    render();
  });

  document.getElementById('next-week').addEventListener('click', async () => {
    state.currentDate.setDate(state.currentDate.getDate() + 7);
    await refreshEventsForCurrentScope();
    render();
  });

  el.authForm.addEventListener('submit', handleAuthSubmit);
  el.logoutBtn.addEventListener('click', async () => {
    await signOut();
  });
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
