
# LILITO — Plataforma Oficial da VINCA (Fase 1 + preparação 1.1)

CRM proprietário com backend real (Lovable Cloud), identidade visual premium (preto/grafite/dourado) e separação rigorosa entre Master (Adriana Gomes) e Consultor. A Fase 1 entrega a plataforma completa; a arquitetura do módulo de Análise de Apólices já é preparada para a IA da Fase 1.1.

## Identidade visual

- Paleta: preto #0A0A0A predominante, grafite #1A1A1F / #2A2A30, branco off #F5F5F2, dourado metálico #C8A24B com variação clara #E6C77A para hover/realce.
- Tipografia: display serifada elegante (Cormorant ou Playfair) para títulos + sans corporativa (Inter) para corpo. Pequenos capitulares dourados em headers de módulo.
- Componentes: cartões com borda 1px grafite, sombras profundas e suaves, divisores em hairline dourada, ícones lineares finos (lucide stroke 1.25), microinterações discretas.
- Referência sensorial: BMW / MetLife / private banking. Densidade controlada, generoso respiro, sensação de "cockpit executivo".

## Backend (Lovable Cloud)

**Enum & roles**
- `app_role`: `master` | `consultor`
- `user_roles` + função `has_role(uuid, app_role)` SECURITY DEFINER.

**Enum de etapa do funil (oficial VINCA)**
`recomendacao` → `hot` → `ab` → `analise_apolice` → `fechamento` → `implantacao` → `cliente` → `pos_venda`

**Tabelas (todas com RLS + GRANTs)**
- `profiles` (id=auth.users, nome, email, telefone, ativo, criado_por) — trigger cria profile + role `consultor` no signup; Adriana é promovida a `master`.
- `prospects` (consultor_id, nome, telefone, cidade, especialidade_medica, estado_civil, filhos, conjuge, renda_estimada, patrimonio_estimado, quem_recomendou, observacoes, origem, etapa_funil, nota_qualificacao, scores 4-eixos, status_hot, ultima_interacao, dias_em_etapa, pa_estimado, motivo_perda).
- `clientes` (consultor_id, prospect_id?, nome, familia, pa_total, capital_segurado, ultima_revisao, proxima_revisao).
- `atividades` (consultor_id, prospect_id?, cliente_id?, tipo, resultado, observacao).
- `agenda_eventos` (consultor_id, prospect_id?, cliente_id?, tipo: AB/fechamento/revisita/joint_work/review, titulo, inicio, fim, local, status).
- `apolices` — campos manuais + **campos preparados para IA (Fase 1.1)**:
  - Manuais: cliente_id|prospect_id, seguradora enum (MetLife/Prudential/Icatu/MAG/Bradesco/SulAmérica/Porto/Azos/Outra), produto, tipo (whole_life/temporario), capital_segurado, premio_atual, prazo, resgate, coberturas jsonb, exclusoes jsonb, doencas_graves bool, invalidez bool, cirurgias bool, funeral bool, observacoes_consultor, estrategia_recomendacao, status (em_analise/apresentado/em_negociacao/migrado/nao_migrado), pdf_path.
  - **IA (já criados na Fase 1, populados na 1.1):** `resumo_ia` text, `pontos_fortes` jsonb, `pontos_fracos` jsonb, `observacoes_ia` text, `comparativo_metlife` jsonb, `ultima_analise_ia` timestamptz, `status_analise_ia` enum (`nao_analisado` | `em_processamento` | `concluido` | `erro`).
- `apolices_analises_historico` (apolice_id, payload jsonb, modelo, created_at) — guarda cada execução de IA para auditoria.
- `notificacoes` (user_id, tipo, titulo, payload, lida).

**Storage**: bucket privado `apolices-pdf` com policies por consultor_id (Master via `has_role`).

**RLS**: `consultor` vê/edita apenas `consultor_id = auth.uid()`; `master` acesso total.

**Server functions**: `getMeuDia`, `getDashboard(scope)`, `listProspects`, `moverEtapaFunil`, `registrarAtividade`, `criarConsultor` (Master), `desativarConsultor`, `transferirCarteira`, `listEmDelay`, `gerarLinkWhatsapp`, `uploadApolicePdf`, `listApolices`, e stub `analisarApoliceComIA(apolice_id)` que na Fase 1 retorna `{ disponivel: false }` para a UI exibir o aviso.

## Rotas

Públicas: `/auth`, `/reset-password`.

Sob `_authenticated`: `/` Meu Dia · `/dashboard` · `/recomendacoes` · `/hot` · `/calendario` · `/funil` · `/em-delay` · `/atividades` · `/clientes` + `/clientes/$id` · `/apolices` · `/administracao` (Master).

Placeholders "Em breve — Fase 2": Pós-venda avançado, Ciclo de Revisão, Planejamento.

## Layout

Sidebar fixa preta colapsável com logotipo LILITO dourado; header com breadcrumb, busca, sino e avatar (badge dourado se Master); cards escuros com headlines serifadas; estados vazios elegantes.

## Módulos — destaques de UX

- **Meu Dia**: 6 cards (Follow-ups vencidos, Reuniões do dia, HOTs pendentes, Recomendações recebidas, Aniversariantes, Meta semanal 0/3) + faixa dourada "Quem resolve a semana resolve o mês."
- **HOT**: cartão central com 7 botões de resultado; cria atividade + follow-up automático.
- **Funil**: kanban de 8 colunas — **Recomendação → HOT → AB → Análise de Apólice → Fechamento → Implantação → Cliente → Pós-venda**. Drag & drop via dnd-kit, registra atividade ao mover, exibe dias na etapa, PA estimado e consultor.
- **Em Delay**: tabela com filtros + ações Destravar/Reagendar/Adiar/Solicitar ajuda/Marcar perdido (modal de motivo).
- **Análise de Apólices**:
  - Upload PDF drag & drop, agrupamento por seguradora, timeline de status, campos estratégia + observações.
  - **Seção "Análise por IA"** sempre visível no detalhe da apólice, com:
    - Botão dourado `[ ✦ Analisar com IA ]`. Na Fase 1 chama `analisarApoliceComIA` → toast/modal elegante: *"Função disponível na próxima versão."*
    - Badge de `status_analise_ia` (Não analisado / Em processamento / Concluído / Erro).
    - Cards prontos para exibir Resumo executivo, Pontos fortes, Pontos fracos, Observações da IA, Comparativo MetLife — em Fase 1 mostram estado vazio elegante ("Aguardando primeira análise").
    - Timestamp `ultima_analise_ia` e link "Ver histórico de análises" (lista vazia na Fase 1).
  - Fluxo futuro (Fase 1.1) já documentado na arquitetura: extração de seguradora/produto/tipo/capital/prazo/coberturas/exclusões/resgate/doenças graves/invalidez/cirurgias/funeral; resumo executivo; análise consultiva (pontos fortes/fracos, riscos, oportunidades de substituição); comparativo contra proposta MetLife; persistência no histórico.
- **Dashboard**: KPIs (HOTs, ABs, Fechamentos, Clientes, PA emitido, Comissão projetada, Conversão por etapa), ranking, produção por consultor; toggle Individual/Equipe/Unidade (gated por role).
- **Administração (Master)**: CRUD consultores + ativar/desativar + transferência de carteira.

## WhatsApp & PDF

- WhatsApp: `https://wa.me/<telefone>?text=<msg>` em nova aba; registra atividade `whatsapp` automaticamente.
- PDF: bucket privado `apolices-pdf`, path `{consultor_id}/{apolice_id}/{filename}`, download via signed URL (5 min). O mesmo PDF servirá de input para a IA na Fase 1.1.

## Stack técnica

TanStack Start + Query (loader → `ensureQueryData` → `useSuspenseQuery`), shadcn/ui customizado, dnd-kit, date-fns + react-day-picker, zod, framer-motion. Confirmar `attachSupabaseAuth` em `src/start.ts`.

## Fora do escopo da Fase 1

Pós-venda avançado, Ciclo de Revisão, Planejamento anual, integração Google Calendar real, automações complexas, **execução real da IA de apólices** (a arquitetura e a UI já ficam prontas; a chamada ao modelo entra na Fase 1.1 via Lovable AI Gateway com `google/gemini-3-flash-preview`).

## Sequência de implementação

1. Habilitar Lovable Cloud; criar enums (incl. `status_analise_ia`), tabelas (com campos de IA), `apolices_analises_historico`, RLS, GRANTs, trigger de profile, `has_role`, bucket `apolices-pdf`.
2. Design system + shell autenticado (sidebar/header).
3. Auth: `/auth` + `/reset-password` + layout `_authenticated`.
4. Recomendações → HOT → Atividades → Funil (8 colunas) → Em Delay.
5. Calendário interno + Meu Dia + Dashboard com scope por role.
6. Clientes + Análise de Apólices (upload PDF + seção "Análise por IA" com stub e estados vazios).
7. Administração (Master): CRUD consultores + transferência de carteira.
8. Promover Adriana Gomes a `master` via migration após criação do usuário.
9. Placeholders Fase 2 + polish visual final.
