import { supabase, updateEvent } from './services/supabase.js';

let busy = false;

const prepareOptions = [
  ['0', 'No próprio dia'],
  ['1', '1 dia antes'],
  ['3', '3 dias antes'],
  ['7', '1 semana antes'],
  ['14', '2 semanas antes'],
  ['30', '1 mês antes'],
  ['60', '2 meses antes'],
  ['90', '3 meses antes'],
  ['120', '4 meses antes'],
  ['180', '6 meses antes'],
  ['270', '9 meses antes'],
  ['365', '1 ano antes'],
];

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

function eventTypeKey(event) {
  const text = normalize(`${event?.title || ''} ${event?.event_type || ''} ${event?.area || ''}`);
  if (text.includes('natal')) return 'natal';
  if (text.includes('aniversario') && (text.includes('filho') || text.includes('filha') || text.includes('crianca') || text.includes('turma') || normalize(event?.area) === 'filhos')) return 'aniversarioCrianca';
  if (text.includes('aniversario')) return 'aniversario';
  if (text.includes('ferias') || text.includes('viagem') || text.includes('praia')) return 'viagem';
  if (text.includes('material escolar') || text.includes('regresso as aulas') || text.includes('escola')) return 'escola';
  if (text.includes('guarda roupa') || text.includes('guarda-roupa') || text.includes('roupa') || text.includes('calcado')) return 'roupa';
  if (text.includes('consulta') || text.includes('dentista') || text.includes('medico')) return 'consulta';
  return 'ocasiao';
}

function money(value) {
  const n = Number(String(value || '0').replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function euro(value) {
  return `${money(value).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function splitBudget(total, template) {
  const sum = template.reduce((acc, item) => acc + item.weight, 0);
  return template.map((item) => ({
    ...item,
    estimated: Math.round((total * item.weight / sum) * 100) / 100,
  }));
}

const budgetTemplates = {
  aniversarioCrianca: [
    { name: 'Bolo com tamanho adequado ao número de convidados', quantity: '1 bolo', store: 'pastelaria/confeitaria', weight: 18 },
    { name: 'Lembranças para a turma com 2 ou 3 unidades extra', quantity: 'nº crianças + margem', store: 'Action/Amazon/loja local', weight: 16 },
    { name: 'Sacos, etiquetas, fitas e cartões das lembranças', quantity: '1 conjunto', store: 'papelaria/loja online', weight: 5 },
    { name: 'Presente principal da criança', quantity: '1 presente', store: 'loja escolhida', weight: 18 },
    { name: 'Decoração dentro da paleta/tema', quantity: 'balões, toalha, faixa, pratos', store: 'loja festas/online', weight: 12 },
    { name: 'Comida salgada e snacks para crianças e adultos', quantity: 'lista da ementa', store: 'supermercado/padaria', weight: 13 },
    { name: 'Bebidas, fruta e opções simples extra', quantity: 'consoante convidados', store: 'supermercado', weight: 6 },
    { name: 'Roupa/acessório da criança se for necessário', quantity: '1 conjunto', store: 'loja roupa', weight: 7 },
    { name: 'Atividades, materiais ou jogos para a festa', quantity: '1 kit', store: 'papelaria/loja brinquedos', weight: 5 },
  ],
  aniversario: [
    { name: 'Presente principal', quantity: '1 presente', store: 'loja escolhida', weight: 55 },
    { name: 'Embrulho, saco, cartão e fita', quantity: '1 conjunto', store: 'papelaria/loja local', weight: 8 },
    { name: 'Contribuição para comida/bebida se necessário', quantity: '1 contribuição', store: 'supermercado/pastelaria', weight: 17 },
    { name: 'Deslocação/estacionamento', quantity: 'margem', store: 'transporte', weight: 10 },
    { name: 'Extra de segurança para troca ou imprevisto', quantity: 'margem', store: 'reservado', weight: 10 },
  ],
  natal: [
    { name: 'Presentes das crianças', quantity: 'por criança', store: 'lojas/online', weight: 24 },
    { name: 'Presentes família próxima', quantity: 'por pessoa', store: 'lojas/online', weight: 24 },
    { name: 'Pequenas lembranças escola/vizinhos/colegas', quantity: 'lista completa', store: 'supermercado/loja local', weight: 7 },
    { name: 'Papel de embrulho, etiquetas, fitas e sacos', quantity: 'kit embrulho', store: 'papelaria/loja local', weight: 5 },
    { name: 'Comida e bebidas da noite/dia de Natal', quantity: 'menu definido', store: 'supermercado/talho/pastelaria', weight: 22 },
    { name: 'Doces, sobremesas ou encomendas especiais', quantity: 'lista encomendas', store: 'pastelaria/supermercado', weight: 8 },
    { name: 'Roupa das crianças/família se necessário', quantity: 'peças essenciais', store: 'loja roupa', weight: 6 },
    { name: 'Decoração ou pequenos detalhes de ambiente', quantity: 'apenas o que falta', store: 'loja decoração', weight: 4 },
  ],
  viagem: [
    { name: 'Transporte e combustível/bilhetes', quantity: 'ida e volta', store: 'transporte', weight: 28 },
    { name: 'Alojamento/reserva', quantity: 'noites previstas', store: 'hotel/alojamento', weight: 35 },
    { name: 'Alimentação e supermercado', quantity: 'por dias/pessoas', store: 'restaurantes/supermercado', weight: 17 },
    { name: 'Atividades, entradas e experiências', quantity: 'plano leve', store: 'reservas locais', weight: 8 },
    { name: 'Farmácia, higiene, protetor e básicos', quantity: 'kit viagem', store: 'farmácia/supermercado', weight: 4 },
    { name: 'Roupa/calçado em falta', quantity: 'essenciais', store: 'loja roupa', weight: 4 },
    { name: 'Margem para imprevistos', quantity: 'reserva', store: 'reservado', weight: 4 },
  ],
  escola: [
    { name: 'Material escolar obrigatório', quantity: 'lista da escola', store: 'papelaria/supermercado', weight: 34 },
    { name: 'Mochila, estojo ou lancheira se necessário', quantity: 'peças em falta', store: 'loja escolar/online', weight: 18 },
    { name: 'Etiquetas e identificação de material', quantity: '1 kit', store: 'online/papelaria', weight: 7 },
    { name: 'Roupa e calçado para setembro', quantity: 'essenciais', store: 'loja roupa', weight: 24 },
    { name: 'Garrafa, caixas de lanche e extras', quantity: 'peças úteis', store: 'supermercado/online', weight: 8 },
    { name: 'Margem para pedidos extra da escola', quantity: 'reserva', store: 'reservado', weight: 9 },
  ],
  roupa: [
    { name: 'Básicos principais em falta', quantity: 'lista por pessoa', store: 'loja roupa', weight: 34 },
    { name: 'Calçado necessário', quantity: 'pares em falta', store: 'loja calçado', weight: 22 },
    { name: 'Casacos/peças de estação', quantity: 'essenciais', store: 'loja roupa', weight: 18 },
    { name: 'Roupa interior, meias e pijamas', quantity: 'repor stock', store: 'loja roupa', weight: 12 },
    { name: 'Acessórios ou peças especiais', quantity: 'só se necessário', store: 'loja roupa', weight: 6 },
    { name: 'Margem para trocas/ajustes', quantity: 'reserva', store: 'reservado', weight: 8 },
  ],
  consulta: [
    { name: 'Consulta/copagamento', quantity: '1 consulta', store: 'clínica', weight: 55 },
    { name: 'Exames, análises ou documentos', quantity: 'se necessário', store: 'clínica/laboratório', weight: 20 },
    { name: 'Farmácia/medicação pós-consulta', quantity: 'margem', store: 'farmácia', weight: 15 },
    { name: 'Deslocação/estacionamento', quantity: 'margem', store: 'transporte', weight: 10 },
  ],
  ocasiao: [
    { name: 'Presente ou contribuição principal', quantity: '1 item', store: 'loja escolhida', weight: 35 },
    { name: 'Roupa/acessório se necessário', quantity: '1 conjunto ou detalhe', store: 'loja roupa', weight: 20 },
    { name: 'Comida, bebida ou sobremesa para levar', quantity: 'conforme pedido', store: 'supermercado/pastelaria', weight: 18 },
    { name: 'Embrulho, cartão ou detalhe bonito', quantity: '1 conjunto', store: 'papelaria/loja local', weight: 7 },
    { name: 'Deslocação/estacionamento', quantity: 'margem', store: 'transporte', weight: 10 },
    { name: 'Margem para imprevistos', quantity: 'reserva', store: 'reservado', weight: 10 },
  ],
};

async function readEvent(eventId) {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) throw error;
  return data;
}

function findOpenEventId() {
  const modal = document.getElementById('detail-modal');
  if (!modal || modal.classList.contains('is-hidden')) return null;
  return document.querySelector('[data-remove-event]')?.dataset.removeEvent
    || document.querySelector('[data-delete-event]')?.dataset.deleteEvent
    || null;
}

function upgradePrepareSelect(select) {
  if (!select || select.dataset.prepUpgraded === 'true') return;
  const current = select.value || '0';
  select.innerHTML = prepareOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  select.value = prepareOptions.some(([value]) => value === current) ? current : '0';
  select.dataset.prepUpgraded = 'true';
}

function upgradeAllPrepareSelects() {
  document.querySelectorAll('select[name="prepare_days_before"]').forEach(upgradePrepareSelect);
}

function applySmartPrepareDefault(type, select, recurrence) {
  if (!select) return;
  const key = normalize(type);
  if (key.includes('natal')) { select.value = '180'; if (recurrence) recurrence.value = 'yearly'; return; }
  if (key.includes('aniversario')) { select.value = '60'; if (recurrence) recurrence.value = 'yearly'; return; }
  if (key.includes('viagem')) { select.value = '120'; return; }
  if (key.includes('escola')) { select.value = '60'; return; }
  if (key.includes('ocasiao')) { select.value = '30'; return; }
}

function lineToPurchase(line) {
  const [name = '', quantity = '', store = '', estimated = '0', bought = ''] = String(line || '').split('|').map((part) => part.trim());
  return { name, quantity, store, estimated: money(estimated), bought: normalize(bought).includes('comprado') };
}

function readTextareaPurchases(textarea) {
  return String(textarea?.value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(lineToPurchase);
}

function purchaseToLine(item) {
  return `${item.name || ''} | ${item.quantity || ''} | ${item.store || ''} | ${money(item.estimated).toFixed(2)} | ${item.bought ? 'comprado' : ''}`.trim();
}

function rowHtml(item = {}) {
  return `<tr>
    <td><input class="shop-name" value="${escapeHtml(item.name || '')}" placeholder="Ex.: bolo, presente, decoração"></td>
    <td><input class="shop-qty" value="${escapeHtml(item.quantity || '')}" placeholder="Qtd."></td>
    <td><input class="shop-store" value="${escapeHtml(item.store || '')}" placeholder="Loja / local"></td>
    <td><div class="euro-input"><input class="shop-estimated" type="number" min="0" step="0.01" value="${money(item.estimated).toFixed(2)}"><span>€</span></div></td>
    <td class="shop-bought-cell"><input class="shop-bought" type="checkbox" ${item.bought ? 'checked' : ''}></td>
    <td><button type="button" class="text-btn mini-danger" data-remove-shopping-row>×</button></td>
  </tr>`;
}

function syncShoppingTextarea(form) {
  const textarea = form?.elements?.shopping_list;
  const table = form?.querySelector('[data-shopping-table]');
  if (!textarea || !table) return;
  const rows = [...table.querySelectorAll('tbody tr')].map((row) => ({
    name: row.querySelector('.shop-name')?.value.trim() || '',
    quantity: row.querySelector('.shop-qty')?.value.trim() || '',
    store: row.querySelector('.shop-store')?.value.trim() || '',
    estimated: money(row.querySelector('.shop-estimated')?.value),
    bought: Boolean(row.querySelector('.shop-bought')?.checked),
  })).filter((item) => item.name || item.quantity || item.store || item.estimated);
  textarea.value = rows.map(purchaseToLine).join('\n');
  updateBudgetSummary(form);
}

function updateBudgetSummary(form) {
  const summary = form?.querySelector('[data-budget-summary]');
  const table = form?.querySelector('[data-shopping-table]');
  if (!summary || !table) return;
  const planned = [...table.querySelectorAll('.shop-estimated')].reduce((sum, input) => sum + money(input.value), 0);
  const total = money(form.elements.budget_estimate?.value);
  const spent = money(form.elements.budget_spent?.value);
  const remaining = Math.max(0, total - planned);
  summary.innerHTML = `<span><strong>${euro(total)}</strong><small>orçamento</small></span><span><strong>${euro(planned)}</strong><small>planeado em compras</small></span><span><strong>${euro(spent)}</strong><small>já gasto</small></span><span><strong>${euro(remaining)}</strong><small>por distribuir</small></span>`;
}

function renderShoppingTable(form, purchases) {
  let tableWrap = form.querySelector('[data-shopping-table-wrap]');
  if (!tableWrap) {
    tableWrap = document.createElement('section');
    tableWrap.className = 'shopping-table-wrap';
    tableWrap.dataset.shoppingTableWrap = 'true';
    const textareaLabel = form.elements.shopping_list?.closest('label');
    textareaLabel?.insertAdjacentElement('beforebegin', tableWrap);
  }
  tableWrap.innerHTML = `<div class="budget-summary" data-budget-summary></div>
    <div class="shopping-table-scroll">
      <table class="shopping-table" data-shopping-table>
        <thead><tr><th>Compra</th><th>Quantidade</th><th>Onde</th><th>Valor</th><th>Comprado</th><th></th></tr></thead>
        <tbody>${(purchases.length ? purchases : [{}]).map(rowHtml).join('')}</tbody>
      </table>
    </div>
    <button type="button" class="text-btn" data-add-shopping-row>Adicionar compra</button>`;
  updateBudgetSummary(form);
}

function injectBudgetAgent(panel) {
  if (!panel) return;
  const form = panel.querySelector('#phase-budget-form');
  if (!form) return;

  const textarea = form.elements.shopping_list;
  if (textarea) {
    const textareaLabel = textarea.closest('label');
    if (textareaLabel) textareaLabel.classList.add('is-hidden-shopping-source');
  }

  if (!form.querySelector('[data-budget-agent]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-btn budget-agent-btn';
    button.dataset.budgetAgent = 'true';
    button.textContent = 'Gerar plano de compras com orçamento';
    const hint = document.createElement('p');
    hint.className = 'muted budget-agent-hint';
    hint.textContent = 'Escreve um orçamento em euros. O sistema distribui esse valor por compras essenciais, margem e prioridades.';
    form.insertBefore(hint, form.firstChild);
    form.insertBefore(button, hint.nextSibling);
  }

  if (!form.querySelector('[data-shopping-table-wrap]')) {
    renderShoppingTable(form, readTextareaPurchases(textarea));
  }
  updateBudgetSummary(form);
}

function buildBudgetPurchases(event, total) {
  const template = budgetTemplates[eventTypeKey(event)] || budgetTemplates.ocasiao;
  return splitBudget(total || 0, template);
}

async function handleBudgetAgent(button) {
  if (busy) return;
  const form = button.closest('form');
  const eventId = findOpenEventId();
  if (!form || !eventId) return;
  const total = money(form.elements.budget_estimate?.value);
  if (!total) {
    window.alert('Primeiro escreve o orçamento previsto em euros. Ex.: 150');
    form.elements.budget_estimate?.focus();
    return;
  }
  busy = true;
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'A gerar…';
  try {
    const event = await readEvent(eventId);
    renderShoppingTable(form, buildBudgetPurchases(event, total));
    syncShoppingTextarea(form);
  } catch (error) {
    window.alert(error?.message || 'Não consegui gerar o plano de compras.');
  } finally {
    button.disabled = false;
    button.textContent = old;
    busy = false;
  }
}

async function completeTodayAction(li) {
  if (busy || !li) return;
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
    }, 220);
  } catch (error) {
    window.alert(error?.message || 'Não foi possível marcar a ação como feita.');
  } finally {
    li.classList.remove('is-saving');
    busy = false;
  }
}

function installStyles() {
  if (document.getElementById('phase-06-agent-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="phase-06-agent-styles">
    .budget-agent-btn{width:100%;margin:0 0 10px}.budget-agent-hint{margin:0 0 8px}.is-hidden-shopping-source{display:none!important}.budget-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.budget-summary span{border:1px solid var(--line);background:rgba(255,255,255,.74);padding:9px}.budget-summary strong{display:block}.budget-summary small{color:var(--soft-ink);font-size:.74rem;text-transform:uppercase;letter-spacing:.04em}.shopping-table-scroll{overflow:auto;border:1px solid var(--line);background:rgba(255,255,255,.62)}.shopping-table{width:100%;border-collapse:collapse;min-width:760px}.shopping-table th{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;color:var(--soft-ink);text-align:left;background:#f7efe5}.shopping-table th,.shopping-table td{border-bottom:1px solid var(--line);padding:7px}.shopping-table input{width:100%;border:1px solid #d8c8b4;background:#fffaf4;padding:8px;font:inherit}.euro-input{display:flex;align-items:center;gap:6px}.euro-input span{font-weight:700;color:var(--brown)}.shop-bought-cell{text-align:center}.shop-bought-cell input{width:auto}.mini-danger{padding:6px 9px!important;color:#8c463b!important}.action-list li,.action-list button{cursor:pointer}.action-list li.is-saving{opacity:.55}.action-list li.is-done{opacity:.55;text-decoration:line-through}@media(max-width:900px){.budget-summary{grid-template-columns:1fr 1fr}}
  </style>`);
}

function boot() {
  installStyles();
  upgradeAllPrepareSelects();

  document.addEventListener('change', (event) => {
    if (event.target.matches('select[name="event_type"]')) {
      const form = event.target.closest('form');
      window.setTimeout(() => {
        const prepare = form?.querySelector('select[name="prepare_days_before"]');
        const recurrence = form?.querySelector('select[name="recurrence"]');
        upgradePrepareSelect(prepare);
        applySmartPrepareDefault(event.target.value, prepare, recurrence);
      }, 0);
    }
    if (event.target.closest('[data-shopping-table]') || event.target.matches('input[name="budget_estimate"], input[name="budget_spent"]')) {
      syncShoppingTextarea(event.target.closest('form'));
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target.closest('[data-shopping-table]') || event.target.matches('input[name="budget_estimate"], input[name="budget_spent"]')) {
      syncShoppingTextarea(event.target.closest('form'));
    }
  }, true);

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'phase-budget-form') syncShoppingTextarea(event.target);
  }, true);

  document.addEventListener('click', (event) => {
    const budgetAgent = event.target.closest('[data-budget-agent]');
    if (budgetAgent) {
      event.preventDefault();
      event.stopPropagation();
      handleBudgetAgent(budgetAgent);
      return;
    }

    const addRow = event.target.closest('[data-add-shopping-row]');
    if (addRow) {
      event.preventDefault();
      const form = addRow.closest('form');
      form?.querySelector('[data-shopping-table] tbody')?.insertAdjacentHTML('beforeend', rowHtml({}));
      syncShoppingTextarea(form);
      return;
    }

    const removeRow = event.target.closest('[data-remove-shopping-row]');
    if (removeRow) {
      event.preventDefault();
      const form = removeRow.closest('form');
      removeRow.closest('tr')?.remove();
      syncShoppingTextarea(form);
      return;
    }

    const actionLi = event.target.closest('.action-list li');
    if (actionLi) {
      event.preventDefault();
      event.stopPropagation();
      completeTodayAction(actionLi);
    }
  }, true);

  new MutationObserver(() => {
    upgradeAllPrepareSelects();
    document.querySelectorAll('[data-panel="budget"]').forEach(injectBudgetAgent);
  }).observe(document.body, { childList: true, subtree: true });
}

boot();
