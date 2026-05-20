import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = window.__ENV__?.SUPABASE_URL || '';
const supabaseAnonKey = window.__ENV__?.SUPABASE_ANON_KEY || '';

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
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { error } = await requireClient().auth.signUp({ email, password });
  if (error) throw error;
}

export async function signIn(email, password) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function listEventsByRange(startIso, endIso) {
  const { data, error } = await requireClient()
    .from('events')
    .select('*')
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createEvent(payload) {
  const { data, error } = await requireClient()
    .from('events')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
