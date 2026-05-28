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
      artigos: {
        Row: {
          autor_id: string | null
          capa_url: string | null
          categoria: string
          conteudo_md: string
          created_at: string
          dificuldade: string | null
          fontes_usadas: string[]
          id: string
          notas_internas: string | null
          publicado_em: string | null
          publico: boolean
          resumo: string | null
          slug: string
          tempo_estimado_min: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string
          conteudo_md?: string
          created_at?: string
          dificuldade?: string | null
          fontes_usadas?: string[]
          id?: string
          notas_internas?: string | null
          publicado_em?: string | null
          publico?: boolean
          resumo?: string | null
          slug: string
          tempo_estimado_min?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string
          conteudo_md?: string
          created_at?: string
          dificuldade?: string | null
          fontes_usadas?: string[]
          id?: string
          notas_internas?: string | null
          publicado_em?: string | null
          publico?: boolean
          resumo?: string | null
          slug?: string
          tempo_estimado_min?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      camara_deputados_cache: {
        Row: {
          condicao_eleitoral: string | null
          email: string | null
          id: number
          id_legislatura: number | null
          nome: string
          nome_civil: string | null
          sigla_partido: string | null
          sigla_uf: string | null
          situacao: string | null
          updated_at: string
          url_foto: string | null
        }
        Insert: {
          condicao_eleitoral?: string | null
          email?: string | null
          id: number
          id_legislatura?: number | null
          nome: string
          nome_civil?: string | null
          sigla_partido?: string | null
          sigla_uf?: string | null
          situacao?: string | null
          updated_at?: string
          url_foto?: string | null
        }
        Update: {
          condicao_eleitoral?: string | null
          email?: string | null
          id?: number
          id_legislatura?: number | null
          nome?: string
          nome_civil?: string | null
          sigla_partido?: string | null
          sigla_uf?: string | null
          situacao?: string | null
          updated_at?: string
          url_foto?: string | null
        }
        Relationships: []
      }
      camara_despesas_cache: {
        Row: {
          ano: number
          cod_documento: number | null
          data_documento: string | null
          deputado_id: number
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          mes: number
          num_documento: string | null
          tipo_despesa: string | null
          tipo_documento: string | null
          updated_at: string
          url_documento: string | null
          valor_documento: number
          valor_glosa: number
          valor_liquido: number
        }
        Insert: {
          ano: number
          cod_documento?: number | null
          data_documento?: string | null
          deputado_id: number
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id: string
          mes: number
          num_documento?: string | null
          tipo_despesa?: string | null
          tipo_documento?: string | null
          updated_at?: string
          url_documento?: string | null
          valor_documento?: number
          valor_glosa?: number
          valor_liquido?: number
        }
        Update: {
          ano?: number
          cod_documento?: number | null
          data_documento?: string | null
          deputado_id?: number
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          mes?: number
          num_documento?: string | null
          tipo_despesa?: string | null
          tipo_documento?: string | null
          updated_at?: string
          url_documento?: string | null
          valor_documento?: number
          valor_glosa?: number
          valor_liquido?: number
        }
        Relationships: []
      }
      camara_proposicoes_autores_cache: {
        Row: {
          deputado_id: number | null
          nome: string
          ordem_assinatura: number | null
          proponente: boolean
          proposicao_id: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          deputado_id?: number | null
          nome: string
          ordem_assinatura?: number | null
          proponente?: boolean
          proposicao_id: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          deputado_id?: number | null
          nome?: string
          ordem_assinatura?: number | null
          proponente?: boolean
          proposicao_id?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      camara_proposicoes_cache: {
        Row: {
          ano: number
          cod_tipo: number | null
          data_apresentacao: string | null
          descricao_tipo: string | null
          ementa: string | null
          ementa_detalhada: string | null
          id: number
          keywords: string | null
          numero: number
          sigla_tipo: string
          ultimo_status_data: string | null
          ultimo_status_descricao: string | null
          ultimo_status_despacho: string | null
          ultimo_status_orgao_sigla: string | null
          ultimo_status_situacao: string | null
          updated_at: string
          url_inteiro_teor: string | null
        }
        Insert: {
          ano: number
          cod_tipo?: number | null
          data_apresentacao?: string | null
          descricao_tipo?: string | null
          ementa?: string | null
          ementa_detalhada?: string | null
          id: number
          keywords?: string | null
          numero: number
          sigla_tipo: string
          ultimo_status_data?: string | null
          ultimo_status_descricao?: string | null
          ultimo_status_despacho?: string | null
          ultimo_status_orgao_sigla?: string | null
          ultimo_status_situacao?: string | null
          updated_at?: string
          url_inteiro_teor?: string | null
        }
        Update: {
          ano?: number
          cod_tipo?: number | null
          data_apresentacao?: string | null
          descricao_tipo?: string | null
          ementa?: string | null
          ementa_detalhada?: string | null
          id?: number
          keywords?: string | null
          numero?: number
          sigla_tipo?: string
          ultimo_status_data?: string | null
          ultimo_status_descricao?: string | null
          ultimo_status_despacho?: string | null
          ultimo_status_orgao_sigla?: string | null
          ultimo_status_situacao?: string | null
          updated_at?: string
          url_inteiro_teor?: string | null
        }
        Relationships: []
      }
      camara_votacoes_cache: {
        Row: {
          aprovacao: number | null
          data: string | null
          data_hora_registro: string | null
          descricao: string | null
          descricao_resultado: string | null
          id: string
          proposicao_id: number | null
          proposicao_titulo: string | null
          sigla_orgao: string | null
          updated_at: string
          votos_nao: number
          votos_outros: number
          votos_sim: number
        }
        Insert: {
          aprovacao?: number | null
          data?: string | null
          data_hora_registro?: string | null
          descricao?: string | null
          descricao_resultado?: string | null
          id: string
          proposicao_id?: number | null
          proposicao_titulo?: string | null
          sigla_orgao?: string | null
          updated_at?: string
          votos_nao?: number
          votos_outros?: number
          votos_sim?: number
        }
        Update: {
          aprovacao?: number | null
          data?: string | null
          data_hora_registro?: string | null
          descricao?: string | null
          descricao_resultado?: string | null
          id?: string
          proposicao_id?: number | null
          proposicao_titulo?: string | null
          sigla_orgao?: string | null
          updated_at?: string
          votos_nao?: number
          votos_outros?: number
          votos_sim?: number
        }
        Relationships: []
      }
      camara_votos_cache: {
        Row: {
          deputado_id: number
          sigla_partido: string | null
          sigla_uf: string | null
          tipo_voto: string
          updated_at: string
          votacao_id: string
        }
        Insert: {
          deputado_id: number
          sigla_partido?: string | null
          sigla_uf?: string | null
          tipo_voto: string
          updated_at?: string
          votacao_id: string
        }
        Update: {
          deputado_id?: number
          sigla_partido?: string | null
          sigla_uf?: string | null
          tipo_voto?: string
          updated_at?: string
          votacao_id?: string
        }
        Relationships: []
      }
      contestacoes: {
        Row: {
          contato: string | null
          created_at: string
          descricao: string
          fundamento: string | null
          id: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          solicitante_tipo: string
          status: string
          tipo: string
          updated_at: string
          url_pagina: string
          user_id: string | null
        }
        Insert: {
          contato?: string | null
          created_at?: string
          descricao: string
          fundamento?: string | null
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          solicitante_tipo: string
          status?: string
          tipo: string
          updated_at?: string
          url_pagina: string
          user_id?: string | null
        }
        Update: {
          contato?: string | null
          created_at?: string
          descricao?: string
          fundamento?: string | null
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          solicitante_tipo?: string
          status?: string
          tipo?: string
          updated_at?: string
          url_pagina?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contratos_cache: {
        Row: {
          ano: number
          data_assinatura: string | null
          fornecedor_cnpj: string
          id: string
          mes_referencia: number | null
          modalidade: string
          objeto: string
          orgao_cod: string
          updated_at: string
          valor: number
          valor_inicial: number | null
        }
        Insert: {
          ano: number
          data_assinatura?: string | null
          fornecedor_cnpj: string
          id: string
          mes_referencia?: number | null
          modalidade: string
          objeto: string
          orgao_cod: string
          updated_at?: string
          valor?: number
          valor_inicial?: number | null
        }
        Update: {
          ano?: number
          data_assinatura?: string | null
          fornecedor_cnpj?: string
          id?: string
          mes_referencia?: number | null
          modalidade?: string
          objeto?: string
          orgao_cod?: string
          updated_at?: string
          valor?: number
          valor_inicial?: number | null
        }
        Relationships: []
      }
      fornecedores_cache: {
        Row: {
          cnpj: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          ano: number | null
          consultado_em: string
          data_final: string | null
          data_inicial: string | null
          endpoint: string | null
          erros: Json
          escopo: string
          fonte: string
          id: string
          importados: number
          mes: number | null
          orgao_cod: string | null
          total_bruto: number
          user_id: string | null
        }
        Insert: {
          ano?: number | null
          consultado_em?: string
          data_final?: string | null
          data_inicial?: string | null
          endpoint?: string | null
          erros?: Json
          escopo?: string
          fonte?: string
          id?: string
          importados?: number
          mes?: number | null
          orgao_cod?: string | null
          total_bruto?: number
          user_id?: string | null
        }
        Update: {
          ano?: number | null
          consultado_em?: string
          data_final?: string | null
          data_inicial?: string | null
          endpoint?: string | null
          erros?: Json
          escopo?: string
          fonte?: string
          id?: string
          importados?: number
          mes?: number | null
          orgao_cod?: string | null
          total_bruto?: number
          user_id?: string | null
        }
        Relationships: []
      }
      orgaos_cache: {
        Row: {
          cod: string
          disponivel_portal: boolean
          funcao: string
          nome: string
          nota: string | null
          poder: string
          sigla: string
          updated_at: string
        }
        Insert: {
          cod: string
          disponivel_portal?: boolean
          funcao: string
          nome: string
          nota?: string | null
          poder: string
          sigla: string
          updated_at?: string
        }
        Update: {
          cod?: string
          disponivel_portal?: boolean
          funcao?: string
          nome?: string
          nota?: string | null
          poder?: string
          sigla?: string
          updated_at?: string
        }
        Relationships: []
      }
      pncp_contratos_cache: {
        Row: {
          ano: number
          data_assinatura: string | null
          data_vigencia_fim: string | null
          data_vigencia_inicio: string | null
          esfera: string | null
          fornecedor_cnpj_cpf: string | null
          fornecedor_nome: string | null
          id: string
          modalidade: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_contrato: string | null
          numero_controle_pncp: string
          objeto: string | null
          orgao_cnpj: string
          orgao_nome: string
          poder: string | null
          situacao: string | null
          uf: string | null
          updated_at: string
          url_pncp: string | null
          valor_global: number | null
          valor_inicial: number | null
        }
        Insert: {
          ano: number
          data_assinatura?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          esfera?: string | null
          fornecedor_cnpj_cpf?: string | null
          fornecedor_nome?: string | null
          id: string
          modalidade?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_contrato?: string | null
          numero_controle_pncp: string
          objeto?: string | null
          orgao_cnpj: string
          orgao_nome: string
          poder?: string | null
          situacao?: string | null
          uf?: string | null
          updated_at?: string
          url_pncp?: string | null
          valor_global?: number | null
          valor_inicial?: number | null
        }
        Update: {
          ano?: number
          data_assinatura?: string | null
          data_vigencia_fim?: string | null
          data_vigencia_inicio?: string | null
          esfera?: string | null
          fornecedor_cnpj_cpf?: string | null
          fornecedor_nome?: string | null
          id?: string
          modalidade?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_contrato?: string | null
          numero_controle_pncp?: string
          objeto?: string | null
          orgao_cnpj?: string
          orgao_nome?: string
          poder?: string | null
          situacao?: string | null
          uf?: string | null
          updated_at?: string
          url_pncp?: string | null
          valor_global?: number | null
          valor_inicial?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      qa_findings: {
        Row: {
          detalhes: Json
          detectado_em: string
          entidade_id: string
          entidade_tipo: string
          fonte: string
          id: string
          notas_admin: string | null
          origem: string
          regra: string
          reportado_em: string | null
          reporte_canal: string | null
          reporte_protocolo: string | null
          resolvido_em: string | null
          revalidado_em: string | null
          severidade: string
          status: string
          updated_at: string
          valor_armazenado: number | null
          valor_esperado: number | null
        }
        Insert: {
          detalhes?: Json
          detectado_em?: string
          entidade_id: string
          entidade_tipo: string
          fonte: string
          id?: string
          notas_admin?: string | null
          origem?: string
          regra: string
          reportado_em?: string | null
          reporte_canal?: string | null
          reporte_protocolo?: string | null
          resolvido_em?: string | null
          revalidado_em?: string | null
          severidade?: string
          status?: string
          updated_at?: string
          valor_armazenado?: number | null
          valor_esperado?: number | null
        }
        Update: {
          detalhes?: Json
          detectado_em?: string
          entidade_id?: string
          entidade_tipo?: string
          fonte?: string
          id?: string
          notas_admin?: string | null
          origem?: string
          regra?: string
          reportado_em?: string | null
          reporte_canal?: string | null
          reporte_protocolo?: string | null
          resolvido_em?: string | null
          revalidado_em?: string | null
          severidade?: string
          status?: string
          updated_at?: string
          valor_armazenado?: number | null
          valor_esperado?: number | null
        }
        Relationships: []
      }
      roadmap_itens: {
        Row: {
          concluido_em: string | null
          created_at: string
          descricao: string | null
          id: string
          notas: string | null
          ordem: number
          publico: boolean
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          notas?: string | null
          ordem?: number
          publico?: boolean
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          notas?: string | null
          ordem?: number
          publico?: boolean
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      senado_despesas_cache: {
        Row: {
          ano: number
          data_documento: string | null
          detalhamento: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          mes: number
          num_documento: string | null
          senador_id: number
          tipo_despesa: string | null
          updated_at: string
          valor_reembolsado: number
        }
        Insert: {
          ano: number
          data_documento?: string | null
          detalhamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id: string
          mes: number
          num_documento?: string | null
          senador_id: number
          tipo_despesa?: string | null
          updated_at?: string
          valor_reembolsado?: number
        }
        Update: {
          ano?: number
          data_documento?: string | null
          detalhamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          mes?: number
          num_documento?: string | null
          senador_id?: number
          tipo_despesa?: string | null
          updated_at?: string
          valor_reembolsado?: number
        }
        Relationships: []
      }
      senado_materias_autores_cache: {
        Row: {
          materia_id: number
          nome: string
          ordem: number | null
          proponente: boolean
          senador_id: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          materia_id: number
          nome: string
          ordem?: number | null
          proponente?: boolean
          senador_id?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          materia_id?: number
          nome?: string
          ordem?: number | null
          proponente?: boolean
          senador_id?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      senado_materias_cache: {
        Row: {
          ano: number
          autor_principal: string | null
          data_apresentacao: string | null
          ementa: string | null
          id: number
          numero: number
          sigla_subtipo: string
          ultima_data: string | null
          ultima_situacao: string | null
          updated_at: string
          url_texto: string | null
        }
        Insert: {
          ano: number
          autor_principal?: string | null
          data_apresentacao?: string | null
          ementa?: string | null
          id: number
          numero: number
          sigla_subtipo: string
          ultima_data?: string | null
          ultima_situacao?: string | null
          updated_at?: string
          url_texto?: string | null
        }
        Update: {
          ano?: number
          autor_principal?: string | null
          data_apresentacao?: string | null
          ementa?: string | null
          id?: number
          numero?: number
          sigla_subtipo?: string
          ultima_data?: string | null
          ultima_situacao?: string | null
          updated_at?: string
          url_texto?: string | null
        }
        Relationships: []
      }
      senado_senadores_cache: {
        Row: {
          codigo_parlamentar: number
          email: string | null
          id: number
          nome: string
          nome_completo: string | null
          sigla_partido: string | null
          sigla_uf: string | null
          situacao: string | null
          updated_at: string
          url_foto: string | null
        }
        Insert: {
          codigo_parlamentar: number
          email?: string | null
          id: number
          nome: string
          nome_completo?: string | null
          sigla_partido?: string | null
          sigla_uf?: string | null
          situacao?: string | null
          updated_at?: string
          url_foto?: string | null
        }
        Update: {
          codigo_parlamentar?: number
          email?: string | null
          id?: number
          nome?: string
          nome_completo?: string | null
          sigla_partido?: string | null
          sigla_uf?: string | null
          situacao?: string | null
          updated_at?: string
          url_foto?: string | null
        }
        Relationships: []
      }
      senado_votacoes_cache: {
        Row: {
          data: string | null
          descricao: string | null
          id: string
          materia_id: number | null
          materia_titulo: string | null
          resultado: string | null
          sigla_orgao: string | null
          updated_at: string
          votos_nao: number
          votos_outros: number
          votos_sim: number
        }
        Insert: {
          data?: string | null
          descricao?: string | null
          id: string
          materia_id?: number | null
          materia_titulo?: string | null
          resultado?: string | null
          sigla_orgao?: string | null
          updated_at?: string
          votos_nao?: number
          votos_outros?: number
          votos_sim?: number
        }
        Update: {
          data?: string | null
          descricao?: string | null
          id?: string
          materia_id?: number | null
          materia_titulo?: string | null
          resultado?: string | null
          sigla_orgao?: string | null
          updated_at?: string
          votos_nao?: number
          votos_outros?: number
          votos_sim?: number
        }
        Relationships: []
      }
      senado_votos_cache: {
        Row: {
          senador_id: number
          sigla_partido: string | null
          sigla_uf: string | null
          tipo_voto: string
          updated_at: string
          votacao_id: string
        }
        Insert: {
          senador_id: number
          sigla_partido?: string | null
          sigla_uf?: string | null
          tipo_voto: string
          updated_at?: string
          votacao_id: string
        }
        Update: {
          senador_id?: number
          sigla_partido?: string | null
          sigla_uf?: string | null
          tipo_voto?: string
          updated_at?: string
          votacao_id?: string
        }
        Relationships: []
      }
      siconfi_relatorios_cache: {
        Row: {
          anexo: string | null
          cod_conta: string | null
          cod_ibge: string
          coluna: string | null
          conta: string | null
          ente_nome: string
          esfera: string
          exercicio: number
          id: string
          periodicidade: string | null
          periodo: number | null
          tipo_relatorio: string
          uf: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          anexo?: string | null
          cod_conta?: string | null
          cod_ibge: string
          coluna?: string | null
          conta?: string | null
          ente_nome: string
          esfera: string
          exercicio: number
          id: string
          periodicidade?: string | null
          periodo?: number | null
          tipo_relatorio: string
          uf?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          anexo?: string | null
          cod_conta?: string | null
          cod_ibge?: string
          coluna?: string | null
          conta?: string | null
          ente_nome?: string
          esfera?: string
          exercicio?: number
          id?: string
          periodicidade?: string | null
          periodo?: number | null
          tipo_relatorio?: string
          uf?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      transferegov_emendas_cache: {
        Row: {
          ano: number
          autor_emenda: string | null
          beneficiario_cnpj: string | null
          beneficiario_nome: string | null
          codigo_emenda: string | null
          data_referencia: string | null
          finalidade: string | null
          funcao: string | null
          id: string
          modalidade: string
          municipio_ibge: string | null
          municipio_nome: string | null
          numero_emenda: string | null
          subfuncao: string | null
          uf: string | null
          updated_at: string
          url_transferegov: string | null
          valor: number
          valor_pago: number
        }
        Insert: {
          ano: number
          autor_emenda?: string | null
          beneficiario_cnpj?: string | null
          beneficiario_nome?: string | null
          codigo_emenda?: string | null
          data_referencia?: string | null
          finalidade?: string | null
          funcao?: string | null
          id: string
          modalidade: string
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_emenda?: string | null
          subfuncao?: string | null
          uf?: string | null
          updated_at?: string
          url_transferegov?: string | null
          valor?: number
          valor_pago?: number
        }
        Update: {
          ano?: number
          autor_emenda?: string | null
          beneficiario_cnpj?: string | null
          beneficiario_nome?: string | null
          codigo_emenda?: string | null
          data_referencia?: string | null
          finalidade?: string | null
          funcao?: string | null
          id?: string
          modalidade?: string
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero_emenda?: string | null
          subfuncao?: string | null
          uf?: string | null
          updated_at?: string
          url_transferegov?: string | null
          valor?: number
          valor_pago?: number
        }
        Relationships: []
      }
      transferegov_instrumentos_cache: {
        Row: {
          beneficiario_cnpj: string | null
          beneficiario_nome: string | null
          codigo_siconv: string | null
          data_assinatura: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          esfera_beneficiario: string | null
          id: string
          modalidade: string | null
          municipio_ibge: string | null
          municipio_nome: string | null
          numero: string
          objeto: string | null
          orgao_concedente_cnpj: string | null
          orgao_concedente_nome: string | null
          situacao: string | null
          uf_beneficiario: string | null
          updated_at: string
          url_transferegov: string | null
          valor_contrapartida: number | null
          valor_global: number | null
          valor_repasse: number | null
        }
        Insert: {
          beneficiario_cnpj?: string | null
          beneficiario_nome?: string | null
          codigo_siconv?: string | null
          data_assinatura?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          esfera_beneficiario?: string | null
          id: string
          modalidade?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero: string
          objeto?: string | null
          orgao_concedente_cnpj?: string | null
          orgao_concedente_nome?: string | null
          situacao?: string | null
          uf_beneficiario?: string | null
          updated_at?: string
          url_transferegov?: string | null
          valor_contrapartida?: number | null
          valor_global?: number | null
          valor_repasse?: number | null
        }
        Update: {
          beneficiario_cnpj?: string | null
          beneficiario_nome?: string | null
          codigo_siconv?: string | null
          data_assinatura?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          esfera_beneficiario?: string | null
          id?: string
          modalidade?: string | null
          municipio_ibge?: string | null
          municipio_nome?: string | null
          numero?: string
          objeto?: string | null
          orgao_concedente_cnpj?: string | null
          orgao_concedente_nome?: string | null
          situacao?: string | null
          uf_beneficiario?: string | null
          updated_at?: string
          url_transferegov?: string | null
          valor_contrapartida?: number | null
          valor_global?: number | null
          valor_repasse?: number | null
        }
        Relationships: []
      }
      user_flags: {
        Row: {
          comentario: string | null
          created_at: string
          entidade_id: string
          entidade_tipo: string
          id: string
          tipo: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          entidade_id: string
          entidade_tipo: string
          id?: string
          tipo: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          tipo?: string
          user_id?: string
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
      votos_flag: {
        Row: {
          created_at: string
          flag_id: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          flag_id: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          flag_id?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "votos_flag_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "user_flags"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cobertura_camara_ceap: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_camara_votacoes: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_cgu: {
        Args: never
        Returns: {
          ano: number
          mes: number
          orgao_cod: string
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_pncp: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_senado_ceaps: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_senado_votacoes: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_siconfi: {
        Args: never
        Returns: {
          ano: number
          periodo: number
          qtd: number
          tipo_relatorio: string
          ultimo: string
        }[]
      }
      cobertura_tentativas: {
        Args: never
        Returns: {
          ano: number
          escopo: string
          fonte: string
          mes: number
          tentativas: number
          ultimo: string
        }[]
      }
      cobertura_transferegov: {
        Args: never
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      cobertura_transferegov_emendas: {
        Args: { _modalidade: string }
        Returns: {
          ano: number
          mes: number
          qtd: number
          ultimo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      qa_finding_publico: {
        Args: { _id: string }
        Returns: {
          detalhes: Json
          detectado_em: string
          entidade_id: string
          entidade_tipo: string
          fonte: string
          id: string
          origem: string
          regra: string
          reportado_em: string
          reporte_canal: string
          reporte_protocolo: string
          resolvido_em: string
          revalidado_em: string
          severidade: string
          status: string
          valor_armazenado: number
          valor_esperado: number
        }[]
      }
      qa_findings_agregado: {
        Args: never
        Returns: {
          abertos: number
          confirmados: number
          corrigidos: number
          criticos: number
          falsos_positivos: number
          fonte: string
          reportados: number
          total: number
        }[]
      }
      qa_findings_publicos: {
        Args: { _fonte?: string; _limit?: number; _status?: string }
        Returns: {
          detectado_em: string
          entidade_id: string
          entidade_tipo: string
          fonte: string
          id: string
          origem: string
          regra: string
          reportado_em: string
          reporte_canal: string
          reporte_protocolo: string
          resolvido_em: string
          revalidado_em: string
          severidade: string
          status: string
          valor_armazenado: number
          valor_esperado: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "curador" | "cidadao"
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
      app_role: ["admin", "curador", "cidadao"],
    },
  },
} as const
