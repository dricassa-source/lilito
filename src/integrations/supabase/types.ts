export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_eventos: {
        Row: {
          cliente_id: string | null
          consultor_id: string
          created_at: string
          delay_em: string | null
          delay_motivo: string | null
          delay_resolvido: boolean
          etapa_origem: string | null
          fim: string
          id: string
          inicio: string
          joint_consultor_id: string | null
          joint_master_id: string | null
          joint_status: Database["public"]["Enums"]["joint_status"]
          local: string | null
          observacao: string | null
          pendencia_tipo: string | null
          prospect_id: string | null
          recorrencia_id: string | null
          resultado: string | null
          status: string
          tipo: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          consultor_id: string
          created_at?: string
          delay_em?: string | null
          delay_motivo?: string | null
          delay_resolvido?: boolean
          etapa_origem?: string | null
          fim: string
          id?: string
          inicio: string
          joint_consultor_id?: string | null
          joint_master_id?: string | null
          joint_status?: Database["public"]["Enums"]["joint_status"]
          local?: string | null
          observacao?: string | null
          pendencia_tipo?: string | null
          prospect_id?: string | null
          recorrencia_id?: string | null
          resultado?: string | null
          status?: string
          tipo: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          consultor_id?: string
          created_at?: string
          delay_em?: string | null
          delay_motivo?: string | null
          delay_resolvido?: boolean
          etapa_origem?: string | null
          fim?: string
          id?: string
          inicio?: string
          joint_consultor_id?: string | null
          joint_master_id?: string | null
          joint_status?: Database["public"]["Enums"]["joint_status"]
          local?: string | null
          observacao?: string | null
          pendencia_tipo?: string | null
          prospect_id?: string | null
          recorrencia_id?: string | null
          resultado?: string | null
          status?: string
          tipo?: Database["public"]["Enums"]["tipo_evento"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_joint_consultor_id_fkey"
            columns: ["joint_consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      apolices: {
        Row: {
          capital_segurado: number | null
          cirurgias: boolean | null
          cliente_id: string | null
          coberturas: Json | null
          comparativo_metlife: Json | null
          consultor_id: string
          created_at: string
          data_emissao: string | null
          data_fechamento: string | null
          doencas_graves: boolean | null
          estrategia_recomendacao: string | null
          exclusoes: Json | null
          funeral: boolean | null
          id: string
          invalidez: boolean | null
          observacoes_consultor: string | null
          observacoes_ia: string | null
          onboarding_observacao: string | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          pdf_path: string | null
          pontos_fortes: Json | null
          pontos_fracos: Json | null
          prazo: string | null
          premio_atual: number | null
          produto: string | null
          prospect_id: string | null
          resgate: boolean | null
          resumo_ia: string | null
          seguradora: Database["public"]["Enums"]["seguradora"]
          status: Database["public"]["Enums"]["status_apolice"]
          status_analise_ia: Database["public"]["Enums"]["status_analise_ia"]
          tipo: Database["public"]["Enums"]["tipo_apolice"] | null
          ultima_analise_ia: string | null
          updated_at: string
        }
        Insert: {
          capital_segurado?: number | null
          cirurgias?: boolean | null
          cliente_id?: string | null
          coberturas?: Json | null
          comparativo_metlife?: Json | null
          consultor_id: string
          created_at?: string
          data_emissao?: string | null
          data_fechamento?: string | null
          doencas_graves?: boolean | null
          estrategia_recomendacao?: string | null
          exclusoes?: Json | null
          funeral?: boolean | null
          id?: string
          invalidez?: boolean | null
          observacoes_consultor?: string | null
          observacoes_ia?: string | null
          onboarding_observacao?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          pdf_path?: string | null
          pontos_fortes?: Json | null
          pontos_fracos?: Json | null
          prazo?: string | null
          premio_atual?: number | null
          produto?: string | null
          prospect_id?: string | null
          resgate?: boolean | null
          resumo_ia?: string | null
          seguradora?: Database["public"]["Enums"]["seguradora"]
          status?: Database["public"]["Enums"]["status_apolice"]
          status_analise_ia?: Database["public"]["Enums"]["status_analise_ia"]
          tipo?: Database["public"]["Enums"]["tipo_apolice"] | null
          ultima_analise_ia?: string | null
          updated_at?: string
        }
        Update: {
          capital_segurado?: number | null
          cirurgias?: boolean | null
          cliente_id?: string | null
          coberturas?: Json | null
          comparativo_metlife?: Json | null
          consultor_id?: string
          created_at?: string
          data_emissao?: string | null
          data_fechamento?: string | null
          doencas_graves?: boolean | null
          estrategia_recomendacao?: string | null
          exclusoes?: Json | null
          funeral?: boolean | null
          id?: string
          invalidez?: boolean | null
          observacoes_consultor?: string | null
          observacoes_ia?: string | null
          onboarding_observacao?: string | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          pdf_path?: string | null
          pontos_fortes?: Json | null
          pontos_fracos?: Json | null
          prazo?: string | null
          premio_atual?: number | null
          produto?: string | null
          prospect_id?: string | null
          resgate?: boolean | null
          resumo_ia?: string | null
          seguradora?: Database["public"]["Enums"]["seguradora"]
          status?: Database["public"]["Enums"]["status_apolice"]
          status_analise_ia?: Database["public"]["Enums"]["status_analise_ia"]
          tipo?: Database["public"]["Enums"]["tipo_apolice"] | null
          ultima_analise_ia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      apolices_analises_historico: {
        Row: {
          apolice_id: string
          consultor_id: string
          created_at: string
          id: string
          modelo: string | null
          payload: Json
        }
        Insert: {
          apolice_id: string
          consultor_id: string
          created_at?: string
          id?: string
          modelo?: string | null
          payload: Json
        }
        Update: {
          apolice_id?: string
          consultor_id?: string
          created_at?: string
          id?: string
          modelo?: string | null
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "apolices_analises_historico_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          cliente_id: string | null
          consultor_id: string
          created_at: string
          follow_up_em: string | null
          id: string
          observacao: string | null
          prospect_id: string | null
          resultado: string | null
          tipo: Database["public"]["Enums"]["tipo_atividade"]
        }
        Insert: {
          cliente_id?: string | null
          consultor_id: string
          created_at?: string
          follow_up_em?: string | null
          id?: string
          observacao?: string | null
          prospect_id?: string | null
          resultado?: string | null
          tipo: Database["public"]["Enums"]["tipo_atividade"]
        }
        Update: {
          cliente_id?: string | null
          consultor_id?: string
          created_at?: string
          follow_up_em?: string | null
          id?: string
          observacao?: string | null
          prospect_id?: string | null
          resultado?: string | null
          tipo?: Database["public"]["Enums"]["tipo_atividade"]
        }
        Relationships: [
          {
            foreignKeyName: "atividades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          capital_segurado: number | null
          consultor_id: string
          created_at: string
          email: string | null
          familia: string | null
          id: string
          nome: string
          pa_total: number | null
          prospect_id: string | null
          proxima_revisao: string | null
          telefone: string | null
          ultima_revisao: string | null
          updated_at: string
        }
        Insert: {
          capital_segurado?: number | null
          consultor_id: string
          created_at?: string
          email?: string | null
          familia?: string | null
          id?: string
          nome: string
          pa_total?: number | null
          prospect_id?: string | null
          proxima_revisao?: string | null
          telefone?: string | null
          ultima_revisao?: string | null
          updated_at?: string
        }
        Update: {
          capital_segurado?: number | null
          consultor_id?: string
          created_at?: string
          email?: string | null
          familia?: string | null
          id?: string
          nome?: string
          pa_total?: number | null
          prospect_id?: string | null
          proxima_revisao?: string | null
          telefone?: string | null
          ultima_revisao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      compromissos_recorrentes: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string
          data_final: string | null
          data_inicial: string
          excecoes: string[]
          frequencia: string
          hora_fim: string
          hora_inicio: string
          id: string
          participantes: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por: string
          data_final?: string | null
          data_inicial: string
          excecoes?: string[]
          frequencia: string
          hora_fim: string
          hora_inicio: string
          id?: string
          participantes?: string[]
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string
          data_final?: string | null
          data_inicial?: string
          excecoes?: string[]
          frequencia?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          participantes?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromissos_recorrentes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_por: string | null
          chave: string
          created_at: string
          updated_at: string
          valor: Json
        }
        Insert: {
          atualizado_por?: string | null
          chave: string
          created_at?: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          atualizado_por?: string | null
          chave?: string
          created_at?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      frases_cultura: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      hot_lista_prospects: {
        Row: {
          created_at: string
          id: string
          lista_id: string
          prospect_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lista_id: string
          prospect_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lista_id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_lista_prospects_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "hot_listas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_lista_prospects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_listas: {
        Row: {
          consultor_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      joint_requests: {
        Row: {
          consultor_id: string
          created_at: string
          decided_at: string | null
          evento_id: string
          id: string
          master_id: string | null
          observacao: string | null
          status: Database["public"]["Enums"]["joint_status"]
          updated_at: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          decided_at?: string | null
          evento_id: string
          id?: string
          master_id?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["joint_status"]
          updated_at?: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          decided_at?: string | null
          evento_id?: string
          id?: string
          master_id?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["joint_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "joint_requests_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          consultor_id: string
          created_at: string
          data: string
          hora: string | null
          id: string
          observacao: string | null
          prospect_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          consultor_id: string
          created_at?: string
          data: string
          hora?: string | null
          id?: string
          observacao?: string | null
          prospect_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          consultor_id?: string
          created_at?: string
          data?: string
          hora?: string | null
          id?: string
          observacao?: string | null
          prospect_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          ano: number
          consultor_id: string | null
          created_at: string
          id: string
          mes: number | null
          meta_apolices: number
          meta_pa: number
          periodo: Database["public"]["Enums"]["meta_periodo"]
          updated_at: string
        }
        Insert: {
          ano: number
          consultor_id?: string | null
          created_at?: string
          id?: string
          mes?: number | null
          meta_apolices?: number
          meta_pa?: number
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          updated_at?: string
        }
        Update: {
          ano?: number
          consultor_id?: string | null
          created_at?: string
          id?: string
          mes?: number | null
          meta_apolices?: number
          meta_pa?: number
          periodo?: Database["public"]["Enums"]["meta_periodo"]
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          payload: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          payload?: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          payload?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          email: string
          id: string
          nome?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          cidade: string | null
          conjuge: string | null
          consultor_id: string
          created_at: string
          data_nascimento: string | null
          data_nascimento_conjuge: string | null
          email: string | null
          entrou_etapa_em: string
          especialidade_medica: string | null
          estado_civil: string | null
          etapa_funil: Database["public"]["Enums"]["etapa_funil"]
          filhos: number | null
          id: string
          motivo_perda: string | null
          nome: string
          nota_qualificacao: number | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_prospect"] | null
          pa_estimado: number | null
          patrimonio_estimado: number | null
          profissao_conjuge: string | null
          quem_recomendou: string | null
          renda_estimada: number | null
          score: number | null
          score_influencia: number | null
          score_necessidade: number | null
          score_patrimonio: number | null
          score_renda: number | null
          status_hot: Database["public"]["Enums"]["status_hot"] | null
          telefone: string | null
          telefone_conjuge: string | null
          ultima_interacao: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          conjuge?: string | null
          consultor_id: string
          created_at?: string
          data_nascimento?: string | null
          data_nascimento_conjuge?: string | null
          email?: string | null
          entrou_etapa_em?: string
          especialidade_medica?: string | null
          estado_civil?: string | null
          etapa_funil?: Database["public"]["Enums"]["etapa_funil"]
          filhos?: number | null
          id?: string
          motivo_perda?: string | null
          nome: string
          nota_qualificacao?: number | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_prospect"] | null
          pa_estimado?: number | null
          patrimonio_estimado?: number | null
          profissao_conjuge?: string | null
          quem_recomendou?: string | null
          renda_estimada?: number | null
          score?: number | null
          score_influencia?: number | null
          score_necessidade?: number | null
          score_patrimonio?: number | null
          score_renda?: number | null
          status_hot?: Database["public"]["Enums"]["status_hot"] | null
          telefone?: string | null
          telefone_conjuge?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          conjuge?: string | null
          consultor_id?: string
          created_at?: string
          data_nascimento?: string | null
          data_nascimento_conjuge?: string | null
          email?: string | null
          entrou_etapa_em?: string
          especialidade_medica?: string | null
          estado_civil?: string | null
          etapa_funil?: Database["public"]["Enums"]["etapa_funil"]
          filhos?: number | null
          id?: string
          motivo_perda?: string | null
          nome?: string
          nota_qualificacao?: number | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_prospect"] | null
          pa_estimado?: number | null
          patrimonio_estimado?: number | null
          profissao_conjuge?: string | null
          quem_recomendou?: string | null
          renda_estimada?: number | null
          score?: number | null
          score_influencia?: number | null
          score_necessidade?: number | null
          score_patrimonio?: number | null
          score_renda?: number | null
          status_hot?: Database["public"]["Enums"]["status_hot"] | null
          telefone?: string | null
          telefone_conjuge?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_orphans: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      reset_homologacao: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "master" | "consultor"
      etapa_funil:
        | "recomendacao"
        | "hot"
        | "ab"
        | "analise_apolice"
        | "fechamento"
        | "implantacao"
        | "cliente"
        | "pos_venda"
        | "perdido"
        | "revisita"
        | "entrega_apolice"
      joint_status:
        | "nenhum"
        | "pendente"
        | "aprovado"
        | "rejeitado"
        | "confirmado"
      meta_periodo: "mensal" | "trimestral" | "anual"
      onboarding_status:
        | "nao_aplicavel"
        | "documentacao_pendente"
        | "exames_pendentes"
        | "entrevista_pendente"
        | "pagamento_pendente"
        | "em_underwriting"
        | "outras_pendencias"
        | "emitida"
      origem_prospect:
        | "recomendacao"
        | "prospeccao_ativa"
        | "hospital"
        | "evento"
        | "redes_sociais"
        | "parceria"
        | "reativacao"
      seguradora:
        | "metlife"
        | "prudential"
        | "icatu"
        | "mag"
        | "bradesco"
        | "sulamerica"
        | "porto"
        | "azos"
        | "outra"
      status_analise_ia:
        | "nao_analisado"
        | "em_processamento"
        | "concluido"
        | "erro"
      status_apolice:
        | "em_analise"
        | "apresentado"
        | "em_negociacao"
        | "migrado"
        | "nao_migrado"
      status_hot:
        | "pendente"
        | "agendou"
        | "pensando"
        | "ligar_depois"
        | "nao_atendeu"
        | "sem_interesse"
      tipo_apolice: "whole_life" | "temporario"
      tipo_atividade:
        | "ligacao"
        | "whatsapp"
        | "agendamento"
        | "ab"
        | "fechamento"
        | "revisita"
        | "joint_work"
        | "analise_apolice"
        | "review"
        | "recomendacao"
        | "entrega_apolice"
      tipo_evento:
        | "ab"
        | "fechamento"
        | "revisita"
        | "joint_work"
        | "review"
        | "entrega_apolice"
        | "pessoal"
        | "treinamento"
        | "reuniao_agencia"
        | "bloqueio"
        | "lembrete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "consultor"],
      etapa_funil: [
        "recomendacao",
        "hot",
        "ab",
        "analise_apolice",
        "fechamento",
        "implantacao",
        "cliente",
        "pos_venda",
        "perdido",
        "revisita",
        "entrega_apolice",
      ],
      joint_status: [
        "nenhum",
        "pendente",
        "aprovado",
        "rejeitado",
        "confirmado",
      ],
      meta_periodo: ["mensal", "trimestral", "anual"],
      onboarding_status: [
        "nao_aplicavel",
        "documentacao_pendente",
        "exames_pendentes",
        "entrevista_pendente",
        "pagamento_pendente",
        "em_underwriting",
        "outras_pendencias",
        "emitida",
      ],
      origem_prospect: [
        "recomendacao",
        "prospeccao_ativa",
        "hospital",
        "evento",
        "redes_sociais",
        "parceria",
        "reativacao",
      ],
      seguradora: [
        "metlife",
        "prudential",
        "icatu",
        "mag",
        "bradesco",
        "sulamerica",
        "porto",
        "azos",
        "outra",
      ],
      status_analise_ia: [
        "nao_analisado",
        "em_processamento",
        "concluido",
        "erro",
      ],
      status_apolice: [
        "em_analise",
        "apresentado",
        "em_negociacao",
        "migrado",
        "nao_migrado",
      ],
      status_hot: [
        "pendente",
        "agendou",
        "pensando",
        "ligar_depois",
        "nao_atendeu",
        "sem_interesse",
      ],
      tipo_apolice: ["whole_life", "temporario"],
      tipo_atividade: [
        "ligacao",
        "whatsapp",
        "agendamento",
        "ab",
        "fechamento",
        "revisita",
        "joint_work",
        "analise_apolice",
        "review",
        "recomendacao",
        "entrega_apolice",
      ],
      tipo_evento: [
        "ab",
        "fechamento",
        "revisita",
        "joint_work",
        "review",
        "entrega_apolice",
        "pessoal",
        "treinamento",
        "reuniao_agencia",
        "bloqueio",
        "lembrete",
      ],
    },
  },
} as const
