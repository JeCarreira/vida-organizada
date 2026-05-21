import { supabase, listEventsByRange, createEvent, updateEvent } from './services/supabase.js';

const MS_DAY = 24 * 60 * 60 * 1000;
const areaColor = {
  'Casa': 'casa',
  'Família': 'familia',
  'Filhos': 'filhos',
  'Eu': 'eu',
  'Bem-estar': 'bem-estar',
  'Casamento': 'casamento',
  'Projeto / Marca': 'projeto',
  'Papéis e burocracia': 'papeis',
  'Finanças': 'financas',
  'Rotinas': 'rotinas',
  'Social / Comunidade': 'social',
  'Outro': 'outro',
};

let cache = [];
let busy = false;

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
}

function euro(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function atTime(date, hour = 9, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a, b) {
  return isoDate(new Date(a)) === isoDate(new Date(b));
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function labelDate(value) {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function monthKey(value) {
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(value));
}

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day, 9, 0, 0, 0);
}

function lastSundayOfMay(year) {
  const d = new Date(year, 4, 31, 9, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function nthSunday(year, monthIndex, nth) {
  const d = new Date(year, monthIndex, 1, 9, 0, 0, 0);
  const firstSundayOffset = (7 - d.getDay()) % 7;
  d.setDate(1 + firstSundayOffset + (nth - 1) * 7);
  return d;
}

function franceOccasions(year) {
  const easter = easterDate(year);
  const mothers = lastSundayOfMay(year);
  const pentecost = addDays(easter, 49);
  const mothersDate = sameDay(mothers, pentecost) ? nthSunday(year, 5, 1) : mothers;

  return [
    ['Jour de l’an / Ano Novo', new Date(year, 0, 1, 9), 'Ocasião especial', 'Família', 14],
    ['Saint-Valentin / Dia dos Namorados', new Date(year, 1, 14, 9), 'Ocasião especial', 'Casamento', 21],
    ['Carnaval / Mardi Gras', addDays(easter, -47), 'Ocasião especial', 'Filhos', 30],
    ['Páscoa', easter, 'Ocasião especial', 'Família', 45],
    ['Lundi de Pâques / Segunda-feira de Páscoa', addDays(easter, 1), 'Ocasião especial', 'Família', 30],
    ['Fête du Travail / Dia do Trabalhador', new Date(year, 4, 1, 9), 'Ocasião especial', 'Família', 14],
    ['Victoire 1945', new Date(year, 4, 8, 9), 'Ocasião especial', 'Família', 14],
    ['Ascension', addDays(easter, 39), 'Ocasião especial', 'Família', 30],
    ['Fête des Mères / Dia da Mãe em França', mothersDate, 'Ocasião especial', 'Família', 45],
    ['Lundi de Pentecôte', addDays(easter, 50), 'Ocasião especial', 'Família', 21],
    ['Fête des Pères / Dia do Pai em França', nthSunday(year, 5, 3), 'Ocasião especial', 'Família', 45],
    ['Fête nationale française', new Date(year, 6, 14, 9), 'Ocasião especial', 'Família', 14],
    ['Assomption', new Date(year, 7, 15, 9), 'Ocasião especial', 'Família', 14],
    ['Halloween', new Date(year, 9, 31, 9), 'Ocasião especial', 'Filhos', 45],
    ['Toussaint', new Date(year, 10, 1, 9), 'Ocasião especial', 'Família', 14],
    ['Armistice 1918', new Date(year, 10, 11, 9), 'Ocasião especial', 'Família', 14],
    ['Natal', new Date(year, 11, 25, 9), 'Natal', 'Família', 180],
  ];
}

function zoneCSchoolDates() {
  return [
    ['Férias de verão — início França Zona C', '2026-07-04', 'Escola / filhos', 'Filhos', 60],
    ['Rentrée scolaire — França Zona C', '2026-09-01', 'Escola / filhos', 'Filhos', 60],
    ['Vacances de la Toussaint — Zona C começa', '2026-10-17', 'Escola / filhos', 'Filhos', 30],
    ['Vacances de la Toussaint — Zona C termina', '2026-11-02', 'Escola / filhos', 'Filhos', 7],
    ['Vacances de Noël — Zona C começa', '2026-12-19', 'Escola / filhos', 'Filhos', 45],
    ['Vacances de Noël — Zona C termina', '2027-01-04', 'Escola / filhos', 'Filhos', 7],
    ['Vacances d’hiver — Zona C começa', '2027-02-06', 'Escola / filhos', 'Filhos', 45],
    ['Vacances d’hiver — Zona C termina', '2027-02-22', 'Escola / filhos', 'Filhos', 7],
    ['Vacances de printemps — Zona C começa', '2027-04-03', 'Escola / filhos', 'Filhos', 45],
    ['Vacances de printemps — Zona C termina', '2027-04-19', 'Escola / filhos', 'Filhos', 7],
    ['Ponte escolar em França — sem aulas', '2027-05-07', 'Escola / filhos', 'Filhos', 14],
    ['Férias de verão — início França Zona C', '2027-07-03', 'Escola / filhos', 'Filhos', 60],
  ];
}

function baseChecklist(title) {
  const key = normalize(title);
  if (key.includes('terapia')) {
    return [
      'Confirmar horário e morada da terapia',
      'Preparar documentos, relatórios ou orientações anteriores',
      'Anotar evolução, dificuldades e dúvidas para falar na sessão',
      'Preparar lanche, água, muda de roupa ou material se for necessário',
      'Depois da terapia, anotar orientações práticas para casa',
      'Marcar ou confirmar próxima sessão',
    ];
  }
  if (key.includes('casa') || key.includes('rotina') || key.includes('roupa') || key.includes('refeicoes')) {
    return [
      'Definir versão mínima para dias sem energia',
      'Separar material necessário antes de começar',
      'Executar apenas o primeiro bloco de 15 minutos',
      'Marcar como feito o que ficou concluído',
      'Ajustar a rotina para ficar mais realista na semana seguinte',
    ];
  }
  if (key.includes('financas') || key.includes('orcamento')) {
    return [
      'Registar valor disponível do mês',
      'Separar despesas fixas, variáveis e compras futuras',
      'Criar envelope para eventos, crianças, casa, roupa e imprevistos',
      'Anotar compras previstas antes de comprar',
      'No fim da semana, rever gasto real e ajustar o mês',
    ];
  }
  return [
    'Confirmar data, hora e contexto',
    'Definir orçamento ou limite claro, se houver compras',
    'Listar próximos passos pequenos',
    'Preparar tudo com antecedência realista',
    'Na véspera, rever o plano e deixar o essencial pronto',
  ];
}

function eventPayload({ title, date, area = 'Família', event_type = 'Normal', prepare = 7, recurrence = 'none', checklist, budget = 0, notes = '' }) {
  const starts = atTime(new Date(date), 9, 0);
  return {
    title,
    starts_at: starts.toISOString(),
    ends_at: null,
    all_day: false,
    area,
    color: areaColor[area] || 'outro',
    event_type,
    prepare_days_before: prepare,
    recurrence,
    checklist: (checklist || baseChecklist(title)).map((text) => ({ text, done: false })),
    status: 'por_preparar',
    budget_estimate: budget,
    budget_spent: 0,
    budget_currency: 'EUR',
    shopping_list: [],
    notes,
  };
}

async function fetchEvents() {
  if (!supabase) return [];
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 2, 11, 31, 23, 59, 59);
  cache = await listEventsByRange(start.toISOString(), end.toISOString());
  return cache;
}

async function safeCreate(payloads, label = 'plano') {
  if (busy) return;
  busy = true;
  try {
    await createEvent(Array.isArray(payloads) ? payloads : [payloads]);
    await fetchEvents();
    renderActiveLifePage();
    notify(`${label} criado.`);
  } catch (error) {
    alert(error?.message || 'Não foi possível criar.');
  } finally {
    busy = false;
  }
}

function notify(message) {
  let toast = document.getElementById('life-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'life-toast';
    toast.className = 'life-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2500);
}

function injectNav() {
  const menu = document.getElementById('menu');
  if (!menu || menu.dataset.lifeNav === 'true') return;
  menu.dataset.lifeNav = 'true';
  const entries = [
    ['life-today', 'Hoje inteligente'],
    ['life-home', 'Casa & Rotinas'],
    ['life-family', 'Filhos / Escola / Família'],
    ['life-finance', 'Finanças'],
  ];
  entries.forEach(([id, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'life-menu-item';
    button.dataset.lifePage = id;
    button.textContent = label;
    menu.appendChild(button);
  });
}

function injectPages() {
  const main = document.getElementById('main-content');
  if (!main || document.getElementById('life-today')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <section class="life-page" id="life-today" hidden></section>
    <section class="life-page" id="life-home" hidden></section>
    <section class="life-page" id="life-family" hidden></section>
    <section class="life-page" id="life-finance" hidden></section>`;
  main.append(...wrapper.children);
}

function setLifePage(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.remove('is-active'));
  document.querySelectorAll('.life-page').forEach((page) => { page.hidden = true; });
  document.querySelectorAll('.menu-item, .life-menu-item').forEach((item) => item.classList.remove('is-active'));

  const page = document.getElementById(pageId);
  if (page) page.hidden = false;
  document.querySelector(`[data-life-page="${pageId}"]`)?.classList.add('is-active');
  const title = document.getElementById('page-title');
  if (title) title.textContent = document.querySelector(`[data-life-page="${pageId}"]`)?.textContent || 'Sistema';
  renderActiveLifePage();
}

function activeLifePageId() {
  return [...document.querySelectorAll('.life-page')].find((page) => !page.hidden)?.id || null;
}

function status(event) {
  const items = Array.isArray(event.checklist) ? event.checklist : [];
  const done = items.filter((item) => item.done).length;
  return { items, done, total: items.length };
}

function eventPrepStarted(event) {
  const start = new Date(event.starts_at);
  const prepStart = addDays(start, -Number(event.prepare_days_before || 0));
  return prepStart <= new Date();
}

function pendingActions(events) {
  const today = startOfDay();
  return events.flatMap((event) => {
    const start = new Date(event.starts_at);
    const items = Array.isArray(event.checklist) ? event.checklist : [];
    const prepStart = addDays(start, -Number(event.prepare_days_before || 0));
    return items.map((item, index) => ({ event, item, index, start, prepStart }))
      .filter((row) => !row.item.done && row.prepStart <= today && row.event.status !== 'concluido');
  }).sort((a, b) => a.start - b.start);
}

function actionList(rows, limit = 8) {
  if (!rows.length) return '<p class="muted">Sem ações pendentes nesta categoria.</p>';
  return `<ul class="life-action-list">${rows.slice(0, limit).map((row) => `
    <li>
      <button type="button" data-life-check="${row.event.id}" data-check-index="${row.index}">
        <span class="life-check-box"></span>
        <span>${escapeHtml(row.item.text)}<small>${escapeHtml(row.event.title)} · ${labelDate(row.event.starts_at)}</small></span>
      </button>
    </li>`).join('')}</ul>`;
}

async function markAction(eventId, index) {
  if (busy) return;
  busy = true;
  try {
    const event = cache.find((item) => String(item.id) === String(eventId)) || (await fetchEvents()).find((item) => String(item.id) === String(eventId));
    if (!event) throw new Error('Evento não encontrado.');
    const checklist = Array.isArray(event.checklist) ? event.checklist.map((item) => ({ ...item })) : [];
    if (!checklist[index]) throw new Error('Ação não encontrada.');
    checklist[index].done = true;
    const allDone = checklist.length && checklist.every((item) => item.done);
    const someDone = checklist.some((item) => item.done);
    await updateEvent(eventId, { checklist, status: allDone ? 'concluido' : someDone ? 'em_curso' : event.status });
    await fetchEvents();
    renderActiveLifePage();
  } catch (error) {
    alert(error?.message || 'Não foi possível marcar como feito.');
  } finally {
    busy = false;
  }
}

function renderTodaySmart() {
  const page = document.getElementById('life-today');
  if (!page) return;
  const now = new Date();
  const todayEvents = cache.filter((event) => sameDay(event.starts_at, now));
  const rows = pendingActions(cache);
  const urgent = rows.filter((row) => row.start <= addDays(now, 7));
  const soft = rows.filter((row) => row.start > addDays(now, 7));
  const overdue = rows.filter((row) => row.start < startOfDay(now));
  const energy = urgent[0] || soft[0];

  page.innerHTML = `
    <div class="life-hero">
      <p class="eyebrow">Execução diária inteligente</p>
      <h3>Hoje fazes o próximo passo, não a vida toda.</h3>
      <p>Este painel cruza calendário, checklists, preparação antecipada e energia real. A ideia é reduzir ruído e mostrar só o que ajuda hoje.</p>
    </div>
    <div class="life-grid two">
      <article class="life-card strong"><h4>Prioridade real</h4>${actionList(urgent, 5)}</article>
      <article class="life-card"><h4>Modo sem energia</h4>${energy ? `<p>Faz só isto e já ganhas movimento:</p>${actionList([energy], 1)}` : '<p class="muted">Sem ação mínima pendente.</p>'}</article>
      <article class="life-card"><h4>Preparar sem pressão</h4>${actionList(soft, 6)}</article>
      <article class="life-card danger-soft"><h4>Atrasado / precisa de atenção</h4>${actionList(overdue, 6)}</article>
    </div>
    <section class="life-card"><h4>Eventos de hoje</h4>${todayEvents.length ? todayEvents.map(eventMiniCard).join('') : '<p class="muted">Sem eventos marcados para hoje.</p>'}</section>`;
}

function eventMiniCard(event) {
  const s = status(event);
  return `<div class="life-mini-event"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.area || 'Sem área')} · ${s.done}/${s.total || 0} ações</span></div>`;
}

function templateButton(template, label = 'Criar') {
  return `<button type="button" class="text-btn" data-create-template="${template}">${label}</button>`;
}

function renderHomeRoutines() {
  const page = document.getElementById('life-home');
  if (!page) return;
  const routineEvents = cache.filter((event) => ['Casa', 'Rotinas'].includes(event.area));
  page.innerHTML = `
    <div class="life-hero">
      <p class="eyebrow">Casa & Rotinas</p>
      <h3>A casa com versão realista, não perfeita.</h3>
      <p>Rotinas recorrentes, reset semanal, roupa, refeições e manutenção — sempre com versão mínima para semanas difíceis.</p>
    </div>
    <div class="life-grid three">
      <article class="life-card"><h4>Reset semanal da casa</h4><p>Bloco recorrente para devolver ordem sem virar faxina gigante.</p>${templateButton('home-reset')}</article>
      <article class="life-card"><h4>Roupa da semana</h4><p>Lavar, secar, dobrar, guardar e preparar roupa dos miúdos.</p>${templateButton('home-laundry')}</article>
      <article class="life-card"><h4>Refeições & supermercado</h4><p>Menu simples, lista de compras e preparação básica.</p>${templateButton('home-meals')}</article>
      <article class="life-card"><h4>Limpeza por zonas</h4><p>Casa dividida por blocos: cozinha, casas de banho, quartos e sala.</p>${templateButton('home-cleaning')}</article>
      <article class="life-card"><h4>Manutenção da casa</h4><p>Trocas, reparações, documentos, filtros, revisões e pequenos arranjos.</p>${templateButton('home-maintenance')}</article>
      <article class="life-card"><h4>Modo mínimo</h4><p>Plano para dias sem energia: 3 ações pequenas que seguram a casa.</p>${templateButton('home-low-energy')}</article>
    </div>
    <section class="life-card"><h4>Rotinas ativas</h4>${routineEvents.length ? routineEvents.slice(0, 10).map(eventMiniCard).join('') : '<p class="muted">Ainda não tens rotinas criadas.</p>'}</section>`;
}

function renderFamilySchool() {
  const page = document.getElementById('life-family');
  if (!page) return;
  const familyEvents = cache.filter((event) => ['Filhos', 'Família'].includes(event.area));
  page.innerHTML = `
    <div class="life-hero">
      <p class="eyebrow">Filhos / Escola / Família</p>
      <h3>Tudo o que envolve crianças, escola, terapias e datas de França.</h3>
      <p>Inclui terapias do Martim e da Ariana, material escolar, férias, feriados, Dia da Mãe/Pai em França, Páscoa, Carnaval, Halloween, Natal e ocasiões familiares.</p>
    </div>
    <div class="life-grid three">
      <article class="life-card"><h4>Terapia do Martim</h4><p>Dossier recorrente para sessão, notas, dúvidas e orientações para casa.</p>${templateButton('therapy-martim')}</article>
      <article class="life-card"><h4>Terapia da Ariana</h4><p>Dossier recorrente para sessão, evolução, documentos e preparação.</p>${templateButton('therapy-ariana')}</article>
      <article class="life-card"><h4>Material escolar Setembro</h4><p>Comprar com antecedência, etiquetar, rever roupa e preparar rotinas.</p>${templateButton('school-september')}</article>
      <article class="life-card"><h4>Guarda-roupa dos miúdos</h4><p>Ver tamanhos, peças em falta, estação, escola e calçado.</p>${templateButton('kids-wardrobe')}</article>
      <article class="life-card"><h4>Datas de França 2026/2027</h4><p>Feriados, ocasiões familiares e férias escolares Zona C.</p>${templateButton('france-dates', 'Importar datas França')}</article>
      <article class="life-card"><h4>Ocasiões da família</h4><p>Aniversários, festas, presentes, lembranças, roupas e compras.</p>${templateButton('family-occasions')}</article>
    </div>
    <section class="life-card"><h4>Família e escola no calendário</h4>${familyEvents.length ? familyEvents.slice(0, 12).map(eventMiniCard).join('') : '<p class="muted">Ainda não tens eventos familiares suficientes para analisar.</p>'}</section>`;
}

function shoppingRows(events) {
  return events.flatMap((event) => (Array.isArray(event.shopping_list) ? event.shopping_list : []).map((item) => ({ event, item }))).filter((row) => row.item?.name && !row.item.bought);
}

function renderFinance() {
  const page = document.getElementById('life-finance');
  if (!page) return;
  const budgetEvents = cache.filter((event) => Number(event.budget_estimate || 0) || (Array.isArray(event.shopping_list) && event.shopping_list.length));
  const total = budgetEvents.reduce((sum, event) => sum + Number(event.budget_estimate || 0), 0);
  const spent = budgetEvents.reduce((sum, event) => sum + Number(event.budget_spent || 0), 0);
  const pending = shoppingRows(budgetEvents);
  const byArea = budgetEvents.reduce((acc, event) => {
    const area = event.area || 'Sem área';
    acc[area] = (acc[area] || 0) + Number(event.budget_estimate || 0);
    return acc;
  }, {});

  page.innerHTML = `
    <div class="life-hero">
      <p class="eyebrow">Finanças, compras e orçamento familiar</p>
      <h3>Dinheiro ligado ao que vais viver, comprar e preparar.</h3>
      <p>O objetivo é antecipar gastos: Natal, aniversários, férias, roupa, escola, casa, presentes e imprevistos.</p>
    </div>
    <div class="life-grid four">
      <article class="life-card metric"><small>Orçamento previsto</small><strong>${euro(total)}</strong></article>
      <article class="life-card metric"><small>Já gasto</small><strong>${euro(spent)}</strong></article>
      <article class="life-card metric"><small>Por gastar</small><strong>${euro(Math.max(0, total - spent))}</strong></article>
      <article class="life-card metric"><small>Compras pendentes</small><strong>${pending.length}</strong></article>
    </div>
    <div class="life-grid two">
      <article class="life-card"><h4>Próximas compras</h4>${pending.length ? `<ul class="finance-list">${pending.slice(0, 12).map((row) => `<li><span>${escapeHtml(row.item.name)}</span><strong>${euro(row.item.estimated || 0)}</strong><small>${escapeHtml(row.event.title)}</small></li>`).join('')}</ul>` : '<p class="muted">Sem compras pendentes registadas.</p>'}</article>
      <article class="life-card"><h4>Orçamento por área</h4>${Object.keys(byArea).length ? `<ul class="finance-list">${Object.entries(byArea).map(([area, value]) => `<li><span>${escapeHtml(area)}</span><strong>${euro(value)}</strong></li>`).join('')}</ul>` : '<p class="muted">Ainda não há orçamento por área.</p>'}</article>
    </div>
    <div class="life-grid two">
      <article class="life-card"><h4>Criar orçamento mensal familiar</h4><p>Evento recorrente para rever dinheiro, envelopes e compras futuras.</p>${templateButton('monthly-budget')}</article>
      <article class="life-card"><h4>Criar compras mensais da casa</h4><p>Lista base para supermercado, farmácia, casa, crianças e imprevistos.</p>${templateButton('monthly-shopping')}</article>
    </div>`;
}

function renderActiveLifePage() {
  const id = activeLifePageId();
  if (id === 'life-today') renderTodaySmart();
  if (id === 'life-home') renderHomeRoutines();
  if (id === 'life-family') renderFamilySchool();
  if (id === 'life-finance') renderFinance();
}

function nextWeekdayDate(weekday = 1, hour = 9) {
  const today = new Date();
  const d = atTime(today, hour, 0);
  const diff = (weekday + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function weeklySeries({ title, weekday, area, event_type, checklist, weeks = 12, hour = 9, prepare = 1 }) {
  const first = nextWeekdayDate(weekday, hour);
  return Array.from({ length: weeks }, (_, i) => eventPayload({ title, date: addDays(first, i * 7), area, event_type, prepare, recurrence: 'weekly', checklist }));
}

function monthlySeries({ title, area, event_type, checklist, months = 12, day = 1, hour = 9, prepare = 3 }) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() + i, day, hour, 0, 0, 0);
    return eventPayload({ title, date, area, event_type, prepare, recurrence: 'monthly', checklist });
  });
}

const templateHandlers = {
  'home-reset': () => safeCreate(weeklySeries({ title: 'Reset semanal da casa', weekday: 5, area: 'Casa', event_type: 'Rotina', checklist: ['Recolher objetos fora do sítio', 'Fazer reset rápido da cozinha', 'Rever roupa pendente', 'Deitar lixo fora', 'Preparar 3 prioridades da casa para a semana'] }), 'Rotina da casa'),
  'home-laundry': () => safeCreate(weeklySeries({ title: 'Roupa da semana', weekday: 1, area: 'Casa', event_type: 'Rotina', checklist: ['Separar roupa por tipo/cor', 'Lavar uma máquina prioritária', 'Pôr a secar', 'Dobrar e guardar uma parte', 'Separar roupa dos miúdos para a semana'] }), 'Rotina de roupa'),
  'home-meals': () => safeCreate(weeklySeries({ title: 'Refeições e supermercado', weekday: 0, area: 'Casa', event_type: 'Rotina', checklist: ['Escolher 4 refeições simples', 'Ver o que já existe em casa', 'Criar lista de supermercado', 'Comprar o essencial', 'Preparar uma base para facilitar a semana'] }), 'Rotina de refeições'),
  'home-cleaning': () => safeCreate(weeklySeries({ title: 'Limpeza por zonas', weekday: 3, area: 'Casa', event_type: 'Rotina', checklist: ['Escolher só uma zona principal', 'Fazer 15 minutos de destralhe rápido', 'Limpar superfícies', 'Aspirar ou lavar chão se couber', 'Anotar o que fica para outro dia'] }), 'Rotina de limpeza'),
  'home-maintenance': () => safeCreate(monthlySeries({ title: 'Manutenção da casa', area: 'Casa', event_type: 'Rotina', checklist: ['Rever lâmpadas, pilhas, filtros e pequenos arranjos', 'Ver documentos ou contas da casa', 'Anotar compras de manutenção', 'Resolver uma pendência pequena', 'Marcar ajuda externa se necessário'] }), 'Manutenção da casa'),
  'home-low-energy': () => safeCreate(eventPayload({ title: 'Modo mínimo da casa', date: new Date(), area: 'Casa', event_type: 'Rotina', prepare: 0, checklist: ['Abrir janelas 5 minutos', 'Guardar 10 objetos fora do sítio', 'Fazer uma superfície visível', 'Tratar uma coisa da cozinha', 'Escolher só uma tarefa para amanhã'] }), 'Modo mínimo'),
  'therapy-martim': () => safeCreate(weeklySeries({ title: 'Terapia Martim', weekday: 2, area: 'Filhos', event_type: 'Consulta', weeks: 16, checklist: baseChecklist('terapia Martim') }), 'Terapia do Martim'),
  'therapy-ariana': () => safeCreate(weeklySeries({ title: 'Terapia Ariana', weekday: 2, area: 'Filhos', event_type: 'Consulta', weeks: 16, checklist: baseChecklist('terapia Ariana') }), 'Terapia da Ariana'),
  'school-september': () => safeCreate(eventPayload({ title: 'Preparar material escolar de Setembro', date: new Date(new Date().getFullYear(), 7, 1, 9), area: 'Filhos', event_type: 'Escola / filhos', prepare: 90, checklist: baseChecklist('material escolar setembro'), budget: 250 }), 'Material escolar'),
  'kids-wardrobe': () => safeCreate(eventPayload({ title: 'Renovar guarda-roupa dos miúdos', date: addDays(new Date(), 14), area: 'Filhos', event_type: 'Escola / filhos', prepare: 30, checklist: baseChecklist('guarda roupa crianças'), budget: 300 }), 'Guarda-roupa dos miúdos'),
  'france-dates': () => {
    const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
    const publicDates = years.flatMap((year) => franceOccasions(year).map(([title, date, event_type, area, prepare]) => eventPayload({ title, date, area, event_type, prepare, recurrence: event_type === 'Natal' || title.includes('Dia') || title.includes('Fête') ? 'yearly' : 'none', checklist: baseChecklist(title) })));
    const schoolDates = zoneCSchoolDates().map(([title, date, event_type, area, prepare]) => eventPayload({ title, date: new Date(`${date}T09:00:00`), area, event_type, prepare, checklist: baseChecklist(title) }));
    safeCreate([...publicDates, ...schoolDates], 'Datas de França');
  },
  'family-occasions': () => safeCreate(eventPayload({ title: 'Mapa de ocasiões da família', date: addDays(new Date(), 7), area: 'Família', event_type: 'Ocasião especial', prepare: 60, checklist: ['Listar aniversários importantes', 'Listar dias especiais da escola e família', 'Criar orçamento para presentes do trimestre', 'Ver presentes, cartões e lembranças com antecedência', 'Separar datas que precisam de roupa, bolo, comida ou deslocação'] }), 'Mapa de ocasiões'),
  'monthly-budget': () => safeCreate(monthlySeries({ title: 'Revisão mensal das finanças familiares', area: 'Finanças', event_type: 'Rotina', day: 1, checklist: baseChecklist('finanças orçamento') }), 'Orçamento mensal'),
  'monthly-shopping': () => safeCreate(monthlySeries({ title: 'Compras mensais da casa e família', area: 'Finanças', event_type: 'Rotina', day: 3, checklist: ['Ver stock da casa antes de comprar', 'Separar compras por supermercado, farmácia, casa, crianças e extras', 'Definir orçamento do mês', 'Comprar primeiro essenciais', 'Atualizar lista de compras pendentes'] }), 'Compras mensais'),
};

function installHandlers() {
  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-life-page]');
    if (nav) {
      event.preventDefault();
      setLifePage(nav.dataset.lifePage);
      return;
    }

    const appNav = event.target.closest('.menu-item[data-page]');
    if (appNav) {
      document.querySelectorAll('.life-page').forEach((page) => { page.hidden = true; });
      document.querySelectorAll('.life-menu-item').forEach((item) => item.classList.remove('is-active'));
    }

    const check = event.target.closest('[data-life-check]');
    if (check) {
      event.preventDefault();
      markAction(check.dataset.lifeCheck, Number(check.dataset.checkIndex));
      return;
    }

    const create = event.target.closest('[data-create-template]');
    if (create) {
      event.preventDefault();
      const handler = templateHandlers[create.dataset.createTemplate];
      if (handler) handler();
    }
  }, true);
}

function installStyles() {
  if (document.getElementById('phase-07-10-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="phase-07-10-styles">
    .life-menu-item{width:100%;border:0;background:transparent;text-align:left;padding:12px 16px;font:inherit;color:var(--ink);cursor:pointer}.life-menu-item:hover,.life-menu-item.is-active{background:#e8dcc8}.life-page{padding:32px 34px 64px}.life-hero{border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:22px}.life-hero h3{font-size:clamp(1.8rem,3vw,3rem);margin:.25rem 0}.life-grid{display:grid;gap:14px;margin:14px 0 22px}.life-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.life-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.life-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.life-card{border:1px solid var(--line);background:rgba(255,250,244,.72);padding:18px}.life-card.strong{background:#efe3ce}.life-card.danger-soft{background:#f3e4df}.life-card h4{margin:0 0 12px}.life-card.metric strong{font-size:1.7rem;display:block;margin-top:8px}.life-card.metric small,.life-mini-event span,.life-action-list small{color:var(--soft-ink);display:block}.life-action-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}.life-action-list button{width:100%;display:grid;grid-template-columns:24px 1fr;gap:10px;text-align:left;align-items:start;border:1px solid var(--line);background:#fffaf4;padding:10px;font:inherit;cursor:pointer}.life-check-box{width:16px;height:16px;border:1px solid var(--brown);margin-top:3px;background:#fff}.life-mini-event{border-bottom:1px solid var(--line);padding:9px 0}.finance-list{list-style:none;margin:0;padding:0}.finance-list li{display:grid;grid-template-columns:1fr auto;gap:8px;border-bottom:1px solid var(--line);padding:9px 0}.finance-list small{grid-column:1/-1;color:var(--soft-ink)}.life-toast{position:fixed;right:22px;bottom:22px;background:var(--brown);color:#fffaf4;padding:12px 16px;z-index:1000;opacity:0;transform:translateY(10px);transition:.2s}.life-toast.is-visible{opacity:1;transform:translateY(0)}@media(max-width:1000px){.life-grid.two,.life-grid.three,.life-grid.four{grid-template-columns:1fr}.life-page{padding:24px 18px 48px}}
  </style>`);
}

async function boot() {
  injectNav();
  injectPages();
  installStyles();
  installHandlers();
  await fetchEvents().catch(() => []);
}

boot();
