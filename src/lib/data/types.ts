export type Orgao = {
  cod: string;
  nome: string;
  sigla: string;
  funcao: string;
  /** Poder/ramo do órgão. Define qual API/fluxo serve seus dados. */
  poder: "executivo" | "legislativo" | "judiciario" | "mpu" | "outros";
  /**
   * `true` se o endpoint /contratos do Portal da Transparência (CGU) cobre
   * este órgão. A maioria dos órgãos do Executivo é coberta; Legislativo,
   * Judiciário e MPU têm APIs próprias (dados.camara, dados.senado, etc.).
   */
  disponivelPortal: boolean;
  /** Nota explicativa opcional — fonte alternativa, observações, etc. */
  nota?: string;
  /**
   * Rota interna que já cobre este órgão por meio de uma integração própria
   * (fora do endpoint /contratos do Portal da Transparência). Ex.: `/camara`
   * para a Câmara dos Deputados.
   */
  rotaPropria?: string;
};

export type Fornecedor = {
  cnpj: string;
  nome: string;
};

export type Contrato = {
  id: string;
  orgaoCod: string;
  fornecedorCnpj: string;
  objeto: string;
  modalidade: "pregao" | "dispensa" | "inexigibilidade" | "concorrencia";
  valor: number;
  ano: number;
  dataAssinatura: string;
};

export type SerieAnual = { ano: number; valor: number };

export type Anomalia = {
  id: string;
  entidadeTipo: "orgao" | "fornecedor" | "contrato";
  entidadeId: string;
  entidadeNome: string;
  regra: string;
  severidade: "baixa" | "media" | "alta";
  titulo: string;
  explicacao: string;
  evidencia: Record<string, string | number>;
};

export type DataSource = {
  isReady(): boolean;
  listOrgaos(): Orgao[];
  getOrgao(cod: string): Orgao | null;
  serieAnualOrgao(cod: string): SerieAnual[];
  contratosOrgao(cod: string): Contrato[];
  getFornecedor(cnpj: string): Fornecedor | null;
  contratosFornecedor(cnpj: string): Contrato[];
  serieAnualFornecedor(cnpj: string): SerieAnual[];
  getContrato(id: string): Contrato | null;
  listAnomalias(): Anomalia[];
};
