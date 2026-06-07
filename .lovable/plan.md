# CORREÇÃO GLOBAL 01 — Plano

Implementar um **filtro unificado de consultor** que rege todos os módulos, eliminando a necessidade de cada tela ter seu próprio toggle.

## 1. Núcleo compartilhado (novos arquivos)

**`src/hooks/useConsultorScope.ts`**
- Retorna `{ isMaster, consultores, consultorId, setConsultorId, scopeIds }`.
- `consultorId`:
  - Consultor → forçado ao próprio `auth.user.id` (não editável).
  - Master → `null` = Unidade Consolidada, ou um `consultor_id` selecionado.
- Persistência em `localStorage` (`lilito.scope.consultorId`) → seleção do master segue entre módulos.
- `scopeIds`: array de IDs a aplicar nos `.in("consultor_id", …)` (Unidade = todos os consultores ativos; um consultor = `[id]`).

**`src/components/lilito/ConsultorFilter.tsx`**
- Renderiza um `<Select>` no topo da página.
- Master: opções `Unidade (Consolidado)` + lista de consultores ativos.
- Consultor: não renderiza nada (visão fixa).
- Usado em **todos** os módulos abaixo, sempre no mesmo lugar (logo abaixo do `PageHeader`).

## 2. Módulos a atualizar

Para cada um: trocar a lógica atual de filtragem por `useConsultorScope` + montar query com `.in("consultor_id", scopeIds)` (ou `.eq` quando individual). O `queryKey` inclui `consultorId` para invalidar ao trocar.

| Módulo | Arquivo |
|---|---|
| Meu Dia | `index.tsx` |
| Dashboard | `dashboard.tsx` (substitui toggle atual) |
| Recomendações | `recomendacoes.tsx` |
| HOT | `hot.tsx` |
| Funil | `funil.tsx` |
| Calendário | `calendario.tsx` |
| Em Delay | `em-delay.tsx` |
| Onboarding | `onboarding.tsx` |
| Clientes | `clientes.tsx` |
| Apólices | `apolices.tsx` |
| Resultado Semanal | `resultado-semanal.tsx` (substitui toggle atual) |
| Planejamento | `planejamento.tsx` |
| Auditoria | `auditoria.tsx` |
| Atividades | `atividades.tsx` |
| Lembretes | `lembretes.tsx` |
| Pós-Venda | `pos-venda.tsx` |
| Joint | `joint.tsx` (mantém lógica de requests; filtra por escopo) |

## 3. Regras

- **Consultor**: filtro oculto; queries sempre `eq("consultor_id", auth.user.id)`.
- **Master**: filtro visível; padrão = Unidade (consolidado). Ao escolher consultor X, todas queries reagem.
- **Sem duplicação de telas**: mesmo componente serve para os dois perfis.
- **Sem novos módulos**: só patch nos existentes.
- **Visual**: mantém padrão LILITO (Select já existente no design system).

## 4. Fora de escopo

- Schema/migrations — nenhuma alteração no banco.
- Identidade visual.
- Sidebar.
- Lógica interna de cada módulo (apenas a fonte do filtro).

Aprovação para executar?
