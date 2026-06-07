
# Correção Global 02 — Plano de Implementação

Sem reconstruir módulos. Apenas ajustes cirúrgicos preservando o layout atual.

## 1. Mudanças de Schema (migration única)

Tabela `agenda_eventos`:
- `delay_motivo TEXT` (null)
- `delay_em TIMESTAMPTZ` (null)
- `delay_resolvido BOOLEAN DEFAULT false`
- `etapa_origem TEXT` (snapshot da etapa do prospect no momento do delay)
- `joint_consultor_id UUID REFERENCES profiles(id)` (null)
- `recorrencia_id UUID` (null — agrupa instâncias de um recorrente)

Tabela nova `compromissos_recorrentes`:
- `id, titulo, tipo (reuniao_unidade|treinamento|rote|ab_fone|outro)`
- `data_inicial DATE, hora_inicio TIME, hora_fim TIME`
- `frequencia (semanal|quinzenal|mensal)`
- `participantes UUID[]` (profiles)
- `criado_por, created_at, updated_at`
- RLS: master cria/edita; participantes leem.

Tabela `prospects`:
- `score SMALLINT` (1–5, calculado)
- Função `calcular_score(profissao, renda, patrimonio, tem_recomendacoes BOOL)` retornando 1–5.
- Trigger BEFORE INSERT/UPDATE atualiza `score` automaticamente.

Tabela nova (opcional) `unidades` — somente se hoje não existir referência; caso já exista campo `unidade` em profiles, reuso. **Vou verificar antes** e usar o que existir; se nada existir, adiciono `profiles.unidade TEXT`.

## 2. Calendário (`calendario.tsx`)

- Remover botão **No Show**. "No Show" vira motivo de Delay.
- Botão **Marcar Delay** abre modal exigindo motivo (select com 6 opções + textarea quando "Outro").
- Ao salvar Delay: grava `delay_motivo`, `delay_em`, `etapa_origem = prospects.etapa_funil`, registra `atividades`. Evento permanece visível.
- Visual: evento em delay ganha `border-2 border-red-500` + 🚩 vermelha no canto. Cor da etapa preservada.
- Quando `delay_resolvido = true`: bandeira some, borda vermelha **permanece** (histórico/auditoria).
- Remover tipo "Joint Work". Tipos: AB, Revisita, Fechamento, Entrega de Apólice.
- Checkbox **É Joint Work?** + select `joint_consultor_id` (consultores ativos).
- Novo botão **🔁 Compromisso Recorrente** abrindo modal próprio (independente de Bloquear/Lembrete/Agendamento).
- Renderizar instâncias de recorrentes calculadas em runtime a partir de `compromissos_recorrentes` para a semana visível.
- Exibir score ⭐ N junto ao nome do prospect.
- Lembretes: badge 🔔 discreto no topo da célula do dia (já existe; só ajustar ícone).

## 3. Em Delay (`em-delay.tsx`)

- Fila lê de `agenda_eventos` onde `delay_resolvido = false` e `etapa_origem IN (ab, revisita, fechamento, entrega_apolice)` — **exclui Onboarding**.
- Colunas: Nome, Etapa origem, Motivo, Consultor, Dias parado, Próxima ação.
- Ações: Reagendar (cria novo evento + marca atual como resolvido), Adiar 7 dias, Ligar (tel:), WhatsApp (wa.me), Marcar Perdido.
- "Destravar Agora" remove da fila (resolvido=true) mas mantém evento original com borda vermelha. Reagendar cria novo `agenda_eventos`.

## 4. Score automático

- Trigger SQL calcula a partir de: `profissao` (lista de pesos), `renda_estimada`, `patrimonio`, flag tem recomendações (count de prospects com `recomendado_por = id`).
- Exibir como **⭐ N** (uma estrela + número), nunca múltiplas estrelas, em: Recomendações, HOT, Calendário, Funil, Em Delay.

## 5. HOT

- Ordenar `ORDER BY score DESC NULLS LAST, created_at DESC`.

## 6. Visão Master — filtro global

Componente novo `<MasterScopeFilter>` no topo das páginas listadas, persistido em `localStorage` (`lilito:scope`):
- Selects: **Unidade** + **Consultor**.
- Hook `useMasterScope()` retorna `{ unidade, consultorId }` e expõe helper `applyScope(query)` que adiciona `.eq("consultor_id", x)` / join por unidade.
- Aplicar em: Dashboard, Recomendações, HOT, Calendário, Funil, Em Delay, Onboarding, Clientes, Resultado Semanal, Planejamento, Auditoria.
- Apenas visível para master (`auth.isMaster`).

## 7. Compromissos Recorrentes

- Novo modal no Calendário com campos da especificação.
- Geração das ocorrências em runtime na semana atual (sem materializar) — performático e evita duplicação.
- Aparece em todos os calendários dos `participantes`.

## Arquivos a editar/criar

**Editar:**
- `src/routes/_authenticated/calendario.tsx`
- `src/routes/_authenticated/em-delay.tsx`
- `src/routes/_authenticated/hot.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/routes/_authenticated/recomendacoes.tsx`
- `src/routes/_authenticated/funil.tsx`
- `src/routes/_authenticated/onboarding.tsx`
- `src/routes/_authenticated/clientes.tsx`
- `src/routes/_authenticated/resultado-semanal.tsx`
- `src/routes/_authenticated/planejamento.tsx`
- `src/routes/_authenticated/auditoria.tsx`

**Criar:**
- `src/components/lilito/MasterScopeFilter.tsx`
- `src/hooks/useMasterScope.ts`
- `src/components/lilito/ScoreStars.tsx`
- `src/components/lilito/RecorrenteModal.tsx`

**Migration:** uma única, contendo todas as alterações de schema + trigger de score + RLS de `compromissos_recorrentes`.

## Ordem de execução

1. Migration (aprovação sua) → regen tipos.
2. Componentes utilitários (ScoreStars, MasterScopeFilter, useMasterScope).
3. Calendário (delay + joint + recorrentes + remover No Show).
4. Em Delay (nova fonte de dados a partir de agenda_eventos).
5. HOT (ordenação).
6. Espalhar score + scope filter pelos demais módulos.

## Pontos de atenção

- **Onboarding fora do Delay** — confirmado, não criar fila para essa etapa.
- Recorrentes não entram em conflito de agenda (só compromissos reais bloqueiam).
- Borda vermelha permanente em delays resolvidos é intencional (auditoria) — não é bug.
- Score é recalculado por trigger; não cachear no front.

Posso prosseguir com a migration?
