# CORREÇÃO GLOBAL 08 — Plano de execução

Vou implementar em **3 frentes coordenadas**, mantendo identidade visual atual da LILITO e usando exclusivamente componentes já existentes (`ScoreStars`, `PageHeader`, `Card`, etc.).

---

## 1. MÓDULO RECOMENDAÇÕES (`src/routes/_authenticated/recomendacoes.tsx`)

### Score / ORN-E
- **Migration**: ajustar trigger `prospects_calc_score()` para garantir score mínimo = 1 (nunca null), e dar peso correto à **profissão médica + renda alta**. Adicionar BEFORE INSERT trigger (hoje só roda em UPDATE provavelmente).
- **Backfill**: rodar UPDATE em todos prospects sem score para recalcular.
- Remover badges numéricos "20/29/15" → substituir por `<ScoreStars score={...} />`.

### Tempo na etapa
- Helper `tempoEtapaCor(dias)` → 🟢 (≤7), 🟡 (8-14), 🔴 (>14).
- Aplicar como bolinha colorida ao lado do "X dias".

### Cabeçalho
- Trocar descrição do `PageHeader` para "Prospects da unidade" (mais curto).

### Recursos adicionais
- Botão "Ranking de Recomendantes" → modal/sheet listando top recomendantes (agregado de `prospects` por `recomendado_por`).
- Toggle "Mostrar perdidos" → filtro extra que inclui `etapa_funil = 'perdido'`.

---

## 2. MÓDULO MEU DIA (`src/routes/_authenticated/index.tsx`)

### Remover da área nobre
- Bloco "Gestão da Unidade" inteiro (Consultores Ativos / Planos Semana / PA Semana / PA Mês / Ranking) — esses indicadores migram para Dashboard.
- Cultura VINCA → rodapé.
- Aniversariantes → rodapé.

### Adicionar (em ordem, área nobre)
1. **Resumo Rápido** (4 cards clicáveis): Follow-ups vencidos, Reuniões hoje, HOTs pendentes, Em Delay.
2. **Botão "Iniciar Ligações"** → link `/hot`.
3. **Desafios do Dia** — bloco simples com checklist em `localStorage` por usuário/dia (sem schema novo). Botão "+" para adicionar.
4. **Minha Agenda** — mini lista da semana (próximos 7 dias) de `agenda_eventos` do usuário + botão "Abrir Calendário Completo".
5. **Follow-ups Vencidos** — lista com nome, telefone, dias de atraso, botões WhatsApp + Calendário.
6. **Reuniões do Dia** — lista de eventos do dia por tipo (AB, Revisita, Fechamento, Entrega, Joint).
7. **Alertas Operacionais** — prospects parados >7d, delays ativos, eventos sem resultado.

### Rodapé
- Aniversariantes + Cultura VINCA.

---

## 3. MÓDULO DASHBOARD (`src/routes/_authenticated/dashboard.tsx`)

Reescrever em **blocos gerenciais**, com toggle Master (Individual/Equipe + filtro consultor):

1. **Produção**: PA Fechado, PA Emitido, Capital Segurado, Comissão Projetada (60% PA emitido).
2. **Funil** (contagem por etapa): Recomendação, HOT, AB, Fechamento, Onboarding, Clientes.
3. **Conversão**: taxas HOT→AB, AB→Fechamento, Fechamento→Onboarding, Onboarding→Cliente.
4. **Equipe** (só Master): ranking por PA, Capital Segurado, Recomendações, Reuniões realizadas — com tabs.
5. **Onboarding**: Propostas em onboarding, PA pendente, Capital pendente.
6. **Delays**: AB, Revisita, Fechamento, Entrega de Apólice (contagem).
7. **Qualidade**: Eventos sem resultado, Delays abandonados (>30d), Recomendações incompletas, Score médio.

---

## 4. ScoreStars aplicado globalmente

Inserir/garantir `<ScoreStars>` em:
- HOT ✅ (já existe)
- Calendário ✅ (já existe)
- Em Delay ✅ (já existe)
- Recomendações 🔧 (substituir números ORN-E)
- Meu Dia 🔧 (em Follow-ups e Reuniões)
- Dashboard 🔧 (no ranking)
- Funil 🔧 (nos cards de prospect)
- Cadastro do Prospect 🔧 (header da modal de detalhe)

---

## Arquivos a editar
1. `supabase/migrations/XXXX_score_fix.sql` — fix trigger + BEFORE INSERT + backfill
2. `src/routes/_authenticated/recomendacoes.tsx`
3. `src/routes/_authenticated/index.tsx` (Meu Dia)
4. `src/routes/_authenticated/dashboard.tsx`
5. `src/routes/_authenticated/funil.tsx` — adicionar ScoreStars nos cards
6. `src/components/lilito/ScoreStars.tsx` — pequeno helper `<TempoEtapa>` se útil

## Fora de escopo (manter como está)
- Sidebar
- Auth
- Schema de outras tabelas
- Identidade visual / tokens de cor

Após sua aprovação, executo migration → atualizo os 3 módulos principais → propago ScoreStars nos demais.