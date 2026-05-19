# Vida de Mãe Leve — Sistema Pessoal (Fase 0.1)

Base técnica para autenticação e calendário com Supabase.

## Estrutura

- `index.html` — estrutura principal da aplicação.
- `css/styles.css` — estilos editoriais e responsivos.
- `js/app.js` — navegação, autenticação, dashboard, calendário, semana e hoje.
- `js/services/supabase.js` — cliente Supabase e operações de autenticação/eventos.
- `public-config.js` — configuração pública gerada/preenchida no deploy.
- `public-config.example.js` — exemplo seguro de configuração.
- `supabase/schema.sql` — schema mínimo com `profiles` e `events`.
- `supabase/rls.sql` — políticas RLS para isolamento por utilizador.

## Supabase

No SQL Editor do Supabase, executar por esta ordem:

1. `supabase/schema.sql`
2. `supabase/rls.sql`

## Vercel

A aplicação é estática. As variáveis precisam de ser usadas para gerar `public-config.js` durante o deploy.

Variáveis necessárias:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Nunca usar `service_role` ou `secret key` no frontend.

## QA manual

- Abrir o preview.
- Confirmar que o login aparece sem aviso de configuração em falta.
- Criar conta ou iniciar sessão.
- Criar evento.
- Confirmar evento no calendário, semana e hoje.
- Atualizar a página e confirmar persistência.
