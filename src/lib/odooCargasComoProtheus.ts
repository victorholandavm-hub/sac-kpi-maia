import type { getSupabaseAdmin } from "./supabaseAdmin";
import type { CargaDetalhe, EventoCarga, ParadaOdoo } from "./odoo/logisticaTipos";
import { consultarPedidosOdoo } from "./consultaOdooPonte";

// Cargas do Odoo gravadas no formato das do Protheus (totvs_deliveries /
// totvs_delivery_cargas / totvs_delivery_carga_itens) -- Victor 29/10/2026:
// "a tela de KPIs, os dados pararam de chegar". Os KPIs de logística (rotas do
// dia, índice de volta, motivos, cargas, notas) são funções SQL sobre essas
// tabelas e pararam em 26/10, quando o Protheus congelou. Em vez de reescrever
// tudo, cada pedido de cada carga do Odoo vira a linha que o Protheus gravava:
// mesmos códigos de situação, mesmo motorista (casado pelo nome) e o motivo do
// "não entregue" num código no padrão do Protheus. Pedido como "ODOO-S01234"
// (o mesmo nome que a compat do Pedro já usava).

type Admin = ReturnType<typeof getSupabaseAdmin>;

export const PREFIXO_ODOO = "ODOO-";

const normalizarNome = (n: string) =>
  n
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const SITUACAO_CARGA: Record<string, [string, string]> = {
  montagem: ["0", "Em Montagem"],
  separacao: ["1", "Em Separação"],
  conferida: ["2", "Conferida"],
  liberada: ["4", "Liberada"],
  em_rota: ["5", "Em Rota"],
  finalizada: ["6", "Encerrada"],
};

const RESULTADO: Record<string, [string, string]> = {
  entregue: ["1", "Entregue"],
  entrega_parcial: ["2", "Entregue Parcial"],
  insucesso: ["3", "Não Entregue"],
  reagendada: ["3", "Não Entregue"],
};

// Motivo do Odoo -> código no padrão do Protheus (a 1ª letra é a categoria nos KPIs).
export const MOTIVO_COMO_PROTHEUS: Record<string, { codigo: string; descricao: string; categoria: string }> = {
  cliente_ausente: { codigo: "C01", descricao: "Cliente Ausente", categoria: "Cliente" },
  recusa_cliente: { codigo: "C02", descricao: "Recusa Total do Cliente", categoria: "Cliente" },
  endereco_nao_encontrado: { codigo: "C04", descricao: "Endereço não Localizado", categoria: "Cliente" },
  reagendado_pelo_cliente: { codigo: "C05", descricao: "Reagendado pelo Cliente", categoria: "Cliente" },
  sem_acesso_local: { codigo: "C06", descricao: "Sem Acesso ao Local", categoria: "Cliente" },
  nao_saiu_cd: { codigo: "L06", descricao: "Pedido não foi Carregado", categoria: "Logística" },
  veiculo_quebrou: { codigo: "L02", descricao: "Veículo Quebrou ou Acidente", categoria: "Logística" },
  avaria_no_transporte: { codigo: "L07", descricao: "Avaria no Transporte", categoria: "Logística" },
  produto_errado_incompleto: { codigo: "E05", descricao: "Produto Errado/Incompleto", categoria: "Estoque" },
  pagamento_pendente: { codigo: "F02", descricao: "Pagamento Pendente", categoria: "Fiscal" },
};

// O evento da baixa traz o nome do motivo ("Cliente ausente"), não o código.
const NOME_DO_MOTIVO: Record<string, string> = {
  "CLIENTE AUSENTE": "cliente_ausente",
  "ENDERECO NAO ENCONTRADO": "endereco_nao_encontrado",
  "RECUSA DO CLIENTE": "recusa_cliente",
  "AVARIA NO TRANSPORTE": "avaria_no_transporte",
  "PRODUTO ERRADO INCOMPLETO": "produto_errado_incompleto",
  "SEM ACESSO AO LOCAL": "sem_acesso_local",
  "PAGAMENTO PENDENTE": "pagamento_pendente",
  "REAGENDADO PELO CLIENTE": "reagendado_pelo_cliente",
  "VEICULO QUEBROU": "veiculo_quebrou",
  "NAO SAIU DO CD": "nao_saiu_cd",
};

export function motivoComoProtheus(motivo: string | null | undefined): { codigo: string; descricao: string; categoria: string } | null {
  const m = (motivo ?? "").trim();
  if (!m) return null;
  const chave = MOTIVO_COMO_PROTHEUS[m] ? m : NOME_DO_MOTIVO[normalizarNome(m)];
  return chave ? MOTIVO_COMO_PROTHEUS[chave] : { codigo: "X99", descricao: m.slice(0, 80), categoria: "Externo" };
}

// Transportadora como o Protheus escrevia (transportadoras_logistica dá o vínculo).
export function transportadoraComoProtheus(t: string | null | undefined): string | null {
  const s = (t ?? "").trim();
  if (!s) return null;
  if (/maia/i.test(s)) return "TRANSP. LOJAS MAIA";
  if (/^d\s*&\s*a$/i.test(s)) return "TRANSP. D&A";
  if (/^expresso$/i.test(s)) return "EXPRESSA";
  return s.toUpperCase();
}

// "Volkswagen/8.150E DELIVERY/NHX4E86" -> "NHX4E86" (a placa, como no Protheus).
export const placaDoVeiculo = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? (s.split("/").pop() ?? s).trim().toUpperCase() : null;
};


export type MotoristaProtheus = { codigo: string; nome: string | null; transportadora: string | null };

// Motorista do Odoo -> código do Protheus pelo nome ("Joalison Ferreira" =
// "JOALISON FERREIRA (AIAM EXPRESSO)"); sem par, "O<id do Odoo>".
export function casarMotorista(nome: string, id: number | false, protheus: MotoristaProtheus[]): MotoristaProtheus | null {
  if (!nome?.trim()) return null;
  const alvo = normalizarNome(nome);
  // Nome inteiro igual; senão, o único do Protheus que começa pelo nome do Odoo ("Eduardo" = "EDUARDO HENRIQUE").
  const prefixo = protheus.filter((m) => m.nome && normalizarNome(m.nome).startsWith(`${alvo} `));
  const achado = protheus.find((m) => m.nome && normalizarNome(m.nome) === alvo) ?? (prefixo.length === 1 ? prefixo[0] : undefined);
  return achado ?? { codigo: `O${id || alvo}`, nome: nome.trim().toUpperCase(), transportadora: null };
}

const RECIFE = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
// "2026-10-29 09:53:23" (UTC do Odoo) -> ["2026-10-29", "06:53"] em Recife.
export function diaHoraRecife(utc: string | false | null | undefined): [string, string] | null {
  if (!utc || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(utc)) return null;
  const d = new Date(`${utc.slice(0, 19).replace(" ", "T")}Z`);
  if (isNaN(d.getTime())) return null;
  const [dia, hora] = RECIFE.format(d).split(" ");
  return [dia, hora];
}

export type EntregaProtheus = { pedido: string; filialPadrao: string; clienteId: string | null; cliente: string | null; statusAtual: string };
export type CargaProtheus = {
  pedido: string;
  carga: string;
  dt_previsao: string | null;
  tipo_entrega: string;
  status_carga: string;
  status_carga_codigo: string;
  status_entrega: string;
  status_entrega_codigo: string;
  status_origem: "CARGA" | "ENTREGA";
  motorista_codigo: string | null;
  motorista_nome: string | null;
  transportadora: string | null;
  veiculo: string | null;
  regiao: string | null;
  nota_fiscal: string | null;
  serie: string | null;
  dt_retorno: string | null;
  hr_retorno: string | null;
  ocorrencia_codigo: string | null;
  ocorrencia_descricao: string | null;
  ocorrencia_categoria: string | null;
  ocorrencia_nivel: string | null;
  itens: { produto: string; descricao: string | null; quantidade: number }[];
};

function baixaDaParada(p: ParadaOdoo, eventos: EventoCarga[]): EventoCarga | null {
  return (
    eventos
      .filter((e) => e.parada_id === p.parada_id && RESULTADO[e.tipo])
      .sort((a, b) => String(b.em || "").localeCompare(String(a.em || "")))[0] ?? null
  );
}

// Dia da carga = data prevista (como a ZAG_DTPREV do Protheus); sem ela, o dia em que saiu ou foi criada.
function diaDaCarga(c: CargaDetalhe): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(c.data_prevista ?? "")) return c.data_prevista.slice(0, 10);
  return diaHoraRecife(c.saiu_em || c.criada_em)?.[0] ?? null;
}

// Uma carga do Odoo -> as linhas do Protheus (uma por pedido). Carga de
// abastecimento (CD -> loja) e cancelada não entram.
export function cargaComoProtheus(c: CargaDetalhe, motoristas: MotoristaProtheus[]): { entregas: EntregaProtheus[]; cargas: CargaProtheus[] } {
  if (c.cancelada || c.tipo === "abastecimento") return { entregas: [], cargas: [] };
  const [codCarga, rotuloCarga] = SITUACAO_CARGA[c.estado] ?? ["0", c.estado];
  const tipo = c.tipo === "retira_agendada" ? "Retirada" : /expres/i.test(`${c.descricao} ${c.zona}`) ? "Express" : "Entrega";
  const motorista = casarMotorista(c.motorista, c.motorista_id, motoristas);
  const transportadora = transportadoraComoProtheus(c.transportadora) ?? motorista?.transportadora ?? null;
  const filialPadrao = (c.empresa ?? "").match(/^\d{3}/)?.[0] ?? "213";
  const saiu = c.estado === "em_rota" || c.estado === "finalizada";
  const entregas: EntregaProtheus[] = [];
  const cargas: CargaProtheus[] = [];
  for (const p of c.paradas ?? []) {
    const baixa = saiu && p.resultado ? baixaDaParada(p, c.eventos ?? []) : null;
    const resultado = saiu && p.resultado ? RESULTADO[p.resultado] : null;
    const quando = diaHoraRecife(baixa?.em ?? (resultado ? c.fim_rota_em : null));
    const motivo = resultado?.[0] === "3" ? motivoComoProtheus(baixa?.motivo) ?? (p.resultado === "reagendada" ? MOTIVO_COMO_PROTHEUS.reagendado_pelo_cliente : null) : null;
    const porPedido = new Map<string, typeof p.pickings>();
    for (const k of p.pickings ?? []) if (k.pedido) porPedido.set(k.pedido, [...(porPedido.get(k.pedido) ?? []), k]);
    for (const [pedido, ks] of porPedido) {
      const nf = ks.map((k) => (k as { nf5117?: string }).nf5117).find(Boolean) ?? null;
      const statusAtual = resultado ? resultado[1] : rotuloCarga;
      entregas.push({ pedido: `${PREFIXO_ODOO}${pedido}`, filialPadrao, clienteId: p.cliente_id ? `${PREFIXO_ODOO}${p.cliente_id}` : null, cliente: p.cliente || null, statusAtual });
      cargas.push({
        pedido: `${PREFIXO_ODOO}${pedido}`,
        carga: c.romaneio,
        dt_previsao: diaDaCarga(c),
        tipo_entrega: tipo,
        status_carga: rotuloCarga,
        status_carga_codigo: codCarga,
        status_entrega: resultado ? resultado[1] : rotuloCarga,
        status_entrega_codigo: resultado ? resultado[0] : codCarga,
        status_origem: resultado ? "ENTREGA" : "CARGA",
        motorista_codigo: motorista?.codigo ?? null,
        motorista_nome: motorista?.nome ?? null,
        transportadora,
        veiculo: placaDoVeiculo(c.veiculo),
        regiao: c.zona || null,
        nota_fiscal: nf ? nf.split("/")[0] : null,
        serie: nf?.split("/")[1] ?? null,
        dt_retorno: quando?.[0] ?? null,
        hr_retorno: quando?.[1] ?? null,
        ocorrencia_codigo: motivo?.codigo ?? null,
        ocorrencia_descricao: motivo?.descricao ?? null,
        ocorrencia_categoria: motivo?.categoria ?? null,
        ocorrencia_nivel: motivo ? "VISITA" : null,
        itens: ks.flatMap((k) => (k.itens ?? []).map((i) => ({ produto: i.codigo, descricao: i.nome || null, quantidade: Number(i.qtd ?? 0) }))),
      });
    }
  }
  return { entregas, cargas };
}

export async function motoristasDoProtheus(admin: Admin): Promise<MotoristaProtheus[]> {
  const [{ data: m }, { data: v }] = await Promise.all([
    admin.from("v_motoristas_protheus").select("codigo, nome").returns<{ codigo: string; nome: string | null }[]>(),
    admin.from("v_motoristas_vinculo").select("codigo, transportadora").returns<{ codigo: string; transportadora: string | null }[]>(),
  ]);
  const transp = new Map((v ?? []).map((x) => [x.codigo, x.transportadora]));
  return (m ?? []).filter((x) => !x.codigo.startsWith("O")).map((x) => ({ codigo: x.codigo, nome: x.nome, transportadora: transp.get(x.codigo) ?? null }));
}

// Grava uma carga. Pedido já gravado (pela compat do Pedro ou numa carga
// anterior) mantém a filial que tinha; a linha da carga é por (pedido, romaneio).
export async function gravarCargaComoProtheus(admin: Admin, c: CargaDetalhe, motoristas: MotoristaProtheus[]): Promise<number> {
  if (c.cancelada) {
    const { data: antigas } = await admin.from("totvs_delivery_cargas").select("id, totvs_deliveries!inner(pedido)").eq("carga", c.romaneio).like("totvs_deliveries.pedido", `${PREFIXO_ODOO}%`);
    if (antigas?.length) await admin.from("totvs_delivery_cargas").delete().in("id", antigas.map((a) => a.id));
    return 0;
  }
  const { entregas, cargas } = cargaComoProtheus(c, motoristas);
  if (cargas.length === 0) return 0;
  const pedidos = [...new Set(entregas.map((e) => e.pedido))];
  const { data: existentes, error: e1 } = await admin.from("totvs_deliveries").select("id, pedido").in("pedido", pedidos).returns<{ id: string; pedido: string }[]>();
  if (e1) throw new Error(e1.message);
  const idPorPedido = new Map((existentes ?? []).map((d) => [d.pedido, d.id]));
  const agora = new Date().toISOString();
  const novas = [...new Map(entregas.filter((e) => !idPorPedido.has(e.pedido)).map((e) => [e.pedido, e])).values()];
  if (novas.length) {
    const { data, error } = await admin
      .from("totvs_deliveries")
      .upsert(
        novas.map((e) => ({ pedido: e.pedido, filial_venda: e.filialPadrao, client_id: e.clienteId, client_name: e.cliente, status_atual: e.statusAtual, synced_at: agora })),
        { onConflict: "pedido,filial_venda" }
      )
      .select("id, pedido")
      .returns<{ id: string; pedido: string }[]>();
    if (error) throw new Error(error.message);
    for (const d of data ?? []) idPorPedido.set(d.pedido, d.id);
  }
  for (const e of entregas.filter((x) => idPorPedido.has(x.pedido))) {
    await admin.from("totvs_deliveries").update({ status_atual: e.statusAtual, synced_at: agora, updated_at: agora }).eq("id", idPorPedido.get(e.pedido)!);
  }
  const linhas = cargas
    .filter((x) => idPorPedido.has(x.pedido))
    .map((x) => {
      const { pedido, itens, ...resto } = x;
      void itens;
      return { ...resto, delivery_id: idPorPedido.get(pedido)!, updated_at: agora };
    });
  const { data: gravadas, error: e2 } = await admin
    .from("totvs_delivery_cargas")
    .upsert(linhas, { onConflict: "delivery_id,carga" })
    .select("id, delivery_id")
    .returns<{ id: string; delivery_id: string }[]>();
  if (e2) throw new Error(e2.message);
  const idCarga = new Map((gravadas ?? []).map((g) => [g.delivery_id, g.id]));
  const itens = cargas.flatMap((x) => {
    const id = idCarga.get(idPorPedido.get(x.pedido) ?? "");
    return id ? x.itens.map((i, n) => ({ delivery_carga_id: id, item: String(n + 1).padStart(2, "0"), produto: i.produto, descricao: i.descricao, quantidade: i.quantidade, updated_at: agora })) : [];
  });
  if (itens.length) {
    await admin.from("totvs_delivery_carga_itens").delete().in("delivery_carga_id", [...idCarga.values()]);
    const { error: e3 } = await admin.from("totvs_delivery_carga_itens").insert(itens);
    if (e3) throw new Error(e3.message);
  }
  return linhas.length;
}

const POR_RODADA_CPF = 40;

// "Rua X, 12, apto 3, Tambauzinho, João Pessoa, 58000000" -> bairro e cidade
// (os dois últimos pedaços que não são número).
export function bairroECidade(endereco: string | null | undefined): { bairro: string | null; cidade: string | null } {
  const semNumero = (endereco ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && !/^\d[\d\s.-]*$/.test(t));
  if (semNumero.length < 3) return { bairro: null, cidade: semNumero.at(-1) ?? null };
  return { bairro: semNumero.at(-2) ?? null, cidade: semNumero.at(-1) ?? null };
}

// CPF/cidade do cliente nas entregas do Odoo -- a parada da carga não traz.
// Sem CPF, a volta (devolução, chamado da assistência) não é atribuída ao
// motorista da entrega (v_visitas_motorista). Pela /consulta/pedidos, 2 por
// vez, até 40 por leitura; sem CPF no Odoo grava "" pra não perguntar de novo.
export async function completarClientesOdoo(admin: Admin): Promise<number> {
  const { data } = await admin
    .from("totvs_deliveries")
    .select("id, pedido")
    .like("pedido", `${PREFIXO_ODOO}%`)
    .is("client_cpf_cnpj", null)
    .order("updated_at", { ascending: false })
    .limit(POR_RODADA_CPF)
    .returns<{ id: string; pedido: string }[]>();
  let feitos = 0;
  const lista = data ?? [];
  for (let i = 0; i < lista.length; i += 2) {
    await Promise.all(
      lista.slice(i, i + 2).map(async (d) => {
        const nome = d.pedido.slice(PREFIXO_ODOO.length);
        const p = (await consultarPedidosOdoo(nome).catch(() => [])).find((x) => x.pedido === nome);
        if (!p) return;
        const cpf = (p.cliente?.cpf ?? "").replace(/\D/g, "");
        const { bairro, cidade } = bairroECidade(p.cliente?.endereco);
        const { error } = await admin.from("totvs_deliveries").update({ client_cpf_cnpj: cpf, client_city: cidade, client_neighborhood: bairro }).eq("id", d.id);
        if (!error) feitos++;
      })
    );
  }
  return feitos;
}
