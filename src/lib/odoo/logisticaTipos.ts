// Tipos, rótulos e funções puras da logística do Odoo (motor de carga/NF
// 5117/estoque, exposto pela ponte HTTP da Lojas Maia em /api/odoo).
// Este arquivo NÃO fala com a rede e NÃO tem segredo -- pode ser importado
// por componente client. O cliente HTTP (com a chave) mora em
// ./logistica.ts e só roda no servidor. Contrato completo em
// docs/LOGISTICA-ODOO.md.

export type CategoriaVolume = "colchao" | "base" | "estofado" | "movel" | "acessorio" | "outros";
export type VolumesPorCategoria = Partial<Record<CategoriaVolume | string, number>>;

export const CATEGORIA_LABELS: Record<string, string> = {
  colchao: "Colchões",
  base: "Bases",
  estofado: "Estofados",
  movel: "Móveis",
  acessorio: "Acessórios",
  outros: "Outros",
};
export const CATEGORIA_ORDEM: CategoriaVolume[] = ["colchao", "base", "estofado", "movel", "acessorio", "outros"];

export type EstadoCarga = "montagem" | "separacao" | "conferida" | "liberada" | "em_rota" | "finalizada";
export const ESTADOS_CARGA: EstadoCarga[] = ["montagem", "separacao", "conferida", "liberada", "em_rota", "finalizada"];
export const ESTADO_CARGA_LABELS: Record<EstadoCarga, string> = {
  montagem: "Montagem",
  separacao: "Separação",
  conferida: "Conferida",
  liberada: "Liberada",
  em_rota: "Em rota",
  finalizada: "Finalizada",
};

export type TipoCarga = "entrega" | "retira_agendada" | "abastecimento" | string;
export const TIPO_CARGA_LABELS: Record<string, string> = {
  entrega: "Entrega (baú)",
  retira_agendada: "Retira agendada / ABA",
  abastecimento: "Abastecimento de loja",
};

export const MODO_LABELS: Record<string, string> = {
  entrega: "Entrega",
  expresso: "Expresso",
  retira_depois: "Retira depois (ABA/CD)",
  na_hora: "Levou na hora",
};

export type ResultadoParada = "entregue" | "entrega_parcial" | "insucesso" | "reagendada";
export const RESULTADO_LABELS: Record<ResultadoParada, string> = {
  entregue: "Entregue",
  entrega_parcial: "Entrega parcial",
  insucesso: "Não entregue",
  reagendada: "Reagendada",
};

// Transições do maia_entrega na ordem do CD. "sair" = faturar a carga:
// emite a NF-e 5117 de cada pedido com 5922 (ver cargas_api.py, acao()).
export type AcaoCarga = "separacao" | "conferir" | "liberar" | "sair" | "finalizar";
export const PROXIMA_ACAO: Record<EstadoCarga, { acao: AcaoCarga; label: string } | null> = {
  montagem: { acao: "separacao", label: "Iniciar separação" },
  separacao: { acao: "conferir", label: "Marcar conferida" },
  conferida: { acao: "liberar", label: "Liberar (motorista + veículo)" },
  liberada: { acao: "sair", label: "Sair em rota · emite as NF 5117" },
  em_rota: { acao: "finalizar", label: "Fim de rota" },
  finalizada: null,
};
// Enquanto não saiu, a carga ainda é editável (remover pedido, reordenar,
// excluir, descrição/transportadora/data).
export const ESTADOS_EDITAVEIS: EstadoCarga[] = ["montagem", "separacao", "conferida", "liberada"];

export type AcaoCargaExtra = "motorista" | "programar" | "descricao" | "transportadora" | "excluir" | "romaneio" | "danfes" | "baixar_entrega" | "adicionar";
export type AcaoEntrega =
  | "pendencia"
  | "fila"
  | "transferir_filial"
  | "programar"
  | "anotar"
  | "historico"
  | "remover_da_carga"
  | "mover_carga"
  | "retirada_cd"
  | "estornar";

export const ACAO_ENTREGA_LABELS: Record<AcaoEntrega, string> = {
  pendencia: "Enviar para pendência",
  fila: "Voltar à fila",
  transferir_filial: "Transferir filial",
  programar: "Data programada",
  anotar: "Anotação",
  historico: "Histórico",
  remover_da_carga: "Remover da carga",
  mover_carga: "Transferir para outra carga",
  retirada_cd: "Cliente/fretista retirou no CD",
  estornar: "Estornar entrega",
};

// ---------------------------------------------------------------- payloads

export type ItemEntrega = {
  codigo: string | false;
  nome: string;
  qtd: number;
  reservado: number;
  categoria: string;
};

// Uma saída pendente (stock.picking de saída) -- linha da fila de expedição.
export type EntregaOdoo = {
  picking_id: number;
  nome: string;
  estado: string;
  cliente: string;
  cliente_id: number;
  telefone: string;
  endereco: string;
  cep: string;
  zona: string;
  zona_id: number | false;
  data_programada: string | false;
  origem: string;
  pedido: string;
  pedido_id: number | false;
  vendedor?: string;
  modo: string;
  nf5922: string;
  nf5117: string;
  legado: boolean;
  zae: string;
  carga_id: number | false;
  carga: string;
  pendencia: boolean;
  pendencia_motivo: string;
  anotacao: string;
  /** 27/10: observação do vendedor (nota do pedido, sem a parte técnica de entrega/pagamento) */
  obs?: string;
  filial_entrega: string;
  dias: number | null;
  volumes: number;
  volumes_por_categoria: VolumesPorCategoria;
  itens: ItemEntrega[];
  // Ainda NÃO vem do Odoo (ver docs, "o que falta"): marca a saída que
  // voltou de uma tentativa sem sucesso. A tela já filtra por ele quando
  // existir.
  retorno?: boolean;
  // 26/10: ABA = loja onde o cliente retira (Rafael não achava a filial de destino)
  retira_em?: string;
  abastece?: string;
  // 26/10: venda EXPRESS (filtro "Entrega" não pode misturar)
  expresso?: boolean;
  // 27/10: Expedição juntando todas as empresas (como a aba Cargas): de qual fila (empresa) a saída veio
  empresa_id?: number;
  empresa_nome?: string;
  // 27/10 (Pedro/John): chave da 5117 (vai com a mercadoria) e da 5922 (venda), inclusive do sistema antigo -> imprimir DANFE
  chave5117?: string;
  chave5922?: string;
};

export type ExpedicaoResposta = {
  ok: true;
  company_id: number;
  total: number;
  por_zona: Record<string, number>;
  entregas: EntregaOdoo[];
  pendencias: EntregaOdoo[];
  total_pendencias: number;
};

export type ItemParada = { codigo: string; nome: string; qtd: number };
export type PickingParada = { picking_id: number; nome: string; pedido: string; pedido_id?: number | false; vendedor?: string; estado: string; itens?: ItemParada[]; legado?: boolean; chave5117?: string; chave5922?: string };
// 26/10: entrega parcial leva o que foi entregue de cada item; o resto volta para o CD (reentrega)
export type ItemEntregue = { codigo: string; qtd_entregue: number };

export type ParadaOdoo = {
  parada_id: number;
  seq: number;
  seq_executada: number | false;
  cliente: string;
  cliente_id: number;
  endereco: string;
  telefone: string;
  resultado: ResultadoParada | false;
  tempo_min: number | false;
  pickings: PickingParada[];
};

export type EventoCarga = {
  id: number;
  tipo: string;
  em: string | false;
  origem: string;
  parada_id: number | false;
  picking: string;
  motorista: string;
  motivo: string;
  prova: boolean;
  lat: number | false;
  lng: number | false;
};

export type CargaOdoo = {
  company_id: number;
  empresa?: string;
  carga_id: number;
  romaneio: string;
  tipo: TipoCarga;
  estado: EstadoCarga;
  zona: string;
  zona_id: number | false;
  motorista: string;
  motorista_id: number | false;
  veiculo: string;
  veiculo_id: number | false;
  ajudantes: string[];
  qtd_paradas: number;
  qtd_pedidos: number;
  liberada_em: string | false;
  saiu_em: string | false;
  fim_rota_em: string | false;
  criada_em: string | false;
  data_prevista: string;
  descricao: string;
  transportadora: string;
  cancelada: boolean;
  volumes: number;
  volumes_por_categoria: VolumesPorCategoria;
  paradas?: ParadaOdoo[];
  eventos?: EventoCarga[];
};

export type CargaDetalhe = CargaOdoo & { paradas: ParadaOdoo[]; eventos: EventoCarga[] };

export type NotaSaida = {
  pedido: string;
  nf5117: string | null;
  chave?: string | null;
  xml_erro?: string | null;
  legado?: boolean;
  parcial?: boolean;
  pendente?: unknown;
  ok?: boolean;
  erro?: string | null;
  aviso?: string;
};

export type AcaoCargaResposta = CargaDetalhe & { acao: string; notas?: NotaSaida[] };

export type CatalogosOdoo = {
  zonas: { id: number; codigo: string; nome: string; tipo: string; dias: string }[];
  motoristas: { id: number; nome: string; cargo: string }[];
  veiculos: { id: number; nome: string; placa: string }[];
  motivos: { id: number; codigo: string; nome: string; alerta: boolean }[];
  estados_carga: Record<string, string>;
  tipos_carga: Record<string, string>;
};

export type EmpresaOdoo = { id: number; name: string };

export type DanfeCarga = {
  pedido_id: number;
  pedido: string;
  cliente: string;
  nf5117: string;
  estado: string;
  tem_pdf: boolean;
  tipo?: string; // 26/10: "5152" (transferência) | "5922" (nota do cliente) | ausente = 5117
  chave?: string;
};

export type HistoricoEntrega = {
  picking: string;
  pedido: string;
  zae: string | false;
  historico: { em: string | false; quem: string; texto: string }[];
};

export type ResultadoParadaResposta = {
  carga_id: number;
  parada_id: number;
  resultado: ResultadoParada;
  seq_executada: number | false;
  pendentes: number;
  estado_carga: EstadoCarga;
};

export type MontarCargaInput = {
  company_id: number;
  picking_ids: number[];
  tipo: string;
  zona_id?: number | null;
  motorista_id?: number | null;
  veiculo_id?: number | null;
  ajudante_ids?: number[] | null;
  descricao?: string | null;
  transportadora?: string | null;
  data_prevista?: string | null; // AAAA-MM-DD
  operador: string;
};

export type RegistrarParadaInput = {
  resultado: ResultadoParada;
  motivo?: string | null; // código do maia.motivo.insucesso (obrigatório no insucesso)
  geo_lat?: number | null;
  geo_lng?: number | null;
  origem?: "app" | "odoo";
  motorista_id?: number | null;
  obs?: string | null; // Odoo corta em 500 caracteres
  itens?: ItemEntregue[] | null; // obrigatório na entrega_parcial
  // UUID gerado no celular no toque do botão (fila offline da PWA). A ponte
  // ainda IGNORA este campo (lê só os de cima com d.get) -- quando o Odoo
  // aceitar, deve deduplicar por ele. Ver docs/LOGISTICA-ODOO.md (PWA).
  evento_uid?: string | null;
};

// ---------------------------------------------------------------- funções puras

export function somarVolumes(lista: { volumes_por_categoria?: VolumesPorCategoria }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of lista) {
    for (const [cat, qtd] of Object.entries(item.volumes_por_categoria ?? {})) {
      out[cat] = (out[cat] ?? 0) + (qtd ?? 0);
    }
  }
  return out;
}

export function volumesOrdenados(vols: VolumesPorCategoria): { categoria: string; label: string; qtd: number }[] {
  const conhecidas = CATEGORIA_ORDEM.filter((c) => (vols[c] ?? 0) > 0).map((c) => ({
    categoria: c,
    label: CATEGORIA_LABELS[c],
    qtd: vols[c] ?? 0,
  }));
  const extras = Object.entries(vols)
    .filter(([c, q]) => !(CATEGORIA_ORDEM as string[]).includes(c) && (q ?? 0) > 0)
    .map(([c, q]) => ({ categoria: c, label: CATEGORIA_LABELS[c] ?? c, qtd: q ?? 0 }));
  return [...conhecidas, ...extras];
}

export const SEM_ZONA = "(sem zona)";

export type VisaoExpedicao = "fila" | "pendencias" | "retornos";

export type FiltroExpedicao = {
  visao: VisaoExpedicao;
  zona: string; // "" = todas, SEM_ZONA = sem região, senão nome da zona
  modo: string; // "" = todos
  busca: string;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarExpedicao(fila: EntregaOdoo[], pendencias: EntregaOdoo[], f: FiltroExpedicao): EntregaOdoo[] {
  const origem = f.visao === "pendencias" ? pendencias : f.visao === "retornos" ? [...fila, ...pendencias].filter((e) => e.retorno) : fila;
  const q = normalizar(f.busca);
  return origem.filter((e) => {
    // 26/10 (Jhon): "Entrega" não mistura o Expresso; "Expresso" só o Expresso
    if (f.modo === "expresso") {
      if (!e.expresso) return false;
    } else if (f.modo) {
      if (e.modo !== f.modo) return false;
      if (f.modo === "entrega" && e.expresso) return false;
    }
    if (f.zona === SEM_ZONA ? !!e.zona : f.zona && e.zona !== f.zona) return false;
    if (!q) return true;
    const alvo = normalizar([e.cliente, e.pedido, e.endereco, e.cep, e.nf5922, e.nf5117, e.origem, e.nome, e.telefone, e.expresso ? "express expresso" : "", e.retira_em ? "retira " + e.retira_em : ""].join(" "));
    return alvo.includes(q);
  });
}

// Zona sugerida para a carga: se todas as saídas selecionadas são da mesma
// zona, usa ela (mesma regra do montar() no Odoo).
export function zonaUnica(selecionadas: EntregaOdoo[]): number | null {
  const ids = new Set(selecionadas.map((e) => e.zona_id).filter((z): z is number => typeof z === "number" && z > 0));
  return ids.size === 1 ? [...ids][0] : null;
}

export function moverItem<T>(lista: T[], indice: number, direcao: -1 | 1): T[] {
  const destino = indice + direcao;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

// Datas do Odoo vêm em UTC sem fuso ("2026-10-24 21:10:03").
export function dataOdooParaDate(valor: string | false | null | undefined): Date | null {
  if (!valor) return null;
  const iso = valor.includes("T") ? valor : valor.replace(" ", "T");
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatarDataHoraOdoo(valor: string | false | null | undefined): string {
  const d = dataOdooParaDate(valor);
  if (!d) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatarDiaIso(valor: string | false | null | undefined): string {
  if (!valor) return "—";
  const [y, m, d] = valor.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : valor;
}

export function nomeNormalizado(nome: string): string {
  return normalizar(nome).replace(/\s+/g, " ");
}

// Junta a observação do motorista com os links das fotos do comprovante
// (a API do Odoo ainda não recebe arquivo; o link vai no texto). Respeita
// o corte de 500 caracteres do Odoo priorizando os links.
export function montarObservacao(obs: string | null | undefined, fotoUrls: string[], limite = 500): string | null {
  const links = fotoUrls.length ? `fotos: ${fotoUrls.join(" ")}` : "";
  const texto = (obs ?? "").trim();
  if (!texto && !links) return null;
  if (!links) return texto.slice(0, limite);
  const espaco = limite - links.length - 3;
  if (espaco <= 0) return links.slice(0, limite);
  return texto ? `${texto.slice(0, espaco)} | ${links}` : links;
}

// Retorno das server actions da logística: erro volta como DADO (não
// throw), porque em produção o Next troca a mensagem de erro lançado numa
// Server Action por um texto genérico -- e o operador precisa ler o motivo
// real que o Odoo deu (ex.: "liberar exige motorista + veículo").
export type ResultadoAcao<T> = { ok: true; dados: T } | { ok: false; erro: string };

// Pedidos de abastecimento das lojas (25/10/2026): a loja pede no caixa,
// o CD atende aqui -> NF 5152 CD -> loja (maia_caixa/abastecimento_loja.py).
export type ItemSolicitacaoAbast = { codigo: string; nome: string; qtd: number; saldo_cd: number; saldo_loja: number };
export type SolicitacaoAbast = {
  id: number;
  nome: string;
  loja: string;
  company_id: number;
  estado: "aberta" | "cancelada" | string;
  criado: string;
  obs: string;
  solicitante: string;
  itens: ItemSolicitacaoAbast[];
  historico: { data: string; texto: string }[];
};
export type AtenderAbastResposta = {
  saida?: string;
  entrada?: string;
  numero?: string | number;
  solicitacao?: SolicitacaoAbast;
  // 26/10: dados da NF 5152 emitida (chave -> imprimir DANFE)
  transferencia?: { numero?: string | number; serie?: string; chave?: string; estado?: string; saida?: string; entrada?: string };
};
