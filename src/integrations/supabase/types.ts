export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      anotacoes: {
        Row: {
          conteudo_md: string;
          created_at: string;
          entidade_id: string | null;
          entidade_tipo: string | null;
          id: string;
          pergunta_id: string | null;
          tags: string[];
          titulo: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conteudo_md?: string;
          created_at?: string;
          entidade_id?: string | null;
          entidade_tipo?: string | null;
          id?: string;
          pergunta_id?: string | null;
          tags?: string[];
          titulo?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conteudo_md?: string;
          created_at?: string;
          entidade_id?: string | null;
          entidade_tipo?: string | null;
          id?: string;
          pergunta_id?: string | null;
          tags?: string[];
          titulo?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      artigos: {
        Row: {
          autor_id: string | null;
          capa_url: string | null;
          categoria: string;
          conteudo_md: string;
          created_at: string;
          dificuldade: string | null;
          fontes_usadas: string[];
          id: string;
          notas_internas: string | null;
          ordem: number;
          publicado_em: string | null;
          publico: boolean;
          resumo: string | null;
          slug: string;
          tempo_estimado_min: number | null;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          autor_id?: string | null;
          capa_url?: string | null;
          categoria?: string;
          conteudo_md?: string;
          created_at?: string;
          dificuldade?: string | null;
          fontes_usadas?: string[];
          id?: string;
          notas_internas?: string | null;
          ordem?: number;
          publicado_em?: string | null;
          publico?: boolean;
          resumo?: string | null;
          slug: string;
          tempo_estimado_min?: number | null;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          autor_id?: string | null;
          capa_url?: string | null;
          categoria?: string;
          conteudo_md?: string;
          created_at?: string;
          dificuldade?: string | null;
          fontes_usadas?: string[];
          id?: string;
          notas_internas?: string | null;
          ordem?: number;
          publicado_em?: string | null;
          publico?: boolean;
          resumo?: string | null;
          slug?: string;
          tempo_estimado_min?: number | null;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artigos_imagens: {
        Row: {
          altura: number | null;
          autor_id: string | null;
          created_at: string;
          id: string;
          largura: number | null;
          legenda: string | null;
          mime: string;
          nome_original: string;
          storage_path: string;
          tamanho_bytes: number;
          updated_at: string;
          url: string;
        };
        Insert: {
          altura?: number | null;
          autor_id?: string | null;
          created_at?: string;
          id?: string;
          largura?: number | null;
          legenda?: string | null;
          mime: string;
          nome_original: string;
          storage_path: string;
          tamanho_bytes: number;
          updated_at?: string;
          url: string;
        };
        Update: {
          altura?: number | null;
          autor_id?: string | null;
          created_at?: string;
          id?: string;
          largura?: number | null;
          legenda?: string | null;
          mime?: string;
          nome_original?: string;
          storage_path?: string;
          tamanho_bytes?: number;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      camara_deputado_eventos: {
        Row: {
          condicao_eleitoral: string | null;
          data_hora: string | null;
          deputado_id: number;
          descricao: string | null;
          id: number;
          id_legislatura: number | null;
          sigla_partido: string | null;
          sigla_uf: string | null;
          situacao: string | null;
          updated_at: string;
        };
        Insert: {
          condicao_eleitoral?: string | null;
          data_hora?: string | null;
          deputado_id: number;
          descricao?: string | null;
          id?: never;
          id_legislatura?: number | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
        };
        Update: {
          condicao_eleitoral?: string | null;
          data_hora?: string | null;
          deputado_id?: number;
          descricao?: string | null;
          id?: never;
          id_legislatura?: number | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      camara_deputado_legislaturas: {
        Row: {
          condicao_eleitoral: string | null;
          deputado_id: number;
          id_legislatura: number;
          sigla_partido: string | null;
          sigla_uf: string | null;
          situacao: string | null;
          updated_at: string;
        };
        Insert: {
          condicao_eleitoral?: string | null;
          deputado_id: number;
          id_legislatura: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
        };
        Update: {
          condicao_eleitoral?: string | null;
          deputado_id?: number;
          id_legislatura?: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      camara_deputados_cache: {
        Row: {
          condicao_eleitoral: string | null;
          email: string | null;
          id: number;
          id_legislatura: number | null;
          nome: string;
          nome_civil: string | null;
          sigla_partido: string | null;
          sigla_uf: string | null;
          situacao: string | null;
          updated_at: string;
          url_foto: string | null;
        };
        Insert: {
          condicao_eleitoral?: string | null;
          email?: string | null;
          id: number;
          id_legislatura?: number | null;
          nome: string;
          nome_civil?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
          url_foto?: string | null;
        };
        Update: {
          condicao_eleitoral?: string | null;
          email?: string | null;
          id?: number;
          id_legislatura?: number | null;
          nome?: string;
          nome_civil?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
          url_foto?: string | null;
        };
        Relationships: [];
      };
      camara_despesas_cache: {
        Row: {
          ano: number;
          cod_documento: number | null;
          data_documento: string | null;
          deputado_id: number;
          fornecedor_cnpj: string | null;
          fornecedor_nome: string | null;
          id: string;
          mes: number;
          num_documento: string | null;
          tipo_despesa: string | null;
          tipo_documento: string | null;
          updated_at: string;
          url_documento: string | null;
          valor_documento: number;
          valor_glosa: number;
          valor_liquido: number;
        };
        Insert: {
          ano: number;
          cod_documento?: number | null;
          data_documento?: string | null;
          deputado_id: number;
          fornecedor_cnpj?: string | null;
          fornecedor_nome?: string | null;
          id: string;
          mes: number;
          num_documento?: string | null;
          tipo_despesa?: string | null;
          tipo_documento?: string | null;
          updated_at?: string;
          url_documento?: string | null;
          valor_documento?: number;
          valor_glosa?: number;
          valor_liquido?: number;
        };
        Update: {
          ano?: number;
          cod_documento?: number | null;
          data_documento?: string | null;
          deputado_id?: number;
          fornecedor_cnpj?: string | null;
          fornecedor_nome?: string | null;
          id?: string;
          mes?: number;
          num_documento?: string | null;
          tipo_despesa?: string | null;
          tipo_documento?: string | null;
          updated_at?: string;
          url_documento?: string | null;
          valor_documento?: number;
          valor_glosa?: number;
          valor_liquido?: number;
        };
        Relationships: [];
      };
      camara_proposicoes_autores_cache: {
        Row: {
          deputado_id: number | null;
          nome: string;
          ordem_assinatura: number | null;
          proponente: boolean;
          proposicao_id: number;
          tipo: string | null;
          updated_at: string;
        };
        Insert: {
          deputado_id?: number | null;
          nome: string;
          ordem_assinatura?: number | null;
          proponente?: boolean;
          proposicao_id: number;
          tipo?: string | null;
          updated_at?: string;
        };
        Update: {
          deputado_id?: number | null;
          nome?: string;
          ordem_assinatura?: number | null;
          proponente?: boolean;
          proposicao_id?: number;
          tipo?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      camara_proposicoes_cache: {
        Row: {
          ano: number;
          cod_tipo: number | null;
          data_apresentacao: string | null;
          descricao_tipo: string | null;
          ementa: string | null;
          ementa_detalhada: string | null;
          id: number;
          keywords: string | null;
          numero: number;
          sigla_tipo: string;
          ultimo_status_data: string | null;
          ultimo_status_descricao: string | null;
          ultimo_status_despacho: string | null;
          ultimo_status_orgao_sigla: string | null;
          ultimo_status_situacao: string | null;
          updated_at: string;
          url_inteiro_teor: string | null;
        };
        Insert: {
          ano: number;
          cod_tipo?: number | null;
          data_apresentacao?: string | null;
          descricao_tipo?: string | null;
          ementa?: string | null;
          ementa_detalhada?: string | null;
          id: number;
          keywords?: string | null;
          numero: number;
          sigla_tipo: string;
          ultimo_status_data?: string | null;
          ultimo_status_descricao?: string | null;
          ultimo_status_despacho?: string | null;
          ultimo_status_orgao_sigla?: string | null;
          ultimo_status_situacao?: string | null;
          updated_at?: string;
          url_inteiro_teor?: string | null;
        };
        Update: {
          ano?: number;
          cod_tipo?: number | null;
          data_apresentacao?: string | null;
          descricao_tipo?: string | null;
          ementa?: string | null;
          ementa_detalhada?: string | null;
          id?: number;
          keywords?: string | null;
          numero?: number;
          sigla_tipo?: string;
          ultimo_status_data?: string | null;
          ultimo_status_descricao?: string | null;
          ultimo_status_despacho?: string | null;
          ultimo_status_orgao_sigla?: string | null;
          ultimo_status_situacao?: string | null;
          updated_at?: string;
          url_inteiro_teor?: string | null;
        };
        Relationships: [];
      };
      camara_votacoes_cache: {
        Row: {
          aprovacao: number | null;
          data: string | null;
          data_hora_registro: string | null;
          descricao: string | null;
          descricao_resultado: string | null;
          id: string;
          proposicao_id: number | null;
          proposicao_titulo: string | null;
          sigla_orgao: string | null;
          updated_at: string;
          votos_nao: number;
          votos_outros: number;
          votos_sim: number;
        };
        Insert: {
          aprovacao?: number | null;
          data?: string | null;
          data_hora_registro?: string | null;
          descricao?: string | null;
          descricao_resultado?: string | null;
          id: string;
          proposicao_id?: number | null;
          proposicao_titulo?: string | null;
          sigla_orgao?: string | null;
          updated_at?: string;
          votos_nao?: number;
          votos_outros?: number;
          votos_sim?: number;
        };
        Update: {
          aprovacao?: number | null;
          data?: string | null;
          data_hora_registro?: string | null;
          descricao?: string | null;
          descricao_resultado?: string | null;
          id?: string;
          proposicao_id?: number | null;
          proposicao_titulo?: string | null;
          sigla_orgao?: string | null;
          updated_at?: string;
          votos_nao?: number;
          votos_outros?: number;
          votos_sim?: number;
        };
        Relationships: [];
      };
      camara_votos_cache: {
        Row: {
          deputado_id: number;
          sigla_partido: string | null;
          sigla_uf: string | null;
          tipo_voto: string;
          updated_at: string;
          votacao_id: string;
        };
        Insert: {
          deputado_id: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          tipo_voto: string;
          updated_at?: string;
          votacao_id: string;
        };
        Update: {
          deputado_id?: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          tipo_voto?: string;
          updated_at?: string;
          votacao_id?: string;
        };
        Relationships: [];
      };
      cgu_convenios_cache: {
        Row: {
          ano: number;
          codigo_siconv: string | null;
          convenente_cnpj: string | null;
          convenente_nome: string | null;
          data_fim_vigencia: string | null;
          data_inicio_vigencia: string | null;
          data_publicacao: string | null;
          id: string;
          mes_referencia: number | null;
          municipio_ibge: string | null;
          municipio_nome: string | null;
          numero: string | null;
          objeto: string | null;
          orgao_cnpj: string | null;
          orgao_cod: string | null;
          orgao_nome: string | null;
          situacao: string | null;
          tipo_instrumento: string | null;
          uf: string | null;
          updated_at: string;
          url_oficial: string | null;
          valor: number | null;
          valor_contrapartida: number | null;
          valor_liberado: number | null;
        };
        Insert: {
          ano: number;
          codigo_siconv?: string | null;
          convenente_cnpj?: string | null;
          convenente_nome?: string | null;
          data_fim_vigencia?: string | null;
          data_inicio_vigencia?: string | null;
          data_publicacao?: string | null;
          id: string;
          mes_referencia?: number | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero?: string | null;
          objeto?: string | null;
          orgao_cnpj?: string | null;
          orgao_cod?: string | null;
          orgao_nome?: string | null;
          situacao?: string | null;
          tipo_instrumento?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor?: number | null;
          valor_contrapartida?: number | null;
          valor_liberado?: number | null;
        };
        Update: {
          ano?: number;
          codigo_siconv?: string | null;
          convenente_cnpj?: string | null;
          convenente_nome?: string | null;
          data_fim_vigencia?: string | null;
          data_inicio_vigencia?: string | null;
          data_publicacao?: string | null;
          id?: string;
          mes_referencia?: number | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero?: string | null;
          objeto?: string | null;
          orgao_cnpj?: string | null;
          orgao_cod?: string | null;
          orgao_nome?: string | null;
          situacao?: string | null;
          tipo_instrumento?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor?: number | null;
          valor_contrapartida?: number | null;
          valor_liberado?: number | null;
        };
        Relationships: [];
      };
      cgu_licitacoes_cache: {
        Row: {
          ano: number;
          data_abertura: string | null;
          data_publicacao: string | null;
          data_resultado: string | null;
          id: string;
          mes_referencia: number | null;
          modalidade: string | null;
          municipio_ibge: string | null;
          municipio_nome: string | null;
          numero: string | null;
          numero_processo: string | null;
          objeto: string | null;
          orgao_cnpj: string | null;
          orgao_cod: string;
          situacao: string | null;
          uf: string | null;
          unidade_gestora: string | null;
          updated_at: string;
          url_oficial: string | null;
          valor: number | null;
        };
        Insert: {
          ano: number;
          data_abertura?: string | null;
          data_publicacao?: string | null;
          data_resultado?: string | null;
          id: string;
          mes_referencia?: number | null;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero?: string | null;
          numero_processo?: string | null;
          objeto?: string | null;
          orgao_cnpj?: string | null;
          orgao_cod: string;
          situacao?: string | null;
          uf?: string | null;
          unidade_gestora?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor?: number | null;
        };
        Update: {
          ano?: number;
          data_abertura?: string | null;
          data_publicacao?: string | null;
          data_resultado?: string | null;
          id?: string;
          mes_referencia?: number | null;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero?: string | null;
          numero_processo?: string | null;
          objeto?: string | null;
          orgao_cnpj?: string | null;
          orgao_cod?: string;
          situacao?: string | null;
          uf?: string | null;
          unidade_gestora?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor?: number | null;
        };
        Relationships: [];
      };
      cgu_transferegov_emendas_cache: {
        Row: {
          ano: number;
          areas_politicas: string | null;
          autor: string | null;
          beneficiario_cnpj: string | null;
          beneficiario_nome: string | null;
          funcao: string | null;
          id: string;
          localidade: string | null;
          numero_emenda: string | null;
          plano_acao_situacao: string | null;
          planos_acao_count: number | null;
          subfuncao: string | null;
          tipo_emenda: string | null;
          uf: string | null;
          updated_at: string;
          url_oficial: string | null;
          valor_custeio: number | null;
          valor_empenhado: number | null;
          valor_investimento: number | null;
          valor_liquidado: number | null;
          valor_pago: number | null;
          valor_resto_cancelado: number | null;
          valor_resto_inscrito: number | null;
          valor_resto_pago: number | null;
        };
        Insert: {
          ano: number;
          areas_politicas?: string | null;
          autor?: string | null;
          beneficiario_cnpj?: string | null;
          beneficiario_nome?: string | null;
          funcao?: string | null;
          id: string;
          localidade?: string | null;
          numero_emenda?: string | null;
          plano_acao_situacao?: string | null;
          planos_acao_count?: number | null;
          subfuncao?: string | null;
          tipo_emenda?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor_custeio?: number | null;
          valor_empenhado?: number | null;
          valor_investimento?: number | null;
          valor_liquidado?: number | null;
          valor_pago?: number | null;
          valor_resto_cancelado?: number | null;
          valor_resto_inscrito?: number | null;
          valor_resto_pago?: number | null;
        };
        Update: {
          ano?: number;
          areas_politicas?: string | null;
          autor?: string | null;
          beneficiario_cnpj?: string | null;
          beneficiario_nome?: string | null;
          funcao?: string | null;
          id?: string;
          localidade?: string | null;
          numero_emenda?: string | null;
          plano_acao_situacao?: string | null;
          planos_acao_count?: number | null;
          subfuncao?: string | null;
          tipo_emenda?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_oficial?: string | null;
          valor_custeio?: number | null;
          valor_empenhado?: number | null;
          valor_investimento?: number | null;
          valor_liquidado?: number | null;
          valor_pago?: number | null;
          valor_resto_cancelado?: number | null;
          valor_resto_inscrito?: number | null;
          valor_resto_pago?: number | null;
        };
        Relationships: [];
      };
      cgu_varredura: {
        Row: {
          atualizado_em: string;
          completa: boolean;
          orgao_cod: string;
          total_importado: number;
          ultima_pagina: number;
        };
        Insert: {
          atualizado_em?: string;
          completa?: boolean;
          orgao_cod: string;
          total_importado?: number;
          ultima_pagina?: number;
        };
        Update: {
          atualizado_em?: string;
          completa?: boolean;
          orgao_cod?: string;
          total_importado?: number;
          ultima_pagina?: number;
        };
        Relationships: [];
      };
      contestacoes: {
        Row: {
          contato: string | null;
          created_at: string;
          descricao: string;
          fundamento: string | null;
          id: string;
          respondido_em: string | null;
          respondido_por: string | null;
          resposta: string | null;
          solicitante_tipo: string;
          status: string;
          tipo: string;
          updated_at: string;
          url_pagina: string;
          user_id: string | null;
        };
        Insert: {
          contato?: string | null;
          created_at?: string;
          descricao: string;
          fundamento?: string | null;
          id?: string;
          respondido_em?: string | null;
          respondido_por?: string | null;
          resposta?: string | null;
          solicitante_tipo: string;
          status?: string;
          tipo: string;
          updated_at?: string;
          url_pagina: string;
          user_id?: string | null;
        };
        Update: {
          contato?: string | null;
          created_at?: string;
          descricao?: string;
          fundamento?: string | null;
          id?: string;
          respondido_em?: string | null;
          respondido_por?: string | null;
          resposta?: string | null;
          solicitante_tipo?: string;
          status?: string;
          tipo?: string;
          updated_at?: string;
          url_pagina?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      contratos_cache: {
        Row: {
          ano: number;
          data_assinatura: string | null;
          data_inicio_vigencia: string | null;
          fornecedor_cnpj: string;
          id: string;
          mes_referencia: number | null;
          modalidade: string;
          numero: string | null;
          objeto: string;
          orgao_cod: string;
          updated_at: string;
          valor: number;
          valor_inicial: number | null;
        };
        Insert: {
          ano: number;
          data_assinatura?: string | null;
          data_inicio_vigencia?: string | null;
          fornecedor_cnpj: string;
          id: string;
          mes_referencia?: number | null;
          modalidade: string;
          numero?: string | null;
          objeto: string;
          orgao_cod: string;
          updated_at?: string;
          valor?: number;
          valor_inicial?: number | null;
        };
        Update: {
          ano?: number;
          data_assinatura?: string | null;
          data_inicio_vigencia?: string | null;
          fornecedor_cnpj?: string;
          id?: string;
          mes_referencia?: number | null;
          modalidade?: string;
          numero?: string | null;
          objeto?: string;
          orgao_cod?: string;
          updated_at?: string;
          valor?: number;
          valor_inicial?: number | null;
        };
        Relationships: [];
      };
      fornecedores_cache: {
        Row: {
          cnpj: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          cnpj: string;
          nome: string;
          updated_at?: string;
        };
        Update: {
          cnpj?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      importacao_varredura: {
        Row: {
          atualizado_em: string;
          chave: string;
          completa: boolean;
          cursor: number;
          total: number;
        };
        Insert: {
          atualizado_em?: string;
          chave: string;
          completa?: boolean;
          cursor?: number;
          total?: number;
        };
        Update: {
          atualizado_em?: string;
          chave?: string;
          completa?: boolean;
          cursor?: number;
          total?: number;
        };
        Relationships: [];
      };
      importacoes: {
        Row: {
          ano: number | null;
          consultado_em: string;
          data_final: string | null;
          data_inicial: string | null;
          endpoint: string | null;
          erros: Json;
          escopo: string;
          fonte: string;
          id: string;
          importados: number;
          log_kind: string | null;
          mes: number | null;
          orgao_cod: string | null;
          total_bruto: number;
          user_id: string | null;
        };
        Insert: {
          ano?: number | null;
          consultado_em?: string;
          data_final?: string | null;
          data_inicial?: string | null;
          endpoint?: string | null;
          erros?: Json;
          escopo?: string;
          fonte?: string;
          id?: string;
          importados?: number;
          log_kind?: string | null;
          mes?: number | null;
          orgao_cod?: string | null;
          total_bruto?: number;
          user_id?: string | null;
        };
        Update: {
          ano?: number | null;
          consultado_em?: string;
          data_final?: string | null;
          data_inicial?: string | null;
          endpoint?: string | null;
          erros?: Json;
          escopo?: string;
          fonte?: string;
          id?: string;
          importados?: number;
          log_kind?: string | null;
          mes?: number | null;
          orgao_cod?: string | null;
          total_bruto?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      itens_salvos: {
        Row: {
          conteudo_snapshot: string | null;
          contexto: string | null;
          created_at: string;
          entidade_id: string;
          entidade_tipo: string;
          id: string;
          pergunta_id: string | null;
          snapshot_divergiu_em: string | null;
          snapshot_em: string | null;
          snapshot_hash: string | null;
          snapshot_verificado_em: string | null;
          tags: string[];
          titulo: string;
          updated_at: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          conteudo_snapshot?: string | null;
          contexto?: string | null;
          created_at?: string;
          entidade_id: string;
          entidade_tipo: string;
          id?: string;
          pergunta_id?: string | null;
          snapshot_divergiu_em?: string | null;
          snapshot_em?: string | null;
          snapshot_hash?: string | null;
          snapshot_verificado_em?: string | null;
          tags?: string[];
          titulo: string;
          updated_at?: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          conteudo_snapshot?: string | null;
          contexto?: string | null;
          created_at?: string;
          entidade_id?: string;
          entidade_tipo?: string;
          id?: string;
          pergunta_id?: string | null;
          snapshot_divergiu_em?: string | null;
          snapshot_em?: string | null;
          snapshot_hash?: string | null;
          snapshot_verificado_em?: string | null;
          tags?: string[];
          titulo?: string;
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "itens_salvos_pergunta_id_fkey";
            columns: ["pergunta_id"];
            isOneToOne: false;
            referencedRelation: "perguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      lacunas: {
        Row: {
          ciclo: Database["public"]["Enums"]["lacuna_ciclo"];
          created_at: string;
          criada_por: string | null;
          descricao: string;
          entidade_id: string | null;
          entidade_tipo: string | null;
          id: string;
          origem_qa_finding_id: string | null;
          publicada: boolean;
          resolvida_em: string | null;
          tags: string[];
          tipo: Database["public"]["Enums"]["lacuna_tipo"];
          titulo: string;
          updated_at: string;
        };
        Insert: {
          ciclo?: Database["public"]["Enums"]["lacuna_ciclo"];
          created_at?: string;
          criada_por?: string | null;
          descricao: string;
          entidade_id?: string | null;
          entidade_tipo?: string | null;
          id?: string;
          origem_qa_finding_id?: string | null;
          publicada?: boolean;
          resolvida_em?: string | null;
          tags?: string[];
          tipo: Database["public"]["Enums"]["lacuna_tipo"];
          titulo: string;
          updated_at?: string;
        };
        Update: {
          ciclo?: Database["public"]["Enums"]["lacuna_ciclo"];
          created_at?: string;
          criada_por?: string | null;
          descricao?: string;
          entidade_id?: string | null;
          entidade_tipo?: string | null;
          id?: string;
          origem_qa_finding_id?: string | null;
          publicada?: boolean;
          resolvida_em?: string | null;
          tags?: string[];
          tipo?: Database["public"]["Enums"]["lacuna_tipo"];
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lacunas_origem_qa_finding_id_fkey";
            columns: ["origem_qa_finding_id"];
            isOneToOne: false;
            referencedRelation: "qa_findings";
            referencedColumns: ["id"];
          },
        ];
      };
      mapa_prompts: {
        Row: {
          artigo_id: string;
          created_at: string;
          ordem: number;
          prompt_modelo_id: string;
        };
        Insert: {
          artigo_id: string;
          created_at?: string;
          ordem?: number;
          prompt_modelo_id: string;
        };
        Update: {
          artigo_id?: string;
          created_at?: string;
          ordem?: number;
          prompt_modelo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mapa_prompts_artigo_id_fkey";
            columns: ["artigo_id"];
            isOneToOne: false;
            referencedRelation: "artigos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mapa_prompts_prompt_modelo_id_fkey";
            columns: ["prompt_modelo_id"];
            isOneToOne: false;
            referencedRelation: "prompt_modelos";
            referencedColumns: ["id"];
          },
        ];
      };
      orgaos_cache: {
        Row: {
          ano_ultima_despesa: number | null;
          ativo: boolean;
          cod: string;
          disponivel_portal: boolean;
          funcao: string | null;
          nome: string;
          nota: string | null;
          orgao_vinculado_cod: string | null;
          orgao_vinculado_nome: string | null;
          poder: string;
          sigla: string | null;
          ultima_verificacao_atividade: string | null;
          updated_at: string;
        };
        Insert: {
          ano_ultima_despesa?: number | null;
          ativo?: boolean;
          cod: string;
          disponivel_portal?: boolean;
          funcao?: string | null;
          nome: string;
          nota?: string | null;
          orgao_vinculado_cod?: string | null;
          orgao_vinculado_nome?: string | null;
          poder?: string;
          sigla?: string | null;
          ultima_verificacao_atividade?: string | null;
          updated_at?: string;
        };
        Update: {
          ano_ultima_despesa?: number | null;
          ativo?: boolean;
          cod?: string;
          disponivel_portal?: boolean;
          funcao?: string | null;
          nome?: string;
          nota?: string | null;
          orgao_vinculado_cod?: string | null;
          orgao_vinculado_nome?: string | null;
          poder?: string;
          sigla?: string | null;
          ultima_verificacao_atividade?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pergunta_itens: {
        Row: {
          created_at: string;
          id: string;
          nota: string | null;
          ordem: number;
          pergunta_id: string;
          ref_id: string | null;
          tipo: Database["public"]["Enums"]["pergunta_item_tipo"];
          titulo: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nota?: string | null;
          ordem?: number;
          pergunta_id: string;
          ref_id?: string | null;
          tipo: Database["public"]["Enums"]["pergunta_item_tipo"];
          titulo: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nota?: string | null;
          ordem?: number;
          pergunta_id?: string;
          ref_id?: string | null;
          tipo?: Database["public"]["Enums"]["pergunta_item_tipo"];
          titulo?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pergunta_itens_pergunta_id_fkey";
            columns: ["pergunta_id"];
            isOneToOne: false;
            referencedRelation: "perguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      pergunta_modelos: {
        Row: {
          ativo: boolean;
          contexto: string | null;
          created_at: string;
          descricao: string | null;
          id: string;
          ordem: number;
          tags: string[];
          titulo: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          contexto?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          tags?: string[];
          titulo: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          contexto?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          tags?: string[];
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pergunta_seguidores: {
        Row: {
          created_at: string;
          pergunta_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          pergunta_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          pergunta_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pergunta_seguidores_pergunta_id_fkey";
            columns: ["pergunta_id"];
            isOneToOne: false;
            referencedRelation: "perguntas";
            referencedColumns: ["id"];
          },
        ];
      };
      perguntas: {
        Row: {
          arquivada_em: string | null;
          contexto: string | null;
          created_at: string;
          descricao: string | null;
          encerrada_em: string | null;
          id: string;
          modelo_id: string | null;
          moderador_id: string | null;
          motivo_rejeicao: string | null;
          ordem: number;
          publicada_em: string | null;
          revisada_em: string | null;
          slug: string | null;
          solicitada_publicacao_em: string | null;
          status: Database["public"]["Enums"]["pergunta_status"];
          tags: string[];
          titulo: string;
          updated_at: string;
          user_id: string;
          visibilidade_publica: boolean;
        };
        Insert: {
          arquivada_em?: string | null;
          contexto?: string | null;
          created_at?: string;
          descricao?: string | null;
          encerrada_em?: string | null;
          id?: string;
          modelo_id?: string | null;
          moderador_id?: string | null;
          motivo_rejeicao?: string | null;
          ordem?: number;
          publicada_em?: string | null;
          revisada_em?: string | null;
          slug?: string | null;
          solicitada_publicacao_em?: string | null;
          status?: Database["public"]["Enums"]["pergunta_status"];
          tags?: string[];
          titulo: string;
          updated_at?: string;
          user_id: string;
          visibilidade_publica?: boolean;
        };
        Update: {
          arquivada_em?: string | null;
          contexto?: string | null;
          created_at?: string;
          descricao?: string | null;
          encerrada_em?: string | null;
          id?: string;
          modelo_id?: string | null;
          moderador_id?: string | null;
          motivo_rejeicao?: string | null;
          ordem?: number;
          publicada_em?: string | null;
          revisada_em?: string | null;
          slug?: string | null;
          solicitada_publicacao_em?: string | null;
          status?: Database["public"]["Enums"]["pergunta_status"];
          tags?: string[];
          titulo?: string;
          updated_at?: string;
          user_id?: string;
          visibilidade_publica?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "perguntas_modelo_id_fkey";
            columns: ["modelo_id"];
            isOneToOne: false;
            referencedRelation: "pergunta_modelos";
            referencedColumns: ["id"];
          },
        ];
      };
      pncp_contratos_cache: {
        Row: {
          ano: number;
          data_assinatura: string | null;
          data_vigencia_fim: string | null;
          data_vigencia_inicio: string | null;
          esfera: string | null;
          fornecedor_cnpj_cpf: string | null;
          fornecedor_nome: string | null;
          id: string;
          modalidade: string | null;
          municipio_ibge: string | null;
          municipio_nome: string | null;
          numero_contrato: string | null;
          numero_controle_pncp: string;
          objeto: string | null;
          orgao_cnpj: string;
          orgao_nome: string;
          poder: string | null;
          situacao: string | null;
          uf: string | null;
          updated_at: string;
          url_pncp: string | null;
          valor_global: number | null;
          valor_inicial: number | null;
        };
        Insert: {
          ano: number;
          data_assinatura?: string | null;
          data_vigencia_fim?: string | null;
          data_vigencia_inicio?: string | null;
          esfera?: string | null;
          fornecedor_cnpj_cpf?: string | null;
          fornecedor_nome?: string | null;
          id: string;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero_contrato?: string | null;
          numero_controle_pncp: string;
          objeto?: string | null;
          orgao_cnpj: string;
          orgao_nome: string;
          poder?: string | null;
          situacao?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_pncp?: string | null;
          valor_global?: number | null;
          valor_inicial?: number | null;
        };
        Update: {
          ano?: number;
          data_assinatura?: string | null;
          data_vigencia_fim?: string | null;
          data_vigencia_inicio?: string | null;
          esfera?: string | null;
          fornecedor_cnpj_cpf?: string | null;
          fornecedor_nome?: string | null;
          id?: string;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero_contrato?: string | null;
          numero_controle_pncp?: string;
          objeto?: string | null;
          orgao_cnpj?: string;
          orgao_nome?: string;
          poder?: string | null;
          situacao?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_pncp?: string | null;
          valor_global?: number | null;
          valor_inicial?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      prompt_modelos: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          id: string;
          ordem: number;
          prompt_template: string;
          tags: string[];
          titulo: string;
          updated_at: string;
          variaveis: Json;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          prompt_template: string;
          tags?: string[];
          titulo: string;
          updated_at?: string;
          variaveis?: Json;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          prompt_template?: string;
          tags?: string[];
          titulo?: string;
          updated_at?: string;
          variaveis?: Json;
        };
        Relationships: [];
      };
      qa_findings: {
        Row: {
          detalhes: Json;
          detectado_em: string;
          entidade_id: string;
          entidade_tipo: string;
          fonte: string;
          id: string;
          notas_admin: string | null;
          origem: string;
          regra: string;
          reportado_em: string | null;
          reporte_canal: string | null;
          reporte_protocolo: string | null;
          resolvido_em: string | null;
          revalidado_em: string | null;
          severidade: string;
          status: string;
          tipo: string;
          updated_at: string;
          valor_armazenado: number | null;
          valor_esperado: number | null;
        };
        Insert: {
          detalhes?: Json;
          detectado_em?: string;
          entidade_id: string;
          entidade_tipo: string;
          fonte: string;
          id?: string;
          notas_admin?: string | null;
          origem?: string;
          regra: string;
          reportado_em?: string | null;
          reporte_canal?: string | null;
          reporte_protocolo?: string | null;
          resolvido_em?: string | null;
          revalidado_em?: string | null;
          severidade?: string;
          status?: string;
          tipo?: string;
          updated_at?: string;
          valor_armazenado?: number | null;
          valor_esperado?: number | null;
        };
        Update: {
          detalhes?: Json;
          detectado_em?: string;
          entidade_id?: string;
          entidade_tipo?: string;
          fonte?: string;
          id?: string;
          notas_admin?: string | null;
          origem?: string;
          regra?: string;
          reportado_em?: string | null;
          reporte_canal?: string | null;
          reporte_protocolo?: string | null;
          resolvido_em?: string | null;
          revalidado_em?: string | null;
          severidade?: string;
          status?: string;
          tipo?: string;
          updated_at?: string;
          valor_armazenado?: number | null;
          valor_esperado?: number | null;
        };
        Relationships: [];
      };
      roadmap_itens: {
        Row: {
          concluido_em: string | null;
          created_at: string;
          descricao: string | null;
          id: string;
          notas: string | null;
          ordem: number;
          publico: boolean;
          status: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          concluido_em?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          notas?: string | null;
          ordem?: number;
          publico?: boolean;
          status?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          concluido_em?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          notas?: string | null;
          ordem?: number;
          publico?: boolean;
          status?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      senado_despesas_cache: {
        Row: {
          ano: number;
          data_documento: string | null;
          detalhamento: string | null;
          fornecedor_cnpj: string | null;
          fornecedor_nome: string | null;
          id: string;
          mes: number;
          num_documento: string | null;
          senador_id: number;
          tipo_despesa: string | null;
          updated_at: string;
          valor_reembolsado: number;
        };
        Insert: {
          ano: number;
          data_documento?: string | null;
          detalhamento?: string | null;
          fornecedor_cnpj?: string | null;
          fornecedor_nome?: string | null;
          id: string;
          mes: number;
          num_documento?: string | null;
          senador_id: number;
          tipo_despesa?: string | null;
          updated_at?: string;
          valor_reembolsado?: number;
        };
        Update: {
          ano?: number;
          data_documento?: string | null;
          detalhamento?: string | null;
          fornecedor_cnpj?: string | null;
          fornecedor_nome?: string | null;
          id?: string;
          mes?: number;
          num_documento?: string | null;
          senador_id?: number;
          tipo_despesa?: string | null;
          updated_at?: string;
          valor_reembolsado?: number;
        };
        Relationships: [];
      };
      senado_exercicios: {
        Row: {
          codigo_parlamentar: number;
          data_fim: string | null;
          data_inicio: string | null;
          descricao_causa: string | null;
          id: number;
          participacao: string | null;
          sigla_causa: string | null;
          uf: string | null;
          updated_at: string;
        };
        Insert: {
          codigo_parlamentar: number;
          data_fim?: string | null;
          data_inicio?: string | null;
          descricao_causa?: string | null;
          id?: never;
          participacao?: string | null;
          sigla_causa?: string | null;
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          codigo_parlamentar?: number;
          data_fim?: string | null;
          data_inicio?: string | null;
          descricao_causa?: string | null;
          id?: never;
          participacao?: string | null;
          sigla_causa?: string | null;
          uf?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      senado_materias_autores_cache: {
        Row: {
          materia_id: number;
          nome: string;
          ordem: number | null;
          proponente: boolean;
          senador_id: number | null;
          tipo: string | null;
          updated_at: string;
        };
        Insert: {
          materia_id: number;
          nome: string;
          ordem?: number | null;
          proponente?: boolean;
          senador_id?: number | null;
          tipo?: string | null;
          updated_at?: string;
        };
        Update: {
          materia_id?: number;
          nome?: string;
          ordem?: number | null;
          proponente?: boolean;
          senador_id?: number | null;
          tipo?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      senado_materias_cache: {
        Row: {
          ano: number;
          autor_principal: string | null;
          data_apresentacao: string | null;
          ementa: string | null;
          id: number;
          numero: number;
          sigla_subtipo: string;
          ultima_data: string | null;
          ultima_situacao: string | null;
          updated_at: string;
          url_texto: string | null;
        };
        Insert: {
          ano: number;
          autor_principal?: string | null;
          data_apresentacao?: string | null;
          ementa?: string | null;
          id: number;
          numero: number;
          sigla_subtipo: string;
          ultima_data?: string | null;
          ultima_situacao?: string | null;
          updated_at?: string;
          url_texto?: string | null;
        };
        Update: {
          ano?: number;
          autor_principal?: string | null;
          data_apresentacao?: string | null;
          ementa?: string | null;
          id?: number;
          numero?: number;
          sigla_subtipo?: string;
          ultima_data?: string | null;
          ultima_situacao?: string | null;
          updated_at?: string;
          url_texto?: string | null;
        };
        Relationships: [];
      };
      senado_senador_legislaturas: {
        Row: {
          codigo_parlamentar: number;
          legislatura: number;
          participacao: string | null;
          sigla_partido: string | null;
          sigla_uf: string | null;
          updated_at: string;
        };
        Insert: {
          codigo_parlamentar: number;
          legislatura: number;
          participacao?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          updated_at?: string;
        };
        Update: {
          codigo_parlamentar?: number;
          legislatura?: number;
          participacao?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      senado_senadores_cache: {
        Row: {
          codigo_parlamentar: number;
          email: string | null;
          id: number;
          nome: string;
          nome_completo: string | null;
          sigla_partido: string | null;
          sigla_uf: string | null;
          situacao: string | null;
          updated_at: string;
          url_foto: string | null;
        };
        Insert: {
          codigo_parlamentar: number;
          email?: string | null;
          id: number;
          nome: string;
          nome_completo?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
          url_foto?: string | null;
        };
        Update: {
          codigo_parlamentar?: number;
          email?: string | null;
          id?: number;
          nome?: string;
          nome_completo?: string | null;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          situacao?: string | null;
          updated_at?: string;
          url_foto?: string | null;
        };
        Relationships: [];
      };
      senado_suplencia: {
        Row: {
          id: number;
          legislatura: number | null;
          ordem: string | null;
          suplente_codigo: number | null;
          suplente_nome: string | null;
          titular_codigo: number;
          updated_at: string;
        };
        Insert: {
          id?: never;
          legislatura?: number | null;
          ordem?: string | null;
          suplente_codigo?: number | null;
          suplente_nome?: string | null;
          titular_codigo: number;
          updated_at?: string;
        };
        Update: {
          id?: never;
          legislatura?: number | null;
          ordem?: string | null;
          suplente_codigo?: number | null;
          suplente_nome?: string | null;
          titular_codigo?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      senado_votacoes_cache: {
        Row: {
          data: string | null;
          descricao: string | null;
          id: string;
          materia_id: number | null;
          materia_titulo: string | null;
          resultado: string | null;
          sigla_orgao: string | null;
          updated_at: string;
          votos_nao: number;
          votos_outros: number;
          votos_sim: number;
        };
        Insert: {
          data?: string | null;
          descricao?: string | null;
          id: string;
          materia_id?: number | null;
          materia_titulo?: string | null;
          resultado?: string | null;
          sigla_orgao?: string | null;
          updated_at?: string;
          votos_nao?: number;
          votos_outros?: number;
          votos_sim?: number;
        };
        Update: {
          data?: string | null;
          descricao?: string | null;
          id?: string;
          materia_id?: number | null;
          materia_titulo?: string | null;
          resultado?: string | null;
          sigla_orgao?: string | null;
          updated_at?: string;
          votos_nao?: number;
          votos_outros?: number;
          votos_sim?: number;
        };
        Relationships: [];
      };
      senado_votos_cache: {
        Row: {
          senador_id: number;
          sigla_partido: string | null;
          sigla_uf: string | null;
          tipo_voto: string;
          updated_at: string;
          votacao_id: string;
        };
        Insert: {
          senador_id: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          tipo_voto: string;
          updated_at?: string;
          votacao_id: string;
        };
        Update: {
          senador_id?: number;
          sigla_partido?: string | null;
          sigla_uf?: string | null;
          tipo_voto?: string;
          updated_at?: string;
          votacao_id?: string;
        };
        Relationships: [];
      };
      siconfi_relatorios_cache: {
        Row: {
          anexo: string | null;
          cod_conta: string | null;
          cod_ibge: string;
          coluna: string | null;
          conta: string | null;
          ente_nome: string;
          esfera: string;
          exercicio: number;
          id: string;
          periodicidade: string | null;
          periodo: number | null;
          tipo_relatorio: string;
          uf: string | null;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          anexo?: string | null;
          cod_conta?: string | null;
          cod_ibge: string;
          coluna?: string | null;
          conta?: string | null;
          ente_nome: string;
          esfera: string;
          exercicio: number;
          id: string;
          periodicidade?: string | null;
          periodo?: number | null;
          tipo_relatorio: string;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          anexo?: string | null;
          cod_conta?: string | null;
          cod_ibge?: string;
          coluna?: string | null;
          conta?: string | null;
          ente_nome?: string;
          esfera?: string;
          exercicio?: number;
          id?: string;
          periodicidade?: string | null;
          periodo?: number | null;
          tipo_relatorio?: string;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [];
      };
      transferegov_instrumentos_cache: {
        Row: {
          beneficiario_cnpj: string | null;
          beneficiario_nome: string | null;
          codigo_siconv: string | null;
          data_assinatura: string | null;
          data_fim_vigencia: string | null;
          data_inicio_vigencia: string | null;
          esfera_beneficiario: string | null;
          id: string;
          modalidade: string | null;
          municipio_ibge: string | null;
          municipio_nome: string | null;
          numero: string;
          objeto: string | null;
          orgao_concedente_cnpj: string | null;
          orgao_concedente_nome: string | null;
          situacao: string | null;
          uf_beneficiario: string | null;
          updated_at: string;
          url_transferegov: string | null;
          valor_contrapartida: number | null;
          valor_global: number | null;
          valor_repasse: number | null;
        };
        Insert: {
          beneficiario_cnpj?: string | null;
          beneficiario_nome?: string | null;
          codigo_siconv?: string | null;
          data_assinatura?: string | null;
          data_fim_vigencia?: string | null;
          data_inicio_vigencia?: string | null;
          esfera_beneficiario?: string | null;
          id: string;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero: string;
          objeto?: string | null;
          orgao_concedente_cnpj?: string | null;
          orgao_concedente_nome?: string | null;
          situacao?: string | null;
          uf_beneficiario?: string | null;
          updated_at?: string;
          url_transferegov?: string | null;
          valor_contrapartida?: number | null;
          valor_global?: number | null;
          valor_repasse?: number | null;
        };
        Update: {
          beneficiario_cnpj?: string | null;
          beneficiario_nome?: string | null;
          codigo_siconv?: string | null;
          data_assinatura?: string | null;
          data_fim_vigencia?: string | null;
          data_inicio_vigencia?: string | null;
          esfera_beneficiario?: string | null;
          id?: string;
          modalidade?: string | null;
          municipio_ibge?: string | null;
          municipio_nome?: string | null;
          numero?: string;
          objeto?: string | null;
          orgao_concedente_cnpj?: string | null;
          orgao_concedente_nome?: string | null;
          situacao?: string | null;
          uf_beneficiario?: string | null;
          updated_at?: string;
          url_transferegov?: string | null;
          valor_contrapartida?: number | null;
          valor_global?: number | null;
          valor_repasse?: number | null;
        };
        Relationships: [];
      };
      tse_bens_candidato_cache: {
        Row: {
          ano_eleicao: number;
          descricao: string | null;
          ordem_bem: number;
          sq_candidato: string;
          tipo_bem: string | null;
          tipo_bem_cod: string | null;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          ano_eleicao: number;
          descricao?: string | null;
          ordem_bem: number;
          sq_candidato: string;
          tipo_bem?: string | null;
          tipo_bem_cod?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          ano_eleicao?: number;
          descricao?: string | null;
          ordem_bem?: number;
          sq_candidato?: string;
          tipo_bem?: string | null;
          tipo_bem_cod?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [];
      };
      tse_candidatos_cache: {
        Row: {
          ano_eleicao: number;
          bens_total_declarado: number | null;
          cargo_cod: number | null;
          cargo_nome: string | null;
          cor_raca: string | null;
          cpf: string | null;
          genero: string | null;
          grau_instrucao: string | null;
          municipio_cod: string | null;
          nome_completo: string | null;
          nome_urna: string | null;
          nr_turno: number;
          numero_candidato: string | null;
          ocupacao: string | null;
          partido_numero: number | null;
          partido_sigla: string | null;
          situacao_candidatura: string | null;
          situacao_totalizacao: string | null;
          sq_candidato: string;
          titulo_eleitoral: string | null;
          uf: string | null;
          updated_at: string;
          url_prestacao_contas: string | null;
        };
        Insert: {
          ano_eleicao: number;
          bens_total_declarado?: number | null;
          cargo_cod?: number | null;
          cargo_nome?: string | null;
          cor_raca?: string | null;
          cpf?: string | null;
          genero?: string | null;
          grau_instrucao?: string | null;
          municipio_cod?: string | null;
          nome_completo?: string | null;
          nome_urna?: string | null;
          nr_turno?: number;
          numero_candidato?: string | null;
          ocupacao?: string | null;
          partido_numero?: number | null;
          partido_sigla?: string | null;
          situacao_candidatura?: string | null;
          situacao_totalizacao?: string | null;
          sq_candidato: string;
          titulo_eleitoral?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_prestacao_contas?: string | null;
        };
        Update: {
          ano_eleicao?: number;
          bens_total_declarado?: number | null;
          cargo_cod?: number | null;
          cargo_nome?: string | null;
          cor_raca?: string | null;
          cpf?: string | null;
          genero?: string | null;
          grau_instrucao?: string | null;
          municipio_cod?: string | null;
          nome_completo?: string | null;
          nome_urna?: string | null;
          nr_turno?: number;
          numero_candidato?: string | null;
          ocupacao?: string | null;
          partido_numero?: number | null;
          partido_sigla?: string | null;
          situacao_candidatura?: string | null;
          situacao_totalizacao?: string | null;
          sq_candidato?: string;
          titulo_eleitoral?: string | null;
          uf?: string | null;
          updated_at?: string;
          url_prestacao_contas?: string | null;
        };
        Relationships: [];
      };
      tse_despesas_campanha_cache: {
        Row: {
          ano_eleicao: number;
          cnpj_fornecedor: string | null;
          data: string | null;
          descricao: string | null;
          id: string;
          nome_fornecedor: string | null;
          sq_candidato: string;
          tipo_despesa: string | null;
          uf: string | null;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          ano_eleicao: number;
          cnpj_fornecedor?: string | null;
          data?: string | null;
          descricao?: string | null;
          id: string;
          nome_fornecedor?: string | null;
          sq_candidato: string;
          tipo_despesa?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          ano_eleicao?: number;
          cnpj_fornecedor?: string | null;
          data?: string | null;
          descricao?: string | null;
          id?: string;
          nome_fornecedor?: string | null;
          sq_candidato?: string;
          tipo_despesa?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [];
      };
      tse_parlamentar_candidato: {
        Row: {
          ano_eleicao: number;
          cpf: string | null;
          match_confianca: number;
          match_metodo: string;
          parlamentar_id: string;
          parlamentar_tipo: string;
          revisado: boolean;
          sq_candidato: string;
          updated_at: string;
        };
        Insert: {
          ano_eleicao: number;
          cpf?: string | null;
          match_confianca?: number;
          match_metodo: string;
          parlamentar_id: string;
          parlamentar_tipo: string;
          revisado?: boolean;
          sq_candidato: string;
          updated_at?: string;
        };
        Update: {
          ano_eleicao?: number;
          cpf?: string | null;
          match_confianca?: number;
          match_metodo?: string;
          parlamentar_id?: string;
          parlamentar_tipo?: string;
          revisado?: boolean;
          sq_candidato?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tse_receitas_campanha_cache: {
        Row: {
          ano_eleicao: number;
          cnpj_doador_originario: string | null;
          cpf_cnpj_doador: string | null;
          data: string | null;
          forma_recebimento: string | null;
          id: string;
          nome_doador: string | null;
          sq_candidato: string;
          tipo_doador: string | null;
          tipo_receita: string | null;
          uf: string | null;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          ano_eleicao: number;
          cnpj_doador_originario?: string | null;
          cpf_cnpj_doador?: string | null;
          data?: string | null;
          forma_recebimento?: string | null;
          id: string;
          nome_doador?: string | null;
          sq_candidato: string;
          tipo_doador?: string | null;
          tipo_receita?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          ano_eleicao?: number;
          cnpj_doador_originario?: string | null;
          cpf_cnpj_doador?: string | null;
          data?: string | null;
          forma_recebimento?: string | null;
          id?: string;
          nome_doador?: string | null;
          sq_candidato?: string;
          tipo_doador?: string | null;
          tipo_receita?: string | null;
          uf?: string | null;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [];
      };
      tse_resultados_cache: {
        Row: {
          ano_eleicao: number;
          municipio_cod: string;
          municipio_nome: string | null;
          nr_turno: number;
          situacao_totalizacao: string | null;
          sq_candidato: string;
          uf: string;
          updated_at: string;
          votos_nominais: number;
          votos_nominais_validos: number;
        };
        Insert: {
          ano_eleicao: number;
          municipio_cod: string;
          municipio_nome?: string | null;
          nr_turno?: number;
          situacao_totalizacao?: string | null;
          sq_candidato: string;
          uf: string;
          updated_at?: string;
          votos_nominais?: number;
          votos_nominais_validos?: number;
        };
        Update: {
          ano_eleicao?: number;
          municipio_cod?: string;
          municipio_nome?: string | null;
          nr_turno?: number;
          situacao_totalizacao?: string | null;
          sq_candidato?: string;
          uf?: string;
          updated_at?: string;
          votos_nominais?: number;
          votos_nominais_validos?: number;
        };
        Relationships: [];
      };
      tse_varredura: {
        Row: {
          atualizado_em: string;
          chave: string;
          completa: boolean;
          importados: number;
          linhas_processadas: number;
        };
        Insert: {
          atualizado_em?: string;
          chave: string;
          completa?: boolean;
          importados?: number;
          linhas_processadas?: number;
        };
        Update: {
          atualizado_em?: string;
          chave?: string;
          completa?: boolean;
          importados?: number;
          linhas_processadas?: number;
        };
        Relationships: [];
      };
      user_flags: {
        Row: {
          comentario: string | null;
          created_at: string;
          entidade_id: string;
          entidade_tipo: string;
          id: string;
          tipo: string;
          user_id: string;
        };
        Insert: {
          comentario?: string | null;
          created_at?: string;
          entidade_id: string;
          entidade_tipo: string;
          id?: string;
          tipo: string;
          user_id: string;
        };
        Update: {
          comentario?: string | null;
          created_at?: string;
          entidade_id?: string;
          entidade_tipo?: string;
          id?: string;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      votos_flag: {
        Row: {
          created_at: string;
          flag_id: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          flag_id: string;
          user_id: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          flag_id?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "votos_flag_flag_id_fkey";
            columns: ["flag_id"];
            isOneToOne: false;
            referencedRelation: "user_flags";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      camara_gasto_por_deputado: {
        Row: {
          deputado_id: number | null;
          total: number | null;
        };
        Relationships: [];
      };
      senado_gasto_por_senador: {
        Row: {
          senador_id: number | null;
          total: number | null;
        };
        Relationships: [];
      };
      v_fornecedor_doador: {
        Row: {
          ano_eleicao: number | null;
          cnpj: string | null;
          cnpj_fornecedor_formatado: string | null;
          data_doacao: string | null;
          nome_doador: string | null;
          nome_fornecedor_contratos: string | null;
          sq_candidato: string | null;
          valor_doado: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      camara_gasto_total: { Args: never; Returns: number };
      cobertura_camara_ceap: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_camara_proposicoes: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_camara_votacoes: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_cgu: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          orgao_cod: string;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_cgu_convenios: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_cgu_emendas: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_cgu_licitacoes: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          orgao_cod: string;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_pncp: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_senado_ceaps: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_senado_materias: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_senado_votacoes: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      cobertura_siconfi: {
        Args: never;
        Returns: {
          ano: number;
          periodo: number;
          qtd: number;
          tipo_relatorio: string;
          ultimo: string;
        }[];
      };
      cobertura_tentativas: {
        Args: never;
        Returns: {
          ano: number;
          escopo: string;
          fonte: string;
          mes: number;
          tentativas: number;
          ultimo: string;
        }[];
      };
      cobertura_transferegov: {
        Args: never;
        Returns: {
          ano: number;
          mes: number;
          qtd: number;
          ultimo: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      limpar_cache_por_ano: {
        Args: {
          _ano_col: string;
          _ano_fim: number;
          _ano_ini: number;
          _tabela: string;
        };
        Returns: number;
      };
      qa_finding_publico: {
        Args: { _id: string };
        Returns: {
          detalhes: Json;
          detectado_em: string;
          entidade_id: string;
          entidade_tipo: string;
          fonte: string;
          id: string;
          origem: string;
          regra: string;
          reportado_em: string;
          reporte_canal: string;
          reporte_protocolo: string;
          resolvido_em: string;
          revalidado_em: string;
          severidade: string;
          status: string;
          tipo: string;
          valor_armazenado: number;
          valor_esperado: number;
        }[];
      };
      qa_findings_agregado: {
        Args: never;
        Returns: {
          abertos: number;
          confirmados: number;
          corrigidos: number;
          criticos: number;
          falsos_positivos: number;
          fonte: string;
          investigativos: number;
          lacunas: number;
          qualidade: number;
          reportados: number;
          total: number;
        }[];
      };
      qa_findings_publicos: {
        Args: {
          _fonte?: string;
          _limit?: number;
          _regra?: string;
          _status?: string;
          _tipo?: string;
        };
        Returns: {
          detectado_em: string;
          entidade_id: string;
          entidade_tipo: string;
          fonte: string;
          id: string;
          origem: string;
          regra: string;
          reportado_em: string;
          reporte_canal: string;
          reporte_protocolo: string;
          resolvido_em: string;
          revalidado_em: string;
          severidade: string;
          status: string;
          tipo: string;
          valor_armazenado: number;
          valor_esperado: number;
        }[];
      };
      senado_gasto_total: { Args: never; Returns: number };
      tabela_cache_limpavel: { Args: { _tabela: string }; Returns: boolean };
      truncar_cache: { Args: { _tabela: string }; Returns: number };
      tse_candidatos_sem_bens: {
        Args: { _ano: number };
        Returns: {
          cargo_nome: string;
          nome_urna: string;
          sq_candidato: string;
          uf: string;
        }[];
      };
      tse_contagem_ano_uf: {
        Args: never;
        Returns: {
          ano_eleicao: number;
          candidatos: number;
          uf: string;
        }[];
      };
      tse_doacoes_de_fornecedores: {
        Args: { _minimo: number };
        Returns: {
          ano_eleicao: number;
          cnpj: string;
          cnpj_formatado: string;
          data_doacao: string;
          match_confianca: number;
          nome_doador: string;
          nome_fornecedor: string;
          parlamentar_id: string;
          parlamentar_tipo: string;
          sq_candidato: string;
          valor_doado: number;
        }[];
      };
      tse_eleitos_sem_contas: {
        Args: { _ano: number };
        Returns: {
          cargo_nome: string;
          municipio_cod: string;
          nome_urna: string;
          sq_candidato: string;
          uf: string;
        }[];
      };
      tse_evolucao_patrimonial: {
        Args: { _minimo_final: number; _multiplo: number };
        Returns: {
          ano_anterior: number;
          ano_recente: number;
          bens_anterior: number;
          bens_recente: number;
          cpf: string;
          nome_urna: string;
          sq_anterior: string;
          sq_recente: string;
          uf: string;
        }[];
      };
      tse_fornecedor_concentrado: {
        Args: { _ano: number; _fracao_minima: number; _min_candidatos: number };
        Returns: {
          candidatos: number;
          cnpj_fornecedor: string;
          fracao: number;
          nome_fornecedor: string;
          partido_sigla: string;
          total_fornecedor: number;
          total_grupo: number;
          uf: string;
        }[];
      };
      tse_resumo_eleicoes: {
        Args: never;
        Returns: {
          ano_eleicao: number;
          cargo_cod: number;
          cargo_nome: string;
          eleitos: number;
          total: number;
          ufs: number;
        }[];
      };
      tse_resumo_partido: {
        Args: { _sigla: string };
        Returns: {
          ano_eleicao: number;
          bens_medio: number;
          cargo_nome: string;
          eleitos: number;
          total: number;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "curador" | "cidadao";
      lacuna_ciclo: "nasce" | "qualificada" | "evolui" | "conecta" | "encerra";
      lacuna_tipo:
        | "transparencia"
        | "avaliacao"
        | "mensuracao"
        | "documental"
        | "institucional"
        | "metodologica";
      pergunta_item_tipo:
        | "contrato"
        | "orgao"
        | "fornecedor"
        | "lacuna"
        | "finding"
        | "link"
        | "anotacao"
        | "convenio"
        | "parlamentar"
        | "votacao"
        | "anomalia"
        | "prompt"
        | "emenda"
        | "licitacao";
      pergunta_status: "privada" | "em_revisao" | "publicada" | "arquivada" | "encerrada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "curador", "cidadao"],
      lacuna_ciclo: ["nasce", "qualificada", "evolui", "conecta", "encerra"],
      lacuna_tipo: [
        "transparencia",
        "avaliacao",
        "mensuracao",
        "documental",
        "institucional",
        "metodologica",
      ],
      pergunta_item_tipo: [
        "contrato",
        "orgao",
        "fornecedor",
        "lacuna",
        "finding",
        "link",
        "anotacao",
        "convenio",
        "parlamentar",
        "votacao",
        "anomalia",
        "prompt",
        "emenda",
        "licitacao",
      ],
      pergunta_status: ["privada", "em_revisao", "publicada", "arquivada", "encerrada"],
    },
  },
} as const;
