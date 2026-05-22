import { supabase, updateEvent, deleteEvent } from './services/supabase.js';

let currentEventId = null;
let busy = false;

const statusLabels = {
  normal: 'normal',
  por_preparar: 'por preparar',
  em_curso: 'em curso',
  concluido: 'concluído',
};

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getOpenModal() {
  return document.getElementById('detail-modal');
}

function getDetailContent() {
  return document.getElementById('detail-content');
}

function rememberEventId(event) {
  const eventTrigger = event.target.closest?.('[data-event-id]');
  const removeTrigger = event.target.closest?.('[data-remove-event], [data-delete-event]');
  const id = eventTrigger?.dataset.eventId || removeTrigger?.dataset.removeEvent || removeTrigger?.dataset.deleteEvent;
  if (id) currentEventId = id;
}

function findEventId() {
  return currentEventId
    || document.querySelector('[data-remove-event]')?.dataset.removeEvent
    || document.querySelector('[data-delete-event]')?.dataset.deleteEvent
    || document.querySelector('#detail-modal [data-event-id]')?.dataset.eventId
    || null;
}

async function readEvent(eventId) {
  if (!supabase) throw new Error('Ligação ao Supabase indisponível.');
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

function closeDetailModal() {
  const modal = getOpenModal();
  if (!modal) return;
  modal.classList.add('is-hidden');
  modal.setAttribute('aria-hidden', 'true');
  currentEventId = null;
}

function setFeedback(message) {
  const feedback = document.getElementById('detail-feedback');
  if (feedback) feedback.textContent = message || '';
}

function removeEventNodes(eventId) {
  document.querySelectorAll(`[data-event-id="${CSS.escape(String(eventId))}"]`).forEach((node) => {
    const wrapper = node.closest('.event-card, .today-card, .compact-event-card, .day-plan-card, .list-item, li') || node;
    wrapper.remove();
  });
}

function basicChecklistFor(event) {
  const text = normalize(`${event.title || ''} ${event.event_type || ''} ${event.area || ''}`);
  if (text.includes('natal')) {
    return [
      'Definir orçamento total do Natal em euros',
      'Fazer lista completa de pessoas para presentes',
      'Definir limite de valor por pessoa',
      'Separar presentes por crianças, família, escola, amigos e vizinhos',
      'Comprar presentes principais primeiro',
      'Guardar recibos e prazos de troca',
      'Comprar papel de embrulho, etiquetas, fitas e sacos',
      'Definir menu da noite/dia de Natal',
      'Fazer lista de compras por supermercado, talho, peixaria e pastelaria',
      'Encomendar doces, bolo, carne, peixe ou itens especiais',
      'Ver roupa das crianças e roupa da família',
      'Preparar decoração sem comprar duplicados',
      'Marcar dia para embrulhar presentes',
      'Dois dias antes, separar presentes por destino',
      'Na véspera, deixar roupa, comida adiantada e sacos prontos',
    ];
  }
  if (text.includes('aniversario')) {
    return [
      'Definir orçamento total em euros',
      'Confirmar data, hora, local e convidados',
      'Escolher presente principal',
      'Comprar presente com margem para trocas',
      'Comprar embrulho, saco, fita e cartão',
      'Confirmar se é preciso bolo, comida, bebida ou contribuição',
      'Guardar recibo e prazo de troca',
      'Na véspera, deixar tudo separado e pronto',
    ];
  }
  return [
    'Confirmar data, hora e local',
    'Definir orçamento total em euros',
    'Listar compras necessárias',
    'Confirmar pessoas envolvidas',
    'Preparar tudo com antecedência realista',
    'Na véspera, rever o plano e separar o essencial',
  ];
}

async function generateChecklist(button) {
  const eventId = findEventId();
  if (!eventId || busy) return;
  busy = true;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'A gerar…';
  setFeedback('A completar checklist…');

  try {
    const event = await readEvent(eventId);
    const current = Array.isArray(event.checklist) ? event.checklist : [];
    const doneMap = new Map(current.map((item) => [normalize(item.text), Boolean(item.done)]));
    const allText = [...current.map((item) => item.text), ...basicChecklistFor(event)];
    const seen = new Set();
    const checklist = allText
      .map((text) => String(text || '').trim())
      .filter(Boolean)
      .filter((text) => {
        const key = normalize(text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((text) => ({ text, done: doneMap.get(normalize(text)) || false }));

    const updated = await updateEvent(eventId, { checklist, status: event.status === 'concluido' ? 'concluido' : 'por_preparar' });
    setFeedback('Checklist completada e guardada.');
    repaintChecklist(updated);
  } catch (error) {
    setFeedback(error?.message ? `Erro: ${error.message}` : 'Não foi possível completar a checklist.');
  } finally {
    button.disabled = false;
    button.textContent = old;
    busy = false;
  }
}

function repaintChecklist(event) {
  const content = getDetailContent();
  if (!content || !event) return;
  const items = Array.isArray(event.checklist) ? event.checklist : [];
  const checklistSection = [...content.querySelectorAll('section')].find((section) => section.querySelector('h4')?.textContent?.includes('Checklist'));
  if (!checklistSection) return;
  checklistSection.innerHTML = `<h4>Checklist de preparação</h4>${items.length ? `<ul class="event-checklist detail-checklist">${items.map((item, index) => `<li class="${item.done ? 'is-done' : ''}"><label><input type="checkbox" data-check-index="${index}" ${item.done ? 'checked' : ''} /> <span>${item.text}</span></label></li>`).join('')}</ul>` : '<p class="muted">Este evento ainda não tem checklist.</p>'}`;

  const progressBox = [...content.querySelectorAll('.detail-summary > div')].find((div) => div.querySelector('.eyebrow')?.textContent?.toLowerCase().includes('progresso'));
  if (progressBox) {
    const done = items.filter((item) => item.done).length;
    progressBox.querySelector('strong').textContent = items.length ? `${done}/${items.length}` : 'sem checklist';
  }
}

async function toggleComplete(button) {
  const eventId = findEventId();
  if (!eventId || busy) return;
  busy = true;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'A guardar…';
  setFeedback('A atualizar…');

  try {
    const event = await readEvent(eventId);
    const nextStatus = event.status === 'concluido' ? 'em_curso' : 'concluido';
    const checklist = Array.isArray(event.checklist)
      ? event.checklist.map((item) => ({ ...item, done: nextStatus === 'concluido' ? true : item.done }))
      : [];
    const updated = await updateEvent(eventId, { status: nextStatus, checklist });

    document.querySelectorAll('#detail-modal .detail-checklist input[type="checkbox"]').forEach((input) => {
      if (nextStatus === 'concluido') input.checked = true;
      input.closest('li')?.classList.toggle('is-done', input.checked);
    });
    const statusBox = [...document.querySelectorAll('#detail-modal .detail-summary > div')].find((div) => div.querySelector('.eyebrow')?.textContent?.toLowerCase().includes('estado'));
    if (statusBox) statusBox.querySelector('strong').textContent = statusLabels[updated.status] || updated.status || 'normal';
    repaintChecklist(updated);
    button.textContent = nextStatus === 'concluido' ? 'Reabrir evento' : 'Marcar como concluído';
    setFeedback('Guardado.');
  } catch (error) {
    button.textContent = old;
    setFeedback(error?.message ? `Erro: ${error.message}` : 'Não foi possível atualizar.');
  } finally {
    button.disabled = false;
    busy = false;
  }
}

async function removeEvent(button) {
  const eventId = button.dataset.removeEvent || button.dataset.deleteEvent || findEventId();
  if (!eventId || busy) return;
  if (!window.confirm('Queres mesmo apagar este evento?')) return;

  busy = true;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'A apagar…';
  setFeedback('A apagar evento…');

  try {
    await deleteEvent(eventId);
    removeEventNodes(eventId);
    closeDetailModal();
  } catch (error) {
    button.disabled = false;
    button.textContent = old || 'Apagar evento';
    setFeedback(error?.message ? `Erro: ${error.message}` : 'Não foi possível apagar o evento.');
  } finally {
    busy = false;
  }
}

function installStyles() {
  if (document.getElementById('stability-patch-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="stability-patch-styles">
    #detail-modal .modal-panel{position:relative;z-index:20;pointer-events:auto}
    #detail-modal .modal-backdrop{z-index:1;pointer-events:auto}
    #detail-modal button{pointer-events:auto}
    #detail-modal .icon-btn{position:relative;z-index:30}
  </style>`);
}

installStyles();

document.addEventListener('click', (event) => {
  rememberEventId(event);

  const close = event.target.closest?.('[data-close-detail]');
  if (close) {
    event.preventDefault();
    event.stopPropagation();
    closeDetailModal();
    return;
  }

  const generate = event.target.closest?.('[data-detail-generate]');
  if (generate) {
    event.preventDefault();
    event.stopPropagation();
    generateChecklist(generate);
    return;
  }

  const complete = event.target.closest?.('[data-detail-complete]');
  if (complete) {
    event.preventDefault();
    event.stopPropagation();
    toggleComplete(complete);
    return;
  }

  const remove = event.target.closest?.('[data-remove-event], [data-delete-event]');
  if (remove) {
    event.preventDefault();
    event.stopPropagation();
    removeEvent(remove);
  }
}, true);
