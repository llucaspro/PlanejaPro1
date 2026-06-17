# PlanejaPro

Copiloto inteligente para planejamento pedagógico — professores geram planos de aula completos em minutos com IA.

## Run & Operate

- `pnpm --filter @workspace/planejapro run dev` — frontend React/Vite (porta via $PORT)
- `pnpm --filter @workspace/api-server run dev` — API Express (porta via $PORT)
- `pnpm run typecheck` — typecheck completo em todos os pacotes
- `pnpm run build` — typecheck + build todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks e Zod schemas do OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- API: Express 5 + OpenAI (gpt-4o-mini)
- Validação: Zod (zod/v4), drizzle-zod
- Codegen: Orval (contract-first OpenAPI)
- Build: esbuild (CJS bundle)
- Persistência Fase 1: localStorage

## Where things live

- `lib/api-spec/openapi.yaml` — fonte de verdade do contrato da API
- `lib/api-client-react/src/generated/` — hooks React Query gerados (não editar)
- `lib/api-zod/src/generated/` — schemas Zod gerados (não editar)
- `artifacts/planejapro/src/pages/` — páginas do frontend
- `artifacts/planejapro/src/hooks/use-plannings.ts` — persistência localStorage
- `artifacts/planejapro/src/components/layout.tsx` — layout com sidebar
- `artifacts/api-server/src/routes/planning.ts` — geração de planejamento com IA
- `artifacts/api-server/src/routes/assistant.ts` — chat do assistente pedagógico

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → hooks tipados. Nunca escrever tipos manualmente.
- **Fase 1 localStorage**: planejamentos persistem no browser sem login. Estrutura preparada para Postgres/Prisma.
- **gpt-4o-mini**: modelo rápido e econômico para geração pedagógica. `response_format: json_object` para output estruturado.
- **Prompts separados**: lógica de prompt embutida nos routes para isolamento e fácil substituição por arquivo externo.
- **Sem DB na Fase 1**: `lib/db` existe na estrutura mas não é usado; rota de IA não depende de banco.

## Product

- **Home**: hero + CTAs + planejamentos recentes
- **Novo Planejamento**: formulário completo (disciplina, série, turma, conteúdo, perfil, recursos) → gera 20 seções via IA
- **Resultado**: visualização colapsável de todo o planejamento + export TXT + salvar
- **Meus Planejamentos**: lista com busca, filtro, duplicar, excluir
- **Assistente Pedagógico**: chat contextual com especialista em didática/inclusão
- **Importar**: upload TXT (PDF/DOCX em breve)
- **Configurações**: tema claro/escuro, dados, sobre

## User preferences

- Produto em português brasileiro
- Tom profissional mas humano — para professores, não corporativo
- Sem emojis na UI
- Aviso obrigatório: não afiliado ao Governo SP, professor é responsável final

## Gotchas

- `OPENAI_API_KEY` obrigatório no env para as rotas de IA funcionarem
- Após qualquer mudança em `openapi.yaml`, rodar `pnpm --filter @workspace/api-spec run codegen`
- Frontend não tem DB — todo o CRUD é localStorage via `usePlannings` hook
- `use-plannings.ts` importa tipos de `@workspace/api-client-react` (não de caminhos relativos)

## Roadmap Futuro

- Login e autenticação (Clerk)
- Assinatura mensal (Stripe)
- PostgreSQL + Prisma ORM
- Exportação PDF/DOCX real (jsPDF, docx)
- Importação PDF/DOCX real (pdf.js, mammoth.js)
- Compartilhamento entre professores
- Calendário e planejamento anual/semanal
- PWA + sync em nuvem
- Integração Google Drive / OneDrive
- App mobile (Expo)

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, TypeScript e detalhes dos pacotes
