import { supabase, updateEvent, deleteEvent } from './services/supabase.js';

let lastOpenedEventId = null;
let busy = false;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getReadableActionText(li) {
  const clone = li.cloneNode(true);
  clone.querySelectorAll('small').forEach((node) => node.remove());
  clone.querySelectorAll('.fake-check').forEach((node) => node.remove());
  return clone.textContent.trim();
}

async function readEvent(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
}

async function completeActionFromToday(li) {
  if (busy) return;

  const opener = li.querySelector('[data-event-id]');
  const eventId = opener?.dataset.eventId;
  const actionText = getReadableActionText(li);
  if (!eventId || !actionText) return;

  busy = true;
  li.classList.add('is-saving');

  try {
    const event = await readEvent(eventId);
    const checklist = Array.isArray(event.checklist) ? event.checklist.map((item) => ({ ...item })) : [];
    const target = normalizeText(actionText);
    const index = checklist.findIndex((item) => normalizeText(item.text) === target);

    if (index < 0) {
      throw new Error('Não consegui encontrar esta ação dentro da checklist do evento. Abre o evento e confirma por lá.');
    }

    checklist[index].done = true;
    const allDone = checklist.length > 0 && checklist.every((item) => item.done);
    const someDone = checklist.some((item) => item.done);
    const status = allDone ? 'concluido' : someDone ? 'em_curso' : event.status;

    await updateEvent(eventId, { checklist, status });
    li.classList.add('is-done');

    window.setTimeout(() => {
      window.location.reload();
    }, 350);
  } catch (error) {
    window.alert(error?.message || 'Não foi possível marcar esta ação como feita.');
  } finally {
    busy = false;
    li.classList.remove('is-saving');
  }
}

function rememberOpenedEvent(event) {
  const opener = event.target.closest('[data-event-id]');
  if (opener?.dataset.eventId) {
    lastOpenedEventId = opener.dataset.eventId;
  }
}

function injectDeleteButton() {
  const detailModal = document.getElementById('detail-modal');
  const detailContent = document.getElementById('detail-content');
  if (!detailModal || !detailContent || detailModal.classList.contains('is-hidden') || !lastOpenedEventId) return;
  if (detailContent.querySelector('[data-delete-event]')) return;

  const actions = detailContent.querySelector('.detail-actions') || detailContent;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-btn danger-btn';
  button.dataset.deleteEvent = lastOpenedEventId;
  button.textContent = 'Apagar evento';
  actions.appendChild(button);
}

async function handleDelete(button) {
  const eventId = button.dataset.deleteEvent || lastOpenedEventId;
  if (!eventId || busy) return;

  const ok = window.confirm('Tens a certeza que queres apagar este evento? Esta ação não dá para desfazer.');
  if (!ok) return;

  busy = true;
  button.disabled = true;
  button.textContent = 'A apagar…';

  try {
    await deleteEvent(eventId);
    window.location.reload();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Apagar evento';
    window.alert(error?.message || 'Não foi possível apagar o evento.');
  } finally {
    busy = false;
  }
}

function installStyles() {
  if (document.getElementById('interaction-patch-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="interaction-patch-styles">
    .action-list li { align-items: flex-start; }
    .action-list .fake-check { cursor: pointer; flex: 0 0 auto; }
    .action-list li.is-saving { opacity: .55; }
    .action-list li.is-done { opacity: .55; text-decoration: line-through; }
    .danger-btn { border-color: #9f5f52 !important; color: #7d3f35 !important; background: #fff8f5 !important; }
    .danger-btn:hover { background: #f5ddd7 !important; }
  </style>`);
}

function bootPatch() {
  installStyles();

  document.addEventListener('click', rememberOpenedEvent, true);

  document.addEventListener('click', (event) => {
    const check = event.target.closest('.action-list .fake-check');
    if (check) {
      event.preventDefault();
      event.stopPropagation();
      completeActionFromToday(check.closest('li'));
      return;
    }

    const deleteButton = event.target.closest('[data-delete-event]');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      handleDelete(deleteButton);
    }
  }, true);

  const observer = new MutationObserver(injectDeleteButton);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

bootPatch();
