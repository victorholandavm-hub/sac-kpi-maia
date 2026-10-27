import { getSupabaseAdmin } from "./supabaseAdmin";
import { consertarAcentos, ddmmyyyyToIso, totvsHeaders } from "./totvsSync";

// Completa totvs_orders com as vendas do Protheus que o sync antigo perdeu --
// Victor 27/10/2026. A compat do Pedro (TOTVS_API_BASE_URL) responde
// /rest/orders lendo direto o SQL do Protheus, no mesmo formato do REST
// (50 por página: com 200 a compat dá 504; ~10 s por página e 502 de vez em
// quando, medido 27/10 -- cada página tenta de novo 2x). Dia a dia, do 24/10/2026 (última venda do Protheus)
// pra trás: insere SÓ o que falta (ignoreDuplicates), nunca reescreve.
// Dia conferido vai pra protheus_vendas_completadas (0213).

const ULTIMO_DIA = "2026-10-24";
const PRIMEIRO_DIA = "2024-01-01";
const POR_PAGINA = 50;
const ESPERAS_MS = [5_000, 15_000];
const TIMEOUT_MS = 120_000;

type ItemVenda = {
  itemNumber: string;
  product?: string;
  description?: string;
  manufacturer?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  salePrice?: number;
  total?: number;
  discount?: number;
  tes?: string;
  cfop?: string;
};

export type VendaProtheus = {
  invoice: string;
  serie: string;
  branch: string;
  date: string;
  paymentMethod?: string;
  invoiceTotal?: number;
  type: string;
  nfeKey?: string;
  seller?: { id?: string; name?: string };
  client?: { id?: string; loja?: string; cpf_cnpj?: string; name?: string };
  items?: ItemVenda[];
};

async function paginaDoDia(dia: string, pagina: number, tentativa = 0): Promise<{ totalPages: number; data: VendaProtheus[] }> {
  try {
    return await buscarPagina(dia, pagina);
  } catch (err) {
    if (tentativa >= ESPERAS_MS.length) throw err;
    await new Promise((ok) => setTimeout(ok, ESPERAS_MS[tentativa]));
    return paginaDoDia(dia, pagina, tentativa + 1);
  }
}

async function buscarPagina(dia: string, pagina: number): Promise<{ totalPages: number; data: VendaProtheus[] }> {
  const base = (process.env.TOTVS_API_BASE_URL ?? "").replace(/\/+$/, "");
  const d = dia.replace(/-/g, "");
  const r = await fetch(`${base}/rest/orders?StartDate=${d}&EndDate=${d}&Page=${pagina}&Size=${POR_PAGINA}`, {
    headers: totvsHeaders(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`compat respondeu ${r.status} em ${dia} p${pagina}`);
  const j = JSON.parse(consertarAcentos(await r.text())) as { totalPages?: number; data?: VendaProtheus[] };
  return { totalPages: j.totalPages ?? 1, data: j.data ?? [] };
}

const chave = (v: { invoice: string; serie: string; branch: string }) => `${v.invoice}|${v.serie}|${v.branch}`;

// Só as vendas do dia que ainda não estão na base (mesma chave do sync:
// invoice + serie + branch).
export function vendasQueFaltam(vendas: VendaProtheus[], jaTem: Set<string>, dia: string): VendaProtheus[] {
  const vistas = new Set<string>();
  return vendas.filter((v) => {
    const k = chave(v);
    if (jaTem.has(k) || vistas.has(k) || ddmmyyyyToIso(v.date) !== dia) return false;
    vistas.add(k);
    return true;
  });
}

export async function completarVendasDoDia(dia: string): Promise<{ notas: number; inseridas: number }> {
  const admin = getSupabaseAdmin();
  const vendas: VendaProtheus[] = [];
  for (let pagina = 1, total = 1; pagina <= total; pagina++) {
    const p = await paginaDoDia(dia, pagina);
    total = p.totalPages;
    vendas.push(...p.data);
  }
  const { data: existentes, error } = await admin.from("totvs_orders").select("invoice, serie, branch").eq("issue_date", dia).limit(10000);
  if (error) throw new Error(error.message);
  const faltam = vendasQueFaltam(vendas, new Set((existentes ?? []).map(chave)), dia);
  if (faltam.length === 0) return { notas: vendas.length, inseridas: 0 };

  const linhas = faltam.map((o) => ({
    invoice: o.invoice,
    serie: o.serie,
    branch: o.branch,
    issue_date: dia,
    payment_method: o.paymentMethod || null,
    invoice_total: o.invoiceTotal ?? 0,
    type: o.type,
    nfe_key: o.nfeKey || null,
    seller_id: o.seller?.id || null,
    seller_name: o.seller?.name || null,
    client_id: o.client?.id || null,
    client_cpf_cnpj: o.client?.cpf_cnpj || null,
    client_name: o.client?.name || null,
    client_loja: o.client?.loja || null,
  }));
  const { data: inseridas, error: insError } = await admin
    .from("totvs_orders")
    .upsert(linhas, { onConflict: "invoice,serie,branch", ignoreDuplicates: true })
    .select("id, invoice, serie, branch");
  if (insError) throw new Error(`${dia}: ${insError.message}`);
  const idPorChave = new Map((inseridas ?? []).map((r) => [chave(r), r.id as string]));
  const itens = faltam.flatMap((o) => {
    const id = idPorChave.get(chave(o));
    return id
      ? (o.items ?? []).map((i) => ({
          order_id: id,
          item_number: i.itemNumber,
          product: i.product || null,
          description: i.description || null,
          manufacturer: i.manufacturer || null,
          unit: i.unit || null,
          quantity: i.quantity ?? 0,
          unit_price: i.unitPrice ?? null,
          sale_price: i.salePrice ?? null,
          total: i.total ?? 0,
          discount: i.discount ?? null,
          tes: i.tes || null,
          cfop: i.cfop || null,
        }))
      : [];
  });
  for (let k = 0; k < itens.length; k += 500) {
    const { error: itErr } = await admin.from("totvs_order_items").upsert(itens.slice(k, k + 500), { onConflict: "order_id,item_number", ignoreDuplicates: true });
    if (itErr) throw new Error(`${dia} itens: ${itErr.message}`);
  }
  return { notas: vendas.length, inseridas: inseridas?.length ?? 0 };
}

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type ResumoVendas = { dias: number; notas: number; inseridas: number; falhas: string[]; parouPor: string };

export async function completarVendasProtheus(limiteMs: number, desde = PRIMEIRO_DIA): Promise<ResumoVendas> {
  const admin = getSupabaseAdmin();
  const inicio = Date.now();
  const { data: feitos } = await admin.from("protheus_vendas_completadas").select("dia").limit(5000).returns<{ dia: string }[]>();
  const conferidos = new Set((feitos ?? []).map((f) => f.dia));
  const resumo: ResumoVendas = { dias: 0, notas: 0, inseridas: 0, falhas: [], parouPor: "fim" };
  for (let dia = ULTIMO_DIA; dia >= desde; dia = diaAnterior(dia)) {
    if (conferidos.has(dia)) continue;
    if (Date.now() - inicio > limiteMs) return { ...resumo, parouPor: "tempo" };
    try {
      const r = await completarVendasDoDia(dia);
      await admin.from("protheus_vendas_completadas").upsert({ dia, notas: r.notas, inseridas: r.inseridas, feito_em: new Date().toISOString() }, { onConflict: "dia" });
      resumo.dias++;
      resumo.notas += r.notas;
      resumo.inseridas += r.inseridas;
    } catch (err) {
      resumo.falhas.push((err as Error).message);
      if (resumo.falhas.length >= 3) return { ...resumo, parouPor: "falhas" };
    }
  }
  return resumo;
}
