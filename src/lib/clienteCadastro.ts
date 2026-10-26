import { consertarAcentos, totvsHeaders } from "./totvsSync";

// Cliente pelo CPF/CNPJ no cadastro da camada compat do Pedro
// (TOTVS_API_BASE_URL desde 26/10: o Odoo respondendo como o Protheus) --
// Victor 26/10/2026: "não estamos conseguindo achar a venda" (ex.: CPF
// 04682762460 não estava em nenhuma tabela nossa; o cadastro dela está lá).
// Só /rest/client responde rápido (~2,5 s); /rest/orders volta vazio e
// /rest/ai/deliveries dá 504 -- por isso a consulta usa o NOME daqui para
// procurar no Odoo (odoo_expedicao) e no histórico do Protheus.

export type ClienteCadastro = { codigo: string; nome: string; documento: string; telefone: string | null; ultimaCompra: string | null };

type Resposta = { data?: { id?: string; cpf_cnpj?: string; name?: string; phone1?: string; lastPurchase?: string }[] };

export async function clientesDoCadastro(documento: string): Promise<ClienteCadastro[]> {
  const base = process.env.TOTVS_API_BASE_URL;
  const d = documento.replace(/\D/g, "");
  if (!base || (d.length !== 11 && d.length !== 14)) return [];
  const r = await fetch(`${base.replace(/\/+$/, "")}/rest/client?SearchQuery=${d}&Page=1&Size=5`, {
    headers: totvsHeaders(),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`cadastro de clientes respondeu ${r.status}`);
  const j = JSON.parse(consertarAcentos(await r.text())) as Resposta;
  return (j.data ?? [])
    .filter((c) => c.name && (c.cpf_cnpj ?? "").replace(/\D/g, "") === d)
    .map((c) => ({
      codigo: c.id ?? "",
      nome: c.name!.trim(),
      documento: d,
      telefone: c.phone1?.trim() || null,
      ultimaCompra: c.lastPurchase?.trim() || null,
    }));
}
