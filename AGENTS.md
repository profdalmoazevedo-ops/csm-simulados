<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# csm-simulados

Brazilian exam-prep ("simulados") platform for Prof. Dalmo Azevedo. Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS v4 + Supabase. Path alias `@/*` → `src/*`.

## Conventions that differ from defaults
- **`next.config.ts` enables the React Compiler** (`reactCompiler: true`). Keep it on; don't hand-add memoization (`useMemo`/`useCallback`/`React.memo`) that the compiler does for you.
- **Tailwind v4, CSS-first**: no `tailwind.config`; theme lives in `src/app/globals.css` via `@theme inline`. Raw hex classes like `bg-[#09090b]` and `bg-emerald-600` are the house style.
- All App Router pages are `"use client"` components. All Supabase/DB reads happen client-side in `useEffect`; there is no server-side data fetching, no middleware, no SSR auth helpers.
- UI text, labels, and code comments are Brazilian Portuguese — keep new work in pt-BR.

## Supabase & auth
- Single anon-key browser client in `src/lib/supabase.ts`, imported directly everywhere. Auth uses `supabase.auth.getUser()` / `getSession()` in `useEffect`; login at `/auth` via `signInWithPassword`.
- **There are no route guards.** Admin visibility is only a hardcoded email check (`profdalmoazevedo@gmail.com`) in `src/components/Navbar.tsx`; nothing server-side protects `/admin/*`. Don't assume auth checks exist when editing page code.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in `src/app/api/importar-lote-ia/route.ts` (module-scope admin client). Never use it client-side.

## Env vars (`.env.local`, gitignored)
Required before `npm run dev`/`npm run build` (module-scope supabase clients crash without them): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`.
Gotcha: `src/app/suporte/page.tsx` also reads `NEXT_PUBLIC_BOT_SUPORTE_TOKEN` and `NEXT_PUBLIC_CHAT_ADMIN_ID` (Telegram bot) — these are NOT in the current `.env.local`.

## AI pipeline (API routes all cascade Gemini → Groq fallback)
- `/api/importar-ia` — parses pasted question text into JSON, no DB write.
- `/api/importar-lote-ia` — bulk-imports into `questoes`, with hardcoded fallbacks `banca="FGV"`, `orgao="Acervo Geral"`, `cargo="Diversos"`. Exports `maxDuration = 60`.
- `/api/gerar-comentario` — generates the gabarito explanation; returns HTML with `<br/>` line breaks, not `\n`.
- Groq fallback model is `openai/gpt-oss-120b`. Googles' Gemini endpoint is called directly via REST (raw `fetch`), not an SDK.

## Data conventions
- `questoes` schema (verify table before assuming): `banca`, `orgao`, `cargo`, `materia`, `topico`, `tipo_questao` (`multipla_escolha` | `certo_errado`), `enunciado`, `alternativa_a`..`alternativa_e` (nullable), `gabarito`, `comentario_gabarito`. A column `ano` (int4) also exists.
- Rich text (enunciado/comentario) is stored with `<br/>` line breaks — convert `\n` → `<br/>` when writing.
- Other tables seen in use: `notificacoes`, `notificacoes_lidas`, `chamados_suporte`, `simulados` + question join table.

## Performance layer (require `supabase/migrations/20260913_performance.sql`)
A manual migration must be run in the Supabase SQL Editor before the pages below work (idempotent: safe to re-run). It creates:
- Indexes on `questoes` filter columns and on `respostas_alunos`/`historico_tentativas`.
- Views `vw_opcoes_filtro` (`tipo, valor, total`) and `vw_topico_por_materia` (`materia, topico`).
- RPCs: `obter_opcoes_simulado`, `obter_ids_questoes` (same params `p_bancas, p_cargos, p_materias, p_topicos, p_anos, p_formatos, p_excluir_respondidas`, pass `null`/`[]` when unused), `obter_caderno_erros` (`p_aluno`), `obter_estatisticas_aluno` (`p_aluno`).
- `obter_opcoes_simulado` returns jsonb `{bancas, cargos, materias, topicos, anos, formatos, total}` where each list item is `{valor, total}`; its `formatos` values are DISPLAY strings (`Certo ou Errado`/`Múltipla Escolha`), while `p_formatos` expects banco values — the client translates via `traduzirFormatoParaBanco`.
- Do NOT re-upload the full `questoes` table to the client for filter options/ids — use these views/RPCs (`/gerador`, `/pratica`, dashboard do). RPC filters go in the function body, not the URL, to avoid Supabase URL-length overflow with thousands of answered ids.

## Commands
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` (eslint flat config in `eslint.config.mjs`)
- No typecheck or test scripts are configured — run `npx tsc --noEmit` to typecheck. There is no test suite.
- `npm run enriquecer-metadados` — local CLI (roda na máquina do usuário, IP residencial): busca cada questão faltante de cargo/órgão no Gran Cursos Questões (via DuckDuckGo direto + fetch direto/jina) e grava com `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`. Flags: `--dry-run`, `--limite N`. O `/api/inferir-metadados` (admin) faz o mesmo mas server-side (Vercel) e é mais limitado (rate-limit do DDG / IP compartilhado) — o script é o caminho confiável para lotes grandes.

## Quirks
- Navbar is intentionally hidden on `/auth` and `/simulado/*`.
- Admin sidebar links to `/admin/configuracoes`, but no such route exists yet (404) — dead link, not a missing feature elsewhere.