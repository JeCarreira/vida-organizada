import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = window.__ENV__?.SUPABASE_URL || '';
const supabaseAnonKey = window.__ENV__?.SUPABASE_ANON_KEY || '';
const REQUEST_TIMEOUT_MS = 12000;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('Configuração Supabase em falta: define SUPABASE_URL e SUPABASE_ANON_KEY em public-config.js.');
}

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

function requireClient() {
  if (!supabase) {
    throw new Error('Configuração Supabase incompleta. Verifica o ficheiro public-config.js.');
  }
  return supabase;
}

async function withTimeout(promise, label = 'pedido ao Supabase') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Tempo esgotado no ${label}. Verifica a ligação, RLS e a tabela events no Supabase.`));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function formatAuthError(error) {
  const message = error?.message || '';
  const code = error?.code ? ` (${error.code})` : '';

  if (message.includes('Invalid login credentials')) return 'Email ou palavra-passe inválidos.';
  if (message.includes('Email not confirmed')) return 'Confirma o teu email antes de iniciar sessão.';
  if (message.includes('User already registered') || message.includes('already registered')) return 'Este email já está registado. Tenta iniciar sessão.';
  if (message.includes('Password should be at least')) return 'A palavra-passe deve ter pelo menos 6 caracteres.';
  if (message.includes('Signup requires a valid password')) return 'A palavra-passe não é válida. Usa pelo menos 6 caracteres.';
  if (message.includes('Database error saving new user')) return 'Erro ao criar o utilizador na base de dados. Verifica se o schema.sql foi aplicado no Supabase.';
  if (message.includes('Signups not allowed')) return 'O registo de novas contas está desligado no Supabase.';
  if (message.includes('rate limit')) return 'Muitas tentativas seguidas. Espera uns minutos e tenta novamente.';

  return `Erro Supabase${code}: ${message || 'não identificado'}`;
}

export async function getSession() {
  const { data, error } = await withTimeout(requireClient().auth.getSession(), 'arranque da sessão');
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { error } = await withTimeout(requireClient().auth.signUp({ email, password }), 'criação de conta');
  if (error) throw error;
}

export async function signIn(email, password) {
  const { error } = await withTimeout(requireClient().auth.signInWithPassword({ email, password }), 'login');
  if (error) throw error;
}

export async function signOut() {
  const { error } = await withTimeout(requireClient().auth.signOut(), 'logout');
  if (error) throw error;
}

export async function listEventsByRange(startIso, endIso) {
  const { data, error } = await withTimeout(
    requireClient()
      .from('events')
      .select('*')
      .gte('starts_at', startIso)
      .lt('starts_at', endIso)
      .order('starts_at', { ascending: true }),
    'leitura de eventos'
  );

  if (error) throw error;
  return data || [];
}

export async function createEvent(payload) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const { error } = await withTimeout(
    requireClient().from('events').insert(rows),
    rows.length > 1 ? 'gravação dos eventos recorrentes' : 'gravação do evento'
  );

  if (error) throw error;
  return true;
}

export async function updateEvent(eventId, patch) {
  const { data, error } = await withTimeout(
    requireClient()
      .from('events')
      .update(patch)
      .eq('id', eventId)
      .select('*')
      .single(),
    'atualização do evento'
  );

  if (error) throw error;
  return data;
}
