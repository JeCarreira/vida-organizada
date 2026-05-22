import { deleteEvent } from './services/supabase.js';

let currentEventId = null;
let busy = false;

function closeDetails() {
  const modal = document.getElementById('detail-modal');
  if (!modal) return;
  modal.classList.add('is-hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function removeCards(eventId) {
  document.querySelectorAll('[data-event-id]').forEach((node) => {
    if (String(node.dataset.eventId) !== String(eventId)) return;
    const card = node.closest('.event-card, .today-card, .compact-event-card, .day-plan-card, .list-item, li') || node;
    card.remove();
  });
}

function remember(event) {
  const item = event.target.closest('[data-event-id]');
  if (item?.dataset.eventId) currentEventId = item.dataset.eventId;
}

function addButton() {
  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');
  if (!modal || !content || modal.classList.contains('is-hidden') || !currentEventId) return;
  if (content.querySelector('[data-remove-event]')) return;

  const actions = content.querySelector('.detail-actions') || content;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-btn danger-btn';
  button.dataset.removeEvent = currentEventId;
  button.textContent = 'Apagar evento';
  actions.appendChild(button);
}

async function removeEvent(button) {
  const eventId = button.dataset.removeEvent || currentEventId;
  if (!eventId || busy) return;
  if (!window.confirm('Queres mesmo apagar este evento?')) return;

  busy = true;
  button.disabled = true;
  button.textContent = 'A apagar…';

  try {
    await deleteEvent(eventId);
    removeCards(eventId);
    closeDetails();
    currentEventId = null;
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Apagar evento';
    window.alert(error?.message || 'Não foi possível apagar o evento.');
  } finally {
    busy = false;
  }
}

document.addEventListener('click', remember, true);
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-event]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  removeEvent(button);
}, true);

new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true, attributes: true });
