import { supabase, updateEvent } from './services/supabase.js';

let activeEventId = null;
let busy = false;

const areaOptions = ['Casa', 'Família', 'Filhos', 'Eu', 'Bem-estar', 'Casamento', 'Projeto / Marca', 'Papéis e burocracia', 'Finanças', 'Rotinas', 'Social / Comunidade', 'Outro'];
const typeOptions = ['Normal', 'Aniversário', 'Ocasião especial', 'Natal', 'Viagem', 'Consulta', 'Escola / filhos', 'Projeto', 'Rotina'];
const statusOptions = [['normal', 'Normal'], ['por_preparar', 'Por preparar'], ['em_curso', 'A preparar'], ['quase_pronto', 'Quase pronto'], ['pronto', 'Pronto'], ['concluido', 'Concluído']];
const recurrenceOptions = [['none', 'Não repetir'], ['daily', 'Todos os dias'], ['weekly', 'Todas as semanas'], ['monthly', 'Todos os meses'], ['yearly', 'Todos os anos']];
const prepareOptions = [['0','No próprio dia'],['1','1 dia antes'],['3','3 dias antes'],['7','1 semana antes'],['14','2 semanas antes'],['30','1 mês antes'],['60','2 meses antes'],['90','3 meses antes'],['120','4 meses antes'],['180','6 meses antes'],['270','9 meses antes'],['365','1 ano antes']];

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function optionList(options, selected) {
  return options.map((item) => {
    const value = Array.isArray(item) ? item[0] : item;
    const label = Array.isArray(item) ? item[1] : item;
    return `<option value="${escapeHtml(value)}" ${String(value) === String(selected || '') ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function readEvent(eventId) {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

function rememberEvent(event) {
  const opener = event.target.closest('[data-event-id]');
  if (opener?.dataset.eventId) activeEventId = opener.dataset.eventId;
}

function groupName(text) {
  const t = normalize(text);
  if (/(orcamento|decidir|definir|escolher|tema|objetivo|ideias|inspiracoes|lista de convidados|plano)/.test(t)) return 'Decisões';
  if (/(comprar|encomendar|presente|lembranca|papel|sacos|etiquetas|decoracao|ingredientes|supermercado|loja|bilhete|reservar|orcamento)/.test(t)) return 'Compras e orçamento';
  if (/(confirmar|avisar|convidados|escola|turma|pessoa|adulto|respostas|autoriza|morada|horario)/.test(t)) return 'Pessoas e confirmações';
  if (/(casa|zona|mesa|organizar|separar|preparar materiais|arrumar|malas|documentos|pasta)/.test(t)) return 'Casa e preparação';
  if (/(vespera|dia anterior|dois dias antes|semana anterior)/.test(t)) return 'Dia anterior';
  if (/(proprio dia|no dia|sair|fotografar|verificar|levar)/.test(t)) return 'No próprio dia';
  if (/(depois|anotar orientacoes|guardar aprendizagem|rever)/.test(t)) return 'Depois';
  return 'Outras ações';
}

function renderGroupedChecklist(event) {
  const items = Array.isArray(event.checklist) ? event.checklist : [];
  if (!items.length) return '<p class="muted">Ainda não há checklist para organizar.</p>';
  const groups = new Map();
  items.forEach((item, index) => {
    const name = groupName(item.text);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ ...item, index });
  });
  return [...groups.entries()].map(([name, groupItems]) => `
    <section class="dossier-check-group">
      <h5>${escapeHtml(name)}</h5>
      <ul class="event-checklist detail-checklist">
        ${groupItems.map((item) => `<li class="${item.done ? 'is-done' : ''}"><label><input type="checkbox" data-check-index="${item.index}" ${item.done ? 'checked' : ''}> <span>${escapeHtml(item.text)}</span></label></li>`).join('')}
      </ul>
    </section>`).join('');
}

function renderEditPanel(event) {
  return `
    <section class="phase-panel is-hidden" data-panel="edit">
      <h4>Editar evento</h4>
      <form id="phase-edit-form" class="form">
        <label>Título<input name="title" value="${escapeHtml(event.title)}" required></label>
        <div class="form-row"><label>Início<input name="starts_at" type="datetime-local" value="${toDateTimeLocal(event.starts_at)}" required></label><label>Fim<input name="ends_at" type="datetime-local" value="${toDateTimeLocal(event.ends_at)}"></label></div>
        <div class="form-row"><label>Tipo<select name="event_type">${optionList(typeOptions, event.event_type)}</select></label><label>Área<select name="area">${optionList(areaOptions, event.area)}</select></label></div>
        <div class="form-row"><label>Estado<select name="status">${optionList(statusOptions, event.status)}</select></label><label>Repetição<select name="recurrence">${optionList(recurrenceOptions, event.recurrence)}</select></label></div>
        <label>Preparar com antecedência<select name="prepare_days_before">${optionList(prepareOptions, String(event.prepare_days_before || 0))}</select></label>
        <label>Notas<textarea name="notes" rows="4">${escapeHtml(event.notes || '')}</textarea></label>
        <button class="primary-btn" type="submit">Guardar alterações</button>
      </form>
    </section>`;
}

function renderChecklistEditor(event) {
  const text = (Array.isArray(event.checklist) ? event.checklist : []).map((item) => item.text).join('\n');
  return `<section class="phase-panel is-hidden" data-panel="checklist-edit"><h4>Editar checklist</h4><p class="muted">Uma ação por linha. As ações concluídas mantêm o estado se o texto continuar igual.</p><form id="phase-checklist-form" class="form"><textarea name="checklist" rows="12">${escapeHtml(text)}</textarea><button class="primary-btn" type="submit">Guardar checklist</button></form></section>`;
}

function renderBudgetPanel(event) {
  const shopping = Array.isArray(event.shopping_list) ? event.shopping_list : [];
  const shoppingText = shopping.map((item) => [item.name || '', item.quantity || '', item.store || '', item.estimated || '', item.bought ? 'comprado' : ''].join(' | ').trim()).join('\n');
  return `<section class="phase-panel is-hidden" data-panel="budget"><h4>Compras e orçamento</h4><form id="phase-budget-form" class="form"><div class="budget-grid"><label>Orçamento previsto (€)<input name="budget_estimate" type="number" min="0" step="0.01" value="${Number(event.budget_estimate || 0)}"></label><label>Já gasto (€)<input name="budget_spent" type="number" min="0" step="0.01" value="${Number(event.budget_spent || 0)}"></label></div><label>Lista de compras<textarea name="shopping_list" rows="8" placeholder="Uma compra por linha: item | quantidade | loja | valor previsto | comprado">${escapeHtml(shoppingText)}</textarea></label><button class="primary-btn" type="submit">Guardar compras e orçamento</button></form></section>`;
}

function renderEnhancement(event) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  content.querySelector('.phase-enhancement')?.remove();
  content.insertAdjacentHTML('afterbegin', `
    <section class="phase-enhancement">
      <div class="phase-actions">
        <button type="button" class="text-btn phase-action-btn" data-open-panel="edit">Editar evento</button>
        <button type="button" class="text-btn phase-action-btn" data-open-panel="checklist-edit">Editar checklist</button>
        <button type="button" class="text-btn phase-action-btn" data-open-panel="budget">Compras e orçamento</button>
      </div>
      ${renderEditPanel(event)}
      ${renderChecklistEditor(event)}
      ${renderBudgetPanel(event)}
      <section class="grouped-checklist-card"><p class="eyebrow">Checklist organizada</p>${renderGroupedChecklist(event)}</section>
    </section>`);
}

async function refreshEnhancement() {
  const modal = document.getElementById('detail-modal');
  if (!modal || modal.classList.contains('is-hidden') || !activeEventId) return;
  try {
    renderEnhancement(await readEvent(activeEventId));
  } catch (error) {
    console.warn(error);
  }
}

function parseChecklistTextarea(value, previous = []) {
  const doneMap = new Map(previous.map((item) => [normalize(item.text), Boolean(item.done)]));
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((text) => ({ text, done: doneMap.get(normalize(text)) || false }));
}

function parseShopping(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, quantity, store, estimated, bought] = line.split('|').map((part) => part.trim());
    return { name, quantity: quantity || '', store: store || '', estimated: Number(String(estimated || '0').replace(',', '.')) || 0, bought: normalize(bought).includes('comprado') };
  });
}

async function saveEdit(form) {
  const fd = new FormData(form);
  await updateEvent(activeEventId, {
    title: String(fd.get('title') || '').trim(),
    starts_at: new Date(String(fd.get('starts_at'))).toISOString(),
    ends_at: fd.get('ends_at') ? new Date(String(fd.get('ends_at'))).toISOString() : null,
    event_type: String(fd.get('event_type') || 'Normal'),
    area: String(fd.get('area') || 'Casa'),
    status: String(fd.get('status') || 'normal'),
    recurrence: String(fd.get('recurrence') || 'none'),
    prepare_days_before: Number(fd.get('prepare_days_before') || 0),
    notes: String(fd.get('notes') || '').trim() || null,
  });
}

async function saveChecklist(form) {
  const event = await readEvent(activeEventId);
  const fd = new FormData(form);
  await updateEvent(activeEventId, { checklist: parseChecklistTextarea(fd.get('checklist'), Array.isArray(event.checklist) ? event.checklist : []) });
}

async function saveBudget(form) {
  const fd = new FormData(form);
  await updateEvent(activeEventId, { budget_estimate: Number(fd.get('budget_estimate') || 0), budget_spent: Number(fd.get('budget_spent') || 0), budget_currency: 'EUR', shopping_list: parseShopping(fd.get('shopping_list')) });
}

async function completeTodayAction(li) {
  if (busy) return;
  const actionButton = li.querySelector('[data-event-id]');
  const eventId = actionButton?.dataset.eventId;
  const small = actionButton?.querySelector('small');
  const text = String(actionButton?.textContent || '').replace(String(small?.textContent || ''), '').trim();
  if (!eventId || !text) return;

  busy = true;
  li.classList.add('is-saving');
  try {
    const event = await readEvent(eventId);
    const checklist = Array.isArray(event.checklist) ? event.checklist.map((item) => ({ ...item })) : [];
    const index = checklist.findIndex((item) => normalize(item.text) === normalize(text));
    if (index < 0) throw new Error('Não encontrei esta ação na checklist do evento.');
    checklist[index].done = true;
    const allDone = checklist.length > 0 && checklist.every((item) => item.done);
    const someDone = checklist.some((item) => item.done);
    await updateEvent(eventId, { checklist, status: allDone ? 'concluido' : someDone ? 'em_curso' : event.status });
    li.classList.add('is-done');
    setTimeout(() => {
      const list = li.closest('.action-list');
      li.remove();
      if (list && !list.querySelector('li')) list.outerHTML = '<p class="muted">Sem ações pendentes.</p>';
    }, 250);
  } catch (error) {
    window.alert(error?.message || 'Não foi possível marcar a ação como feita.');
  } finally {
    li.classList.remove('is-saving');
    busy = false;
  }
}

function installHandlers() {
  document.addEventListener('click', (event) => {
    const check = event.target.closest('.action-list .fake-check');
    if (check) {
      event.preventDefault();
      event.stopPropagation();
      completeTodayAction(check.closest('li'));
      return;
    }

    const opener = event.target.closest('[data-event-id]');
    if (opener?.dataset.eventId) {
      activeEventId = opener.dataset.eventId;
      window.setTimeout(refreshEnhancement, 160);
    }

    const panelButton = event.target.closest('[data-open-panel]');
    if (panelButton) {
      event.preventDefault();
      event.stopPropagation();
      const root = panelButton.closest('.phase-enhancement');
      root?.querySelectorAll('.phase-action-btn').forEach((btn) => btn.classList.remove('is-active'));
      panelButton.classList.add('is-active');
      root?.querySelectorAll('.phase-panel').forEach((panel) => panel.classList.add('is-hidden'));
      const panel = root?.querySelector(`[data-panel="${panelButton.dataset.openPanel}"]`);
      panel?.classList.remove('is-hidden');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, true);

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!['phase-edit-form', 'phase-checklist-form', 'phase-budget-form'].includes(form.id)) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    const submit = form.querySelector('button[type="submit"]');
    const oldText = submit?.textContent || 'Guardar';
    if (submit) { submit.disabled = true; submit.textContent = 'A guardar…'; }
    try {
      if (form.id === 'phase-edit-form') await saveEdit(form);
      if (form.id === 'phase-checklist-form') await saveChecklist(form);
      if (form.id === 'phase-budget-form') await saveBudget(form);
      await refreshEnhancement();
      if (submit) submit.textContent = 'Guardado.';
    } catch (error) {
      window.alert(error?.message || 'Não foi possível guardar.');
      if (submit) submit.textContent = oldText;
    } finally {
      setTimeout(() => { if (submit) { submit.disabled = false; submit.textContent = oldText; } }, 700);
      busy = false;
    }
  }, true);
}

function installStyles() {
  if (document.getElementById('phase-05-06-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="phase-05-06-styles">
    .phase-enhancement{border:1px solid var(--line);background:rgba(255,255,255,.62);padding:14px;margin:0 0 16px}.phase-actions{position:sticky;top:0;z-index:2;display:flex;gap:8px;flex-wrap:wrap;margin:-14px -14px 14px;padding:12px 14px;background:var(--paper);border-bottom:1px solid var(--line)}.phase-action-btn.is-active{background:var(--brown);color:var(--paper);border-color:var(--brown)}.grouped-checklist-card,.phase-panel{border:1px solid var(--line);background:rgba(255,255,255,.58);padding:14px;margin:12px 0}.dossier-check-group{margin:14px 0}.dossier-check-group h5{margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em;color:var(--soft-ink);font-size:.78rem}.phase-panel.is-hidden{display:none}.budget-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.action-list .fake-check{cursor:pointer}.action-list li.is-saving{opacity:.55}.action-list li.is-done{opacity:.55;text-decoration:line-through}@media(max-width:900px){.budget-grid{grid-template-columns:1fr}.phase-actions{position:static}}
  </style>`);
}

installStyles();
installHandlers();
