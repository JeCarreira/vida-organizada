import {
  supabase,
  getSession,
  signIn,
  signOut,
  signUp,
  listEventsByRange,
  createEvent,
  updateEvent,
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

const eventColors = Object.fromEntries(Object.values(areaPalette).map((item) => [item.color, item.hex]));
Object.assign(eventColors, { areia: '#d9c7a6', creme: '#eadfce', caramelo: '#c18954', castanho: '#6a4b33', terracota: '#c58c66', 'verde-oliva': '#8f9b74', salvia: '#c7d3b5', 'azul-nevoa': '#c9dbe7', 'rosa-antigo': '#d6b1bb', lavanda: '#c6c5dd', grafite: '#77706a' });

const recurrenceLabels = { none: '', daily: 'diário', weekly: 'semanal', monthly: 'mensal', yearly: 'anual' };
const recurrenceOccurrences = { none: 1, daily: 30, weekly: 16, monthly: 12, yearly: 8 };
const statusLabels = { normal: 'normal', por_preparar: 'por preparar', em_curso: 'em curso', concluido: 'concluído' };

const commonPreparation = [
  'Abrir este plano e confirmar se a data, hora e local estão corretos',
  'Definir orçamento máximo e escrever o valor nas notas',
  'Criar uma pequena lista de compras associada ao evento',
  'Ver o que já existe em casa antes de comprar coisas novas',
  'Separar uma pasta física ou digital para recibos, ideias, imagens e confirmações',
  'Marcar no calendário o dia em que as compras têm de estar fechadas',
  'Marcar no calendário o dia em que tudo deve ficar preparado e não apenas comprado',
  'Confirmar se existe alguma pessoa que precisa de ser avisada com antecedência',
  'Guardar links, ideias ou referências importantes nas notas do evento',
  'No dia anterior, rever este plano e preparar tudo o que vai sair de casa',
];

const checklistTemplates = {
  aniversarioCrianca: [
    'Definir objetivo da festa: simples, íntima, escola, casa, parque ou espaço alugado',
    'Confirmar data ideal e alternativa caso chova ou haja conflito de agenda',
    'Confirmar horário de início e fim adequado à idade das crianças',
    'Definir orçamento total da festa antes de começar a comprar',
    'Dividir orçamento por bolo, comida, decoração, lembranças, roupa, atividades e extras',
    'Perguntar à criança tema, cores, personagem ou estilo que gostava',
    'Guardar 5 a 10 inspirações visuais de bolo, mesa, decoração e lembranças',
    'Decidir se a festa terá tema completo ou apenas uma paleta de cores bonita',
    'Fazer lista de convidados da família',
    'Fazer lista de amigos/crianças convidadas',
    'Confirmar quantas crianças são da turma',
    'Confirmar quantas meninas e quantos meninos há na turma, se isso influenciar lembranças',
    'Confirmar com a escola se é permitido levar bolo, saquinhos ou lembranças',
    'Confirmar alergias ou restrições alimentares importantes',
    'Decidir se vai haver algo para a turma no dia da escola',
    'Escolher lembrança para a turma que seja útil, bonita e dentro do orçamento',
    'Calcular quantidade de lembranças com margem extra de 2 ou 3 unidades',
    'Comprar lembranças da turma',
    'Comprar saquinhos, etiquetas, fita ou cartões para as lembranças',
    'Escrever ou imprimir etiquetas com nome da criança e data, se fizer sentido',
    'Separar as lembranças por turma/festa/família para não misturar',
    'Escolher presente principal da criança',
    'Ver se o presente precisa de pilhas, montagem, acessórios ou embrulho especial',
    'Comprar presente principal com antecedência suficiente para trocas',
    'Escolher roupa da criança para a festa',
    'Confirmar sapatos, casaco, laço/acessório e roupa suplente',
    'Definir onde encomendar ou fazer o bolo',
    'Pesquisar inspirações de bolo e guardar referências',
    'Pedir orçamento do bolo com tamanho, sabor, tema e data de levantamento',
    'Confirmar número de fatias do bolo',
    'Confirmar se é preciso vela, topo de bolo, faca, pratos e guardanapos',
    'Definir ementa: salgados, doces, fruta, bebidas, snacks simples e opções para adultos',
    'Fazer lista de compras da ementa por supermercado/padaria/confeitaria',
    'Marcar dia específico para compras de supermercado',
    'Marcar dia específico para levantar bolo ou encomendas',
    'Definir atividades para as crianças: jogos, pintura, caça ao tesouro, música ou brincadeira livre',
    'Preparar materiais das atividades e testar se falta alguma coisa',
    'Decidir decoração: balões, toalha, pratos, guardanapos, faixa, flores ou elementos simples',
    'Comprar decoração sem exagero e dentro da paleta escolhida',
    'Preparar zona das prendas, zona do bolo, zona da comida e zona das crianças',
    'Enviar convites ou mensagens com data, horário, local e confirmação até uma data limite',
    'Criar lista de respostas confirmadas',
    'Confirmar ajuda de outro adulto no dia da festa',
    'Na véspera, separar roupa, lembranças, decoração, velas, fósforos, comida seca e sacos',
    'No próprio dia, fotografar a mesa antes dos convidados chegarem',
  ],
  aniversario: [
    'Confirmar data, hora e local do aniversário',
    'Definir orçamento para presente, deslocação, roupa e extras',
    'Pensar na pessoa: gostos atuais, necessidades, estilo de vida, cores e marcas preferidas',
    'Criar 5 ideias de presente por faixa de preço',
    'Ver se há presente que possa ser comprado em conjunto com outras pessoas',
    'Confirmar morada ou local de entrega, se for envio',
    'Comprar o presente com margem para trocas ou atrasos',
    'Guardar recibo e prazo de troca',
    'Comprar embalagem, cartão, fita ou saco bonito',
    'Escrever mensagem pessoal no cartão',
    'Confirmar se é preciso levar comida, bebida ou contribuir para alguma coisa',
    'Escolher roupa com antecedência',
    'Ver deslocação, estacionamento, transporte ou hora de saída',
    'Criar lembrete para dar os parabéns logo de manhã',
    'Na véspera, deixar presente embalado e pronto junto à mala/porta',
  ],
  natal: [
    'Definir visão do Natal deste ano: simples, acolhedor, familiar, económico ou mais especial',
    'Definir orçamento total do Natal',
    'Dividir orçamento por presentes, comida, decoração, roupa, deslocações e extras',
    'Fazer lista de todas as pessoas a quem queres oferecer presente',
    'Separar lista por família, crianças, amigos, escola, vizinhos ou colegas',
    'Definir limite de valor por pessoa',
    'Escrever 3 ideias de presente para cada pessoa antes de comprar',
    'Ver gostos, tamanhos, idades, hobbies e necessidades de cada pessoa',
    'Criar lista de presentes já comprados para evitar duplicados',
    'Comprar presentes por fases, começando pelos mais difíceis',
    'Guardar recibos e prazos de troca numa pasta ou envelope',
    'Criar zona em casa para guardar presentes escondidos',
    'Comprar papel de embrulho, sacos, fitas, etiquetas e cartões',
    'Marcar uma tarde para embrulhar presentes sem pressa',
    'Identificar cada presente logo depois de embrulhar',
    'Confirmar se há amigo secreto, festa da escola ou lembranças extras',
    'Ver roupa das crianças para festas, escola, fotografias ou noite de Natal',
    'Ver a tua roupa e acessórios sem deixar para a última semana',
    'Confirmar planos da noite de Natal e dia de Natal',
    'Confirmar quem recebe, quem leva comida e horários',
    'Definir menu: entradas, prato principal, acompanhamentos, sobremesas e bebidas',
    'Fazer lista de compras alimentar por supermercado, talho, peixaria e pastelaria',
    'Encomendar bolo, doces, carne, peixe ou itens especiais com antecedência',
    'Ver decoração de Natal que já existe em casa',
    'Comprar apenas decoração que falta ou que melhora o ambiente sem acumular',
    'Marcar dia para montar árvore e decoração',
    'Criar playlist, filmes ou pequenos rituais de família',
    'Planear atividades simples para as crianças nas férias de Natal',
    'Confirmar deslocações, combustível, portagens, malas ou estadias',
    'Preparar medicamentos, documentos e essenciais se houver viagem',
    'Na semana anterior, confirmar tudo o que ainda falta comprar',
    'Dois dias antes, deixar presentes separados por destino',
    'No dia anterior, preparar roupa, comida adiantada e sacos de transporte',
  ],
  viagem: [
    'Definir objetivo da viagem: descanso, família, praia, cidade, visita, trabalho ou celebração',
    'Confirmar datas, horários e flexibilidade de ida/volta',
    'Definir orçamento total: transporte, alojamento, alimentação, atividades, compras e margem',
    'Pesquisar destino e guardar links úteis',
    'Confirmar documentos de todos: cartão cidadão, passaporte, autorizações e seguros',
    'Ver validade dos documentos',
    'Confirmar transporte: carro, avião, comboio ou autocarro',
    'Comprar bilhetes ou reservar transporte',
    'Guardar confirmações numa pasta digital',
    'Reservar alojamento e confirmar políticas de cancelamento',
    'Ver distância do alojamento a supermercados, farmácia, praia, transportes ou atividades',
    'Listar atividades desejadas por adulto e por criança',
    'Escolher poucas atividades obrigatórias para não sobrecarregar',
    'Reservar restaurantes ou atividades que esgotam',
    'Criar plano leve por dias: manhã, tarde e noite',
    'Ver meteorologia provável e ajustar roupa',
    'Fazer checklist de malas por pessoa',
    'Separar roupa por conjuntos para evitar excesso',
    'Confirmar roupa de dormir, banho, casacos, calçado e roupa suplente',
    'Preparar necessaire: higiene, protetor solar, escova, medicamentos, pensos e básicos',
    'Preparar mala das crianças com snacks, água, brinquedo, livros ou tablet',
    'Preparar documentos, cartões, dinheiro e carregadores',
    'Ver adaptadores, powerbank e cabos',
    'Planear comida/snacks para deslocação',
    'Confirmar quem cuida da casa, plantas, animais ou correio',
    'Deixar casa minimamente organizada antes de sair',
    'Fazer download de mapas, bilhetes e confirmações',
    'Na véspera, carregar telemóveis, powerbank e preparar roupa de viagem',
    'No dia, verificar documentos, chaves, carteira, água, medicação e bilhetes antes de sair',
  ],
  escola: [
    'Confirmar data de início das aulas ou prazo da escola',
    'Ver lista oficial de material escolar',
    'Separar o material que já existe em casa',
    'Testar canetas, lápis, marcadores, colas e tesouras antes de comprar novo',
    'Criar lista do que falta comprar por categoria',
    'Definir orçamento para material, mochila, roupa, calçado e extras',
    'Comprar primeiro o essencial obrigatório',
    'Comprar mochila, estojo ou lancheira se os antigos já não servirem',
    'Comprar etiquetas ou sistema para identificar material',
    'Identificar livros, cadernos, lápis, casacos, garrafas e lancheiras',
    'Confirmar tamanhos de roupa e calçado das crianças',
    'Ver roupa interior, meias, casacos, calças, camisolas e roupa de desporto',
    'Criar lista de peças em falta para setembro',
    'Comprar apenas o necessário para não acumular',
    'Preparar zona de estudo ou trabalhos de casa',
    'Organizar gaveta/caixa de material de apoio em casa',
    'Confirmar horários, atividades, transporte e refeições',
    'Atualizar calendário com reuniões, início de aulas e atividades',
    'Preparar rotina da manhã: acordar, vestir, pequeno-almoço, mochila, saída',
    'Preparar rotina da noite: banho, roupa do dia seguinte, mochila e lanche',
    'Testar a rotina alguns dias antes, se possível',
    'Preparar documentos ou autorizações pedidos pela escola',
    'Ver se há pagamentos, seguros, refeições ou plataforma escolar para ativar',
    'Na véspera, deixar mochila, roupa, lancheira e documentos prontos',
  ],
  roupa: [
    'Definir para quem é a renovação do guarda-roupa',
    'Retirar roupa da gaveta/armário e ver tudo com calma',
    'Separar por categorias: serve, não serve, estragado, doar, vender, guardar',
    'Experimentar peças-chave antes de comprar',
    'Anotar tamanhos atuais de roupa e calçado',
    'Identificar o que falta por estação: casacos, calças, camisolas, pijamas, roupa interior, meias e sapatos',
    'Criar lista de compras por prioridade',
    'Definir paleta de cores prática para combinar melhor',
    'Definir orçamento antes de ir às compras',
    'Ver lojas online e guardar referências',
    'Comprar primeiro básicos de qualidade e só depois extras bonitos',
    'Confirmar prazos de troca e guardar recibos',
    'Lavar ou preparar peças novas antes de usar',
    'Identificar roupa das crianças se for para escola ou atividades',
    'Organizar armário por categoria e frequência de uso',
    'Guardar roupa fora de estação em caixas identificadas',
  ],
  consulta: [
    'Confirmar data, hora, morada e profissional da consulta',
    'Confirmar se a consulta é presencial, online ou telefone',
    'Ver tempo de deslocação, estacionamento ou transporte',
    'Confirmar se há autorização, cartão, seguro ou documento necessário',
    'Preparar lista de sintomas, dúvidas ou temas a falar',
    'Juntar exames, relatórios, receitas ou fotografias relevantes',
    'Confirmar medicação atual e doses',
    'Anotar perguntas importantes para não esquecer durante a consulta',
    'Preparar roupa adequada caso haja exame físico',
    'Preparar snack, água ou entretenimento se fores com crianças',
    'Marcar lembrete para sair de casa com margem',
    'Depois da consulta, anotar orientações, medicação, exames pedidos e próxima data',
  ],
  ocasiao: [
    'Definir exatamente que ocasião é e qual o resultado desejado',
    'Confirmar data, hora, local e quem participa',
    'Definir orçamento para roupa, presente, comida, deslocação e extras',
    'Guardar inspirações visuais do ambiente, roupa, mesa ou presente',
    'Escolher roupa e acessórios com antecedência',
    'Confirmar se é preciso levar presente, comida, bebida ou contribuição',
    'Comprar ou preparar o que vais levar',
    'Ver deslocação, estacionamento e hora de saída',
    'Preparar saco com essenciais no dia anterior',
    'Confirmar tudo com a pessoa responsável dois ou três dias antes',
  ],
  rotina: [
    'Definir qual é o resultado mínimo aceitável desta rotina',
    'Dividir a rotina em passos pequenos e claros',
    'Escolher dia e hora realistas para repetir',
    'Preparar materiais necessários antes da hora da rotina',
    'Eliminar um obstáculo que costuma impedir a execução',
    'Criar uma versão mínima para dias sem energia',
    'Depois de executar, ajustar o que ficou pesado demais',
  ],
  projeto: [
    'Definir objetivo concreto deste bloco de projeto',
    'Escolher uma entrega visível e pequena',
    'Listar decisões pendentes',
    'Separar referências, links, imagens ou notas importantes',
    'Definir próximo passo de 20 minutos',
    'Bloquear tempo no calendário para execução',
    'Marcar revisão do progresso',
    'Guardar aprendizagem ou decisão final nas notas',
  ],
};

const state = { page: 'dashboard', planningView: 'year', currentDate: new Date(), selectedDate: new Date(), events: [], session: null, detailEventId: null };

const el = {
  authScreen: document.getElementById('auth-screen'), authForm: document.getElementById('auth-form'), authFeedback: document.getElementById('auth-feedback'), authEmail: document.getElementById('auth-email'), logoutBtn: document.getElementById('logout-btn'), pageTitle: document.getElementById('page-title'), topbarDate: document.getElementById('topbar-date'), pages: [...document.querySelectorAll('.page')], menuItems: [...document.querySelectorAll('.menu-item')], planningTabs: [...document.querySelectorAll('.planning-tab')], planningViews: [...document.querySelectorAll('.planning-view')], sidebar: document.getElementById('sidebar'), mobileMenuBtn: document.getElementById('mobile-menu-btn'), stats: document.getElementById('dashboard-stats'), upcoming: document.getElementById('dashboard-upcoming'), yearLabel: document.getElementById('year-label'), yearGrid: document.getElementById('year-grid'), calendarLabel: document.getElementById('calendar-label'), calendarGrid: document.getElementById('calendar-grid'), dayEvents: document.getElementById('day-events'), selectedDayLabel: document.getElementById('selected-day-label'), weekLabel: document.getElementById('week-label'), weekGrid: document.getElementById('week-grid'), todayLabel: document.getElementById('today-label'), todayEvents: document.getElementById('today-events'), eventModal: document.getElementById('event-modal'), eventForm: document.getElementById('event-form'), eventFeedback: document.getElementById('event-feedback'), eventSubmitBtn: document.getElementById('event-submit-btn'), quickEventBtn: document.getElementById('quick-event-btn'), selectedDayEventBtn: document.getElementById('selected-day-event-btn'), areaColorDot: document.getElementById('area-color-dot'), areaColorName: document.getElementById('area-color-name'), areaColorNote: document.getElementById('area-color-note'), generateChecklistBtn: null, detailModal: null, detailContent: null, detailTitle: null, detailType: null, detailFeedback: null,
};

function ensureDynamicUi() {
  const smartCard = document.querySelector('.smart-planning-card');
  if (smartCard && !document.getElementById('generate-checklist-btn')) {
    const button = document.createElement('button');
    button.id = 'generate-checklist-btn'; button.type = 'button'; button.className = 'text-btn'; button.textContent = 'Gerar checklist sugerida';
    smartCard.appendChild(button);
  }
  el.generateChecklistBtn = document.getElementById('generate-checklist-btn');

  if (!document.getElementById('smart-planning-styles')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="smart-planning-styles">
      .event-card{width:100%;text-align:left;border:none;cursor:pointer;color:#2f2720}.clickable-row{width:100%;background:transparent;text-align:left;cursor:pointer;color:var(--ink)}.compact-event-card{width:100%;text-align:left;cursor:pointer;color:var(--ink)}.compact-event-card:hover,.today-card:hover,.event-card:hover{filter:brightness(.98);transform:translateY(-1px)}.detail-panel{width:min(840px,96vw)}.detail-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;border-left:10px solid var(--event-color);background:rgba(255,255,255,.55);border-top:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:14px;margin-bottom:12px}.detail-summary>div{border:1px solid var(--line);background:var(--paper);padding:10px}.detail-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 16px}.detail-checklist{display:grid;gap:8px;margin-top:10px}.detail-checklist li{border:1px solid var(--line);background:rgba(255,255,255,.68);padding:9px}.detail-checklist label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.detail-checklist input{margin-top:3px}.event-checklist li.is-done span,.event-checklist li.is-done{opacity:.58;text-decoration:line-through}.today-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.today-column{border:1px solid var(--line);background:var(--paper);padding:14px;min-height:180px}.today-card{width:100%;display:grid;gap:4px;text-align:left;border:1px solid var(--line);border-left:8px solid var(--event-color);background:#fffaf4;color:var(--ink);padding:10px;margin:8px 0;cursor:pointer}.today-card span{color:var(--soft-ink);font-size:.86rem}.action-list button{border:0;background:transparent;text-align:left;color:var(--ink);font:inherit;cursor:pointer;padding:0}.action-list small{display:block;color:var(--soft-ink);font-size:.75rem}.detail-notes{white-space:pre-wrap;line-height:1.55;background:rgba(255,255,255,.55);border:1px solid var(--line);padding:12px}@media(max-width:900px){.detail-summary,.today-board{grid-template-columns:1fr}}
    </style>`);
  }

  if (!document.getElementById('detail-modal')) {
    document.body.insertAdjacentHTML('beforeend', `<section id="detail-modal" class="modal is-hidden" aria-hidden="true"><div class="modal-backdrop" data-close-detail></div><div class="modal-panel detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div class="modal-header"><div><p class="eyebrow" id="detail-type">Evento</p><h3 id="detail-title">Detalhe do evento</h3></div><button class="icon-btn" type="button" data-close-detail aria-label="Fechar">×</button></div><div id="detail-content"></div><p id="detail-feedback" class="form-feedback" aria-live="polite"></p></div></section>`);
  }
  el.detailModal = document.getElementById('detail-modal'); el.detailContent = document.getElementById('detail-content'); el.detailTitle = document.getElementById('detail-title'); el.detailType = document.getElementById('detail-type'); el.detailFeedback = document.getElementById('detail-feedback');
  document.querySelectorAll('[data-close-detail]').forEach((node) => node.addEventListener('click', closeDetailModal));
}

function fmtDate(date) { return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }); }
function fmtDateTimeLocal(date) { const pad = (value) => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999); }
function startOfYear(date) { return new Date(date.getFullYear(), 0, 1); }
function endOfYear(date) { return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999); }
function startOfWeek(date) { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; }
function endOfWeek(date) { const d = startOfWeek(date); d.setDate(d.getDate() + 6); d.setHours(23, 59, 59, 999); return d; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function setMonthSafely(offset) { const next = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + offset, 1); state.currentDate = next; state.selectedDate = new Date(next); }
function eventColor(name) { return eventColors[name] || '#d9c7a6'; }
function readableTime(dateValue) { return new Date(dateValue).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(value) { return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function normalizeText(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function parseChecklist(value) { return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean).map((text) => ({ text, done: false })); }
function checklistProgress(event) { const items = Array.isArray(event.checklist) ? event.checklist : []; if (!items.length) return ''; const done = items.filter((item) => item.done).length; return `${done}/${items.length}`; }
function preparationLabel(event) { const days = Number(event.prepare_days_before || 0); if (!days) return ''; if (days === 1) return 'preparar 1 dia antes'; if (days === 7) return 'preparar 1 semana antes'; if (days === 14) return 'preparar 2 semanas antes'; if (days === 30) return 'preparar 1 mês antes'; if (days === 60) return 'preparar 2 meses antes'; if (days === 90) return 'preparar 3 meses antes'; return `preparar ${days} dias antes`; }
function eventMeta(event) { const parts = []; if (event.event_type && event.event_type !== 'Normal') parts.push(event.event_type); const prep = preparationLabel(event); if (prep) parts.push(prep); const progress = checklistProgress(event); if (progress) parts.push(`checklist ${progress}`); if (event.recurrence && event.recurrence !== 'none') parts.push(recurrenceLabels[event.recurrence]); if (event.status && event.status !== 'normal') parts.push(statusLabels[event.status] || event.status); return parts.join(' · '); }
function getEventById(eventId) { return state.events.find((event) => String(event.id) === String(eventId)); }
function eventBlock(event, variant = 'month') { const color = eventColor(event.color); const meta = eventMeta(event); return `<button type="button" class="event-card event-card--${variant}" data-event-id="${event.id}" style="--event-color:${color}; background:${color};"><strong>${escapeHtml(event.title)}</strong><span>${event.all_day ? 'Dia inteiro' : readableTime(event.starts_at)}${meta ? ` · ${escapeHtml(meta)}` : ''}</span></button>`; }
function addRecurrence(date, recurrence, index) { const next = new Date(date); if (recurrence === 'daily') next.setDate(next.getDate() + index); if (recurrence === 'weekly') next.setDate(next.getDate() + (index * 7)); if (recurrence === 'monthly') next.setMonth(next.getMonth() + index); if (recurrence === 'yearly') next.setFullYear(next.getFullYear() + index); return next; }
function buildRecurringPayload(basePayload, recurrence) { const total = recurrenceOccurrences[recurrence] || 1; if (total === 1) return [basePayload]; const start = new Date(basePayload.starts_at); const end = basePayload.ends_at ? new Date(basePayload.ends_at) : null; const duration = end ? end.getTime() - start.getTime() : null; return Array.from({ length: total }, (_, index) => { const startsAt = addRecurrence(start, recurrence, index); const endsAt = duration === null ? null : new Date(startsAt.getTime() + duration); return { ...basePayload, starts_at: startsAt.toISOString(), ends_at: endsAt ? endsAt.toISOString() : null }; }); }
function inferChecklistKey({ title, type, area }) { const haystack = `${normalizeText(title)} ${normalizeText(type)} ${normalizeText(area)}`; if (haystack.includes('natal')) return 'natal'; if (haystack.includes('ferias') || haystack.includes('viagem') || haystack.includes('hotel') || haystack.includes('praia')) return 'viagem'; if (haystack.includes('material escolar') || haystack.includes('regresso as aulas') || haystack.includes('escola')) return 'escola'; if (haystack.includes('guarda roupa') || haystack.includes('guarda-roupa') || haystack.includes('roupa') || haystack.includes('calcado')) return 'roupa'; if (haystack.includes('consulta') || haystack.includes('medico') || haystack.includes('dentista')) return 'consulta'; if (haystack.includes('crianca') || haystack.includes('filho') || haystack.includes('filha') || haystack.includes('turma') || area === 'Filhos') { if (type === 'Aniversário' || haystack.includes('aniversario')) return 'aniversarioCrianca'; } if (type === 'Aniversário' || haystack.includes('aniversario')) return 'aniversario'; if (type === 'Ocasião especial') return 'ocasiao'; if (type === 'Rotina') return 'rotina'; if (type === 'Projeto') return 'projeto'; return 'ocasiao'; }
function buildSuggestedChecklistFromForm() { const title = el.eventForm.elements.title?.value || ''; const type = el.eventForm.elements.event_type?.value || 'Normal'; const area = el.eventForm.elements.area?.value || 'Casa'; const key = inferChecklistKey({ title, type, area }); const template = checklistTemplates[key] || checklistTemplates.ocasiao; const days = Number(el.eventForm.elements.prepare_days_before?.value || 0); const timing = days >= 60 ? ['Criar primeiro bloco de preparação ainda esta semana', 'Dividir compras e decisões por semanas para não ficar tudo para o fim'] : days >= 30 ? ['Escolher esta semana o que precisa de orçamento, reserva ou encomenda', 'Fechar compras principais pelo menos uma semana antes'] : days >= 7 ? ['Fazer hoje a lista do que depende de outras pessoas', 'Resolver compras e confirmações nos próximos dois dias'] : ['Escolher apenas o essencial para este evento caber na vida real']; return [...timing, ...template, ...commonPreparation]; }
function mergeChecklistLines(existing, suggested) { const current = String(existing || '').split('\n').map((line) => line.trim()).filter(Boolean); const seen = new Set(current.map(normalizeText)); suggested.forEach((item) => { const key = normalizeText(item); if (!seen.has(key)) { current.push(item); seen.add(key); } }); return current.join('\n'); }

function route(page) { state.page = page; el.pages.forEach((p) => p.classList.toggle('is-active', p.dataset.page === page)); el.menuItems.forEach((b) => b.classList.toggle('is-active', b.dataset.page === page)); el.pageTitle.textContent = ({ dashboard: 'Painel diário', planning: 'Planeamento' })[page] || 'Painel diário'; el.sidebar.classList.remove('is-open'); render(); }
function setPlanningView(view) { state.planningView = view; el.planningTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.planningView === view)); el.planningViews.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.planningView === view)); render(); }
async function refreshEventsForCurrentScope() { const starts = [startOfYear(state.currentDate), startOfMonth(state.currentDate), startOfWeek(state.currentDate)]; const ends = [endOfYear(state.currentDate), endOfMonth(state.currentDate), endOfWeek(state.currentDate)]; const rangeStart = new Date(Math.min(...starts.map((d) => d.getTime()))); const rangeEnd = new Date(Math.max(...ends.map((d) => d.getTime()))); state.events = await listEventsByRange(rangeStart.toISOString(), new Date(rangeEnd.getTime() + 86400000).toISOString()); }
async function navigateCalendar(changeFn) { changeFn(); render(); try { await refreshEventsForCurrentScope(); render(); } catch (error) { console.error(error); if (el.dayEvents) el.dayEvents.innerHTML = `<p class="muted">Não consegui atualizar os eventos agora. ${escapeHtml(error?.message || '')}</p>`; } }

function renderDashboard() { const now = new Date(); const prepWindowEnd = new Date(now); prepWindowEnd.setDate(now.getDate() + 30); const thisWeekEnd = endOfWeek(now); const weekEvents = state.events.filter((e) => new Date(e.starts_at) >= now && new Date(e.starts_at) <= thisWeekEnd); const monthEvents = state.events.filter((e) => new Date(e.starts_at).getMonth() === now.getMonth() && new Date(e.starts_at).getFullYear() === now.getFullYear()); const prepEvents = state.events.filter((e) => { const days = Number(e.prepare_days_before || 0); if (!days) return false; const eventDate = new Date(e.starts_at); const prepStart = new Date(eventDate); prepStart.setDate(eventDate.getDate() - days); return prepStart <= prepWindowEnd && eventDate >= now && e.status !== 'concluido'; }); el.stats.innerHTML = `<div class="stat"><div class="muted">Este mês</div><strong>${monthEvents.length} eventos</strong></div><div class="stat"><div class="muted">Esta semana</div><strong>${weekEvents.length} eventos</strong></div><div class="stat"><div class="muted">Preparar</div><strong>${prepEvents.length} planos</strong></div>`; const upcoming = [...state.events].filter((e) => new Date(e.starts_at) >= now).slice(0, 6); el.upcoming.innerHTML = upcoming.length ? upcoming.map((e) => `<button type="button" class="list-item event-list-item clickable-row" data-event-id="${e.id}" style="--event-color:${eventColor(e.color)}"><div><strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(eventMeta(e) || e.area || '')}</div></div><span class="muted">${fmtDate(new Date(e.starts_at))}</span></button>`).join('') : '<p class="muted">Sem eventos próximos.</p>'; }
function renderYear() { const year = state.currentDate.getFullYear(); el.yearLabel.textContent = String(year); const months = Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)); el.yearGrid.innerHTML = months.map((month) => { const count = state.events.filter((event) => { const date = new Date(event.starts_at); return date.getFullYear() === year && date.getMonth() === month.getMonth(); }).length; return `<button class="year-card" type="button" data-month="${month.getMonth()}"><span>${month.toLocaleDateString('pt-PT', { month: 'long' })}</span><strong>${count}</strong><small>${count === 1 ? 'evento' : 'eventos'}</small></button>`; }).join(''); [...el.yearGrid.querySelectorAll('.year-card')].forEach((card) => card.addEventListener('click', () => { state.currentDate = new Date(year, Number(card.dataset.month), 1); state.selectedDate = new Date(state.currentDate); setPlanningView('month'); })); }
function renderCalendar() { const base = state.currentDate; const today = new Date(); el.calendarLabel.textContent = base.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }); const first = new Date(base.getFullYear(), base.getMonth(), 1); const firstWeekday = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(first.getDate() - firstWeekday); const cells = []; for (let i = 0; i < 42; i += 1) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); } el.calendarGrid.innerHTML = cells.map((d) => { const inMonth = d.getMonth() === base.getMonth(); const isToday = sameDay(d, today); const isSelected = sameDay(d, state.selectedDate); const dayEvents = state.events.filter((e) => sameDay(new Date(e.starts_at), d)); return `<div class="cal-cell ${inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" role="button" tabindex="0" data-date="${d.toISOString()}" aria-label="${fmtDate(d)}"><div class="cal-day">${d.getDate()}</div><div class="cal-events">${dayEvents.slice(0, 3).map((ev) => eventBlock(ev, 'month')).join('')}</div></div>`; }).join(''); [...el.calendarGrid.querySelectorAll('.cal-cell')].forEach((cell) => { const openNew = (event) => { if (event.target.closest('[data-event-id]')) return; const clickedDate = new Date(cell.dataset.date); state.selectedDate = clickedDate; renderDayEvents(); openEventModal(clickedDate); }; cell.addEventListener('click', openNew); cell.addEventListener('keydown', (event) => { if (event.key === 'Enter') openNew(event); }); }); renderDayEvents(); }
function renderDayEvents() { el.selectedDayLabel.textContent = fmtDate(state.selectedDate); const events = state.events.filter((e) => sameDay(new Date(e.starts_at), state.selectedDate)); el.dayEvents.innerHTML = events.length ? events.map((e) => `<button type="button" class="day-plan-card compact-event-card" data-event-id="${e.id}" style="--event-color:${eventColor(e.color)}"><div class="day-plan-head"><div><p class="eyebrow">${escapeHtml(e.event_type || 'Evento')}</p><strong>${escapeHtml(e.title)}</strong><div class="muted">${escapeHtml(e.area || 'Sem área')}</div></div><div class="muted">${e.all_day ? 'Dia inteiro' : readableTime(e.starts_at)}</div></div>${eventMeta(e) ? `<p class="plan-meta">${escapeHtml(eventMeta(e))}</p>` : ''}</button>`).join('') : '<p class="muted">Sem eventos para este dia.</p>'; }
function renderWeek() { const start = startOfWeek(state.currentDate); const end = endOfWeek(state.currentDate); el.weekLabel.textContent = `${fmtDate(start)} — ${fmtDate(end)}`; const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); el.weekGrid.innerHTML = days.map((day) => { const events = state.events.filter((e) => sameDay(new Date(e.starts_at), day)); return `<article class="week-day ${sameDay(day, new Date()) ? 'is-today' : ''}"><h5>${day.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit' })}</h5>${events.map((e) => eventBlock(e, 'week')).join('') || '<p class="muted">Sem eventos</p>'}</article>`; }).join(''); }
function renderToday() { const today = new Date(); el.todayLabel.textContent = fmtDate(today); const todayEvents = state.events.filter((e) => sameDay(new Date(e.starts_at), today)); const now = new Date(); const prepDue = state.events.filter((event) => { const days = Number(event.prepare_days_before || 0); if (!days || event.status === 'concluido') return false; const eventDate = new Date(event.starts_at); const prepStart = new Date(eventDate); prepStart.setDate(eventDate.getDate() - days); return prepStart <= now && eventDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); }); const pendingChecklist = state.events.flatMap((event) => (Array.isArray(event.checklist) ? event.checklist : []).map((item) => ({ event, item }))).filter(({ item }) => !item.done).slice(0, 8); el.todayEvents.className = 'today-board'; el.todayEvents.innerHTML = `<section class="today-column"><p class="eyebrow">Agenda de hoje</p>${todayEvents.length ? todayEvents.map((e) => `<button type="button" class="today-card" data-event-id="${e.id}" style="--event-color:${eventColor(e.color)}"><strong>${escapeHtml(e.title)}</strong><span>${e.all_day ? 'Dia inteiro' : readableTime(e.starts_at)} · ${escapeHtml(e.area || '')}</span></button>`).join('') : '<p class="muted">Sem eventos marcados para hoje.</p>'}</section><section class="today-column"><p class="eyebrow">Já está na hora de preparar</p>${prepDue.length ? prepDue.slice(0, 6).map((e) => `<button type="button" class="today-card" data-event-id="${e.id}" style="--event-color:${eventColor(e.color)}"><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(eventMeta(e))}</span></button>`).join('') : '<p class="muted">Nada crítico para preparar hoje.</p>'}</section><section class="today-column"><p class="eyebrow">Próximas ações</p>${pendingChecklist.length ? `<ul class="event-checklist action-list">${pendingChecklist.map(({ event, item }) => `<li><span class="fake-check"></span><button type="button" data-event-id="${event.id}">${escapeHtml(item.text)} <small>${escapeHtml(event.title)}</small></button></li>`).join('')}</ul>` : '<p class="muted">Sem ações pendentes.</p>'}</section>`; }
function render() { el.topbarDate.textContent = fmtDate(new Date()); renderDashboard(); renderYear(); renderCalendar(); renderWeek(); renderToday(); if (state.detailEventId && !el.detailModal.classList.contains('is-hidden')) renderDetailModal(); }

function syncAreaColor() { const area = el.eventForm.elements.area?.value || 'Casa'; const palette = areaPalette[area] || areaPalette.Outro; const radio = el.eventForm.querySelector(`input[name="color"][value="${palette.color}"]`); if (radio) radio.checked = true; if (el.areaColorDot) el.areaColorDot.style.setProperty('--event-color', palette.hex); if (el.areaColorName) el.areaColorName.textContent = palette.name; if (el.areaColorNote) el.areaColorNote.textContent = `${area} fica com ${palette.name.toLowerCase()} por defeito, para manter o calendário harmonioso.`; }
function syncSmartDefaults() { const type = el.eventForm.elements.event_type?.value || 'Normal'; const prepare = el.eventForm.elements.prepare_days_before; const recurrence = el.eventForm.elements.recurrence; if (!prepare || !recurrence) return; if (type === 'Aniversário') { prepare.value = '60'; recurrence.value = 'yearly'; } if (type === 'Natal') { prepare.value = '90'; recurrence.value = 'yearly'; } if (type === 'Ocasião especial') { prepare.value = '30'; } if (type === 'Viagem') { prepare.value = '60'; } if (type === 'Consulta') { prepare.value = '7'; } if (type === 'Escola / filhos') { prepare.value = '30'; } if (type === 'Rotina') { prepare.value = '7'; recurrence.value = 'weekly'; } }
function handleGenerateChecklist() { const textarea = el.eventForm.elements.checklist_text; const suggested = buildSuggestedChecklistFromForm(); textarea.value = mergeChecklistLines(textarea.value, suggested); el.eventFeedback.textContent = `Checklist sugerida criada com ${suggested.length} passos. Podes apagar ou ajustar qualquer linha.`; }
function openEventModal(date = state.selectedDate) { const start = new Date(date); start.setHours(start.getHours() || 9, 0, 0, 0); state.selectedDate = new Date(date); el.eventForm.reset(); el.eventForm.elements.starts_at.value = fmtDateTimeLocal(start); syncAreaColor(); el.eventFeedback.textContent = ''; el.eventSubmitBtn.disabled = false; el.eventSubmitBtn.textContent = 'Guardar evento'; el.eventModal.classList.remove('is-hidden'); el.eventModal.setAttribute('aria-hidden', 'false'); el.eventForm.elements.title.focus(); }
function closeEventModal() { el.eventModal.classList.add('is-hidden'); el.eventModal.setAttribute('aria-hidden', 'true'); }
function openDetailModal(eventId) { state.detailEventId = eventId; renderDetailModal(); el.detailModal.classList.remove('is-hidden'); el.detailModal.setAttribute('aria-hidden', 'false'); }
function closeDetailModal() { state.detailEventId = null; el.detailModal.classList.add('is-hidden'); el.detailModal.setAttribute('aria-hidden', 'true'); }
function renderDetailModal() { const event = getEventById(state.detailEventId); if (!event) return; const items = Array.isArray(event.checklist) ? event.checklist : []; const done = items.filter((item) => item.done).length; const total = items.length; el.detailTitle.textContent = event.title; el.detailType.textContent = event.event_type || 'Evento'; el.detailContent.innerHTML = `<section class="detail-summary" style="--event-color:${eventColor(event.color)}"><div><p class="eyebrow">Área</p><strong>${escapeHtml(event.area || 'Sem área')}</strong></div><div><p class="eyebrow">Quando</p><strong>${fmtDate(new Date(event.starts_at))}${event.all_day ? '' : ` · ${readableTime(event.starts_at)}`}</strong></div><div><p class="eyebrow">Estado</p><strong>${escapeHtml(statusLabels[event.status] || event.status || 'normal')}</strong></div><div><p class="eyebrow">Progresso</p><strong>${total ? `${done}/${total}` : 'sem checklist'}</strong></div></section>${eventMeta(event) ? `<p class="plan-meta">${escapeHtml(eventMeta(event))}</p>` : ''}<section class="detail-actions"><button type="button" class="text-btn" data-detail-generate>Gerar/completar checklist sugerida</button><button type="button" class="primary-btn" data-detail-complete>${event.status === 'concluido' ? 'Reabrir evento' : 'Marcar como concluído'}</button></section><section><h4>Checklist de preparação</h4>${items.length ? `<ul class="event-checklist detail-checklist">${items.map((item, index) => `<li class="${item.done ? 'is-done' : ''}"><label><input type="checkbox" data-check-index="${index}" ${item.done ? 'checked' : ''} /> <span>${escapeHtml(item.text)}</span></label></li>`).join('')}</ul>` : '<p class="muted">Este evento ainda não tem checklist. Usa o botão para gerar uma sugestão.</p>'}</section>${event.notes ? `<section><h4>Notas</h4><p class="detail-notes">${escapeHtml(event.notes)}</p></section>` : ''}`; }
async function toggleChecklistItem(index, checked) { const event = getEventById(state.detailEventId); if (!event) return; const checklist = Array.isArray(event.checklist) ? event.checklist.map((item) => ({ ...item })) : []; checklist[index] = { ...checklist[index], done: checked }; const allDone = checklist.length > 0 && checklist.every((item) => item.done); const status = allDone ? 'concluido' : checklist.some((item) => item.done) ? 'em_curso' : (Number(event.prepare_days_before || 0) > 0 ? 'por_preparar' : 'normal'); el.detailFeedback.textContent = 'A atualizar…'; try { const updated = await updateEvent(event.id, { checklist, status }); state.events = state.events.map((item) => (item.id === updated.id ? updated : item)); el.detailFeedback.textContent = 'Guardado.'; render(); } catch (error) { el.detailFeedback.textContent = error?.message ? `Erro: ${error.message}` : 'Não foi possível atualizar.'; } }
async function completeDetailEvent() { const event = getEventById(state.detailEventId); if (!event) return; const nextStatus = event.status === 'concluido' ? 'em_curso' : 'concluido'; const checklist = Array.isArray(event.checklist) ? event.checklist.map((item) => ({ ...item, done: nextStatus === 'concluido' ? true : item.done })) : []; el.detailFeedback.textContent = 'A atualizar…'; try { const updated = await updateEvent(event.id, { status: nextStatus, checklist }); state.events = state.events.map((item) => (item.id === updated.id ? updated : item)); el.detailFeedback.textContent = 'Guardado.'; render(); } catch (error) { el.detailFeedback.textContent = error?.message ? `Erro: ${error.message}` : 'Não foi possível atualizar.'; } }
async function generateChecklistForDetail() { const event = getEventById(state.detailEventId); if (!event) return; const key = inferChecklistKey({ title: event.title, type: event.event_type || 'Normal', area: event.area || 'Casa' }); const suggested = [...(checklistTemplates[key] || checklistTemplates.ocasiao), ...commonPreparation]; const current = Array.isArray(event.checklist) ? event.checklist : []; const existingText = current.map((item) => item.text).join('\n'); const mergedText = mergeChecklistLines(existingText, suggested); const doneMap = new Map(current.map((item) => [normalizeText(item.text), Boolean(item.done)])); const checklist = mergedText.split('\n').filter(Boolean).map((text) => ({ text, done: doneMap.get(normalizeText(text)) || false })); el.detailFeedback.textContent = 'A completar checklist…'; try { const updated = await updateEvent(event.id, { checklist, status: event.status === 'concluido' ? 'concluido' : 'por_preparar' }); state.events = state.events.map((item) => (item.id === updated.id ? updated : item)); el.detailFeedback.textContent = 'Checklist completada.'; render(); } catch (error) { el.detailFeedback.textContent = error?.message ? `Erro: ${error.message}` : 'Não foi possível gerar a checklist.'; } }

async function handleAuthSubmit(ev) { ev.preventDefault(); const fd = new FormData(el.authForm); const email = String(fd.get('email') || '').trim(); const password = String(fd.get('password') || '').trim(); const submitter = ev.submitter?.dataset.mode || 'login'; try { if (submitter === 'signup') { await signUp(email, password); el.authFeedback.textContent = 'Conta criada. Podes entrar se a confirmação de email estiver desligada.'; } else { await signIn(email, password); el.authFeedback.textContent = 'Sessão iniciada com sucesso.'; } } catch (error) { el.authFeedback.textContent = formatAuthError(error); } }
async function handleAddEvent(ev) { ev.preventDefault(); el.eventFeedback.textContent = 'A guardar…'; el.eventSubmitBtn.disabled = true; el.eventSubmitBtn.textContent = 'A guardar…'; try { const fd = new FormData(el.eventForm); const startsAt = String(fd.get('starts_at')); const endsAtRaw = String(fd.get('ends_at')); const recurrence = String(fd.get('recurrence') || 'none'); const checklist = parseChecklist(fd.get('checklist_text')); const basePayload = { user_id: state.session.user.id, title: String(fd.get('title')).trim(), event_type: String(fd.get('event_type') || 'Normal'), area: String(fd.get('area')).trim() || null, notes: String(fd.get('notes')).trim() || null, color: String(fd.get('color')), starts_at: new Date(startsAt).toISOString(), ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null, all_day: fd.get('all_day') === 'on', prepare_days_before: Number(fd.get('prepare_days_before') || 0), recurrence, checklist, status: Number(fd.get('prepare_days_before') || 0) > 0 ? 'por_preparar' : 'normal' }; const payload = buildRecurringPayload(basePayload, recurrence); await createEvent(payload); el.eventFeedback.textContent = payload.length > 1 ? `${payload.length} eventos guardados.` : 'Evento guardado.'; await refreshEventsForCurrentScope(); render(); setTimeout(closeEventModal, 650); } catch (error) { el.eventFeedback.textContent = error?.message ? `Erro: ${error.message}` : 'Não foi possível guardar o evento.'; } finally { el.eventSubmitBtn.disabled = false; el.eventSubmitBtn.textContent = 'Guardar evento'; } }

async function boot() { ensureDynamicUi(); el.menuItems.forEach((btn) => btn.addEventListener('click', () => route(btn.dataset.page))); el.planningTabs.forEach((btn) => btn.addEventListener('click', () => setPlanningView(btn.dataset.planningView))); el.mobileMenuBtn.addEventListener('click', () => el.sidebar.classList.toggle('is-open')); el.quickEventBtn.addEventListener('click', () => openEventModal(new Date())); el.selectedDayEventBtn.addEventListener('click', () => openEventModal(state.selectedDate)); document.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', closeEventModal)); el.eventForm.elements.area.addEventListener('change', syncAreaColor); el.eventForm.elements.event_type.addEventListener('change', () => { syncSmartDefaults(); syncAreaColor(); }); el.generateChecklistBtn?.addEventListener('click', handleGenerateChecklist);
  document.addEventListener('click', (event) => { const opener = event.target.closest('[data-event-id]'); if (!opener) return; event.preventDefault(); event.stopPropagation(); openDetailModal(opener.dataset.eventId); });
  el.detailContent.addEventListener('change', (event) => { const checkbox = event.target.closest('[data-check-index]'); if (!checkbox) return; toggleChecklistItem(Number(checkbox.dataset.checkIndex), checkbox.checked); });
  el.detailContent.addEventListener('click', (event) => { if (event.target.closest('[data-detail-complete]')) completeDetailEvent(); if (event.target.closest('[data-detail-generate]')) generateChecklistForDetail(); });
  document.getElementById('prev-year').addEventListener('click', () => navigateCalendar(() => { state.currentDate = new Date(state.currentDate.getFullYear() - 1, 0, 1); state.selectedDate = new Date(state.currentDate); }));
  document.getElementById('next-year').addEventListener('click', () => navigateCalendar(() => { state.currentDate = new Date(state.currentDate.getFullYear() + 1, 0, 1); state.selectedDate = new Date(state.currentDate); }));
  document.getElementById('prev-month').addEventListener('click', () => navigateCalendar(() => setMonthSafely(-1)));
  document.getElementById('next-month').addEventListener('click', () => navigateCalendar(() => setMonthSafely(1)));
  document.getElementById('prev-week').addEventListener('click', () => navigateCalendar(() => { const next = new Date(state.currentDate); next.setDate(next.getDate() - 7); state.currentDate = next; state.selectedDate = new Date(next); }));
  document.getElementById('next-week').addEventListener('click', () => navigateCalendar(() => { const next = new Date(state.currentDate); next.setDate(next.getDate() + 7); state.currentDate = next; state.selectedDate = new Date(next); }));
  el.authForm.addEventListener('submit', handleAuthSubmit); el.logoutBtn.addEventListener('click', async () => { await signOut(); }); el.eventForm.addEventListener('submit', handleAddEvent);
  if (!hasSupabaseConfig) { document.getElementById('app').style.display = 'none'; el.authScreen.classList.remove('is-hidden'); el.authFeedback.textContent = 'Configuração em falta. Preenche o ficheiro public-config.js com as credenciais públicas do Supabase.'; return; }
  supabase.auth.onAuthStateChange(async (_event, session) => { state.session = session; const authenticated = Boolean(session?.user); el.authScreen.classList.toggle('is-hidden', authenticated); document.getElementById('app').style.display = authenticated ? 'flex' : 'none'; if (authenticated) { el.authEmail.textContent = session.user.email; await refreshEventsForCurrentScope(); route(state.page); } });
  const session = await getSession(); state.session = session; const authenticated = Boolean(session?.user); el.authScreen.classList.toggle('is-hidden', authenticated); document.getElementById('app').style.display = authenticated ? 'flex' : 'none'; if (authenticated) { el.authEmail.textContent = session.user.email; await refreshEventsForCurrentScope(); route('dashboard'); }
}

boot();
