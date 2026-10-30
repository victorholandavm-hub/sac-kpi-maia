import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { inventarioSaldo, mensagemDeErro, transferirEstoques, type TipoEstoque } from "@/lib/odoo/logistica";

// Estoque AT automático pela notificação de assistência -- Victor 30/10/2026.
// - Notificação de troca/entrega criada: o produto a entregar sai do estoque
//   de venda do CD para o AT ("reserva").
// - Cancelada, ou o item saiu da notificação: volta do AT para o CD ("estorno").
// - Recolhido classificado pela equipe técnica: sai do AT para o destino
//   ("destino"). Só liga com ESTOQUE_AT_RECOLHIDOS=1, quando a ponte já der
//   entrada do recolhido no AT (pedido ao Pedro no MURAL de 30/10).
// A baixa do AT ao concluir precisa de nota fiscal -- é a ponte que faz.
// Tudo desligado até ESTOQUE_AT_AUTOMATICO=1; só notificações criadas a
// partir de ESTOQUE_AT_INICIO (as antigas não mexem no estoque).

export const EMPRESA_CD = 13; // "213 CD" no Odoo
const OPERADOR = "Sistema da assistência";

export const TIPOS_ENTREGA = ["troca_produto", "entrega_produto"] as const;
const TIPOS_COM_RECOLHIDO = ["troca_produto", "recolhimento_produto"] as const;

// Destino escolhido pela equipe técnica -> estoque do CD. O que não está aqui
// fica no AT: conserto, em observação, sem condições, outro (Victor 30/10:
// "no AT") e mostruário (vai pra loja com nota de transferência -- ponte).
// Fábrica fica na Avaria até sair a devolução ao fornecedor.
export const DESTINO_RECOLHIDO: Partial<Record<string, TipoEstoque>> = {
  estoque: "estoque",
  pequena_avaria: "avaria",
  fabrica: "avaria",
};

export type ReqEstoque = { id: string; ticket_number: number; type: string; status: string };
export type ItemEstoque = { id: string; request_id: string; part_code: string | null; quantity: number | null; is_pickup: boolean | null; destino: string | null };
export type MovEstoque = {
  id: string; request_id: string; item_id: string | null; etapa: "reserva" | "estorno" | "destino"; desfaz: string | null;
  codigo: string; qtd: number; origem: TipoEstoque; destino: TipoEstoque; situacao: "feito" | "sem_saldo" | "erro"; tentativas: number;
};
export type AcaoEstoque = {
  etapa: MovEstoque["etapa"]; request_id: string; ticket: number; item_id: string | null; desfaz: string | null;
  codigo: string; qtd: number; origem: TipoEstoque; destino: TipoEstoque; existente: MovEstoque | null;
};

// Erro que não é falta de saldo (código inexistente, produto que não controla
// estoque) não se resolve sozinho: para de tentar e fica na tela pra alguém ver.
const MAX_TENTATIVAS_ERRO = 5;
const desistiu = (m: MovEstoque | null) => m?.situacao === "erro" && m.tentativas >= MAX_TENTATIVAS_ERRO;

const codigoDe = (i: ItemEstoque) => (i.part_code ?? "").trim().toUpperCase();
const qtdDe = (i: ItemEstoque) => Math.max(1, Number(i.quantity ?? 1));

export function ehEntregue(req: ReqEstoque, item: ItemEstoque): boolean {
  return (TIPOS_ENTREGA as readonly string[]).includes(req.type) && !item.is_pickup && !!codigoDe(item);
}
export function ehRecolhido(req: ReqEstoque, item: ItemEstoque): boolean {
  if (!codigoDe(item)) return false;
  return req.type === "recolhimento_produto" || (req.type === "troca_produto" && !!item.is_pickup);
}

export function planejarEstoqueAt(reqs: ReqEstoque[], itens: ItemEstoque[], movs: MovEstoque[], opts: { recolhidos: boolean }): AcaoEstoque[] {
  const porId = new Map(reqs.map((r) => [r.id, r]));
  const acoes: AcaoEstoque[] = [];
  const mov = (itemId: string, etapa: MovEstoque["etapa"]) => movs.find((m) => m.item_id === itemId && m.etapa === etapa) ?? null;
  const estornoDe = (reservaId: string) => movs.find((m) => m.etapa === "estorno" && m.desfaz === reservaId) ?? null;
  const estornar = (r: MovEstoque, req: ReqEstoque) => {
    const e = estornoDe(r.id);
    if (e?.situacao === "feito" || desistiu(e)) return;
    acoes.push({ etapa: "estorno", request_id: req.id, ticket: req.ticket_number, item_id: null, desfaz: r.id, codigo: r.codigo, qtd: r.qtd, origem: "assistencia", destino: "estoque", existente: e });
  };

  for (const item of itens) {
    const req = porId.get(item.request_id);
    if (!req) continue;
    if (ehEntregue(req, item)) {
      const r = mov(item.id, "reserva");
      if (req.status === "cancelada") {
        if (r?.situacao === "feito") estornar(r, req);
      } else if (req.status !== "concluida" && r?.situacao !== "feito" && !desistiu(r)) {
        acoes.push({ etapa: "reserva", request_id: req.id, ticket: req.ticket_number, item_id: item.id, desfaz: null, codigo: codigoDe(item), qtd: qtdDe(item), origem: "estoque", destino: "assistencia", existente: r });
      }
    } else if (opts.recolhidos && ehRecolhido(req, item) && req.status !== "cancelada") {
      const para = item.destino ? DESTINO_RECOLHIDO[item.destino] : undefined;
      const d = mov(item.id, "destino");
      if (para && d?.situacao !== "feito" && !desistiu(d)) {
        acoes.push({ etapa: "destino", request_id: req.id, ticket: req.ticket_number, item_id: item.id, desfaz: null, codigo: codigoDe(item), qtd: qtdDe(item), origem: "assistencia", destino: para, existente: d });
      }
    }
  }

  // Item apagado/trocado numa edição: a reserva dele volta pro CD (se a notificação ainda não foi concluída).
  const itemIds = new Set(itens.map((i) => i.id));
  for (const r of movs) {
    if (r.etapa !== "reserva" || r.situacao !== "feito" || (r.item_id && itemIds.has(r.item_id))) continue;
    const req = porId.get(r.request_id);
    if (req && req.status !== "concluida") estornar(r, req);
  }
  return acoes;
}

const ROTULO_ETAPA: Record<MovEstoque["etapa"], string> = { reserva: "produto a entregar, CD → AT", estorno: "notificação cancelada/item retirado, AT → CD", destino: "recolhido classificado" };

export type ResultadoEstoqueAt = { desligado: true } | { ocupado: true } | { acoes: number; feitos: number; semSaldo: number; erros: string[] };

export async function reconciliarEstoqueAt(opts: { requestId?: string } = {}): Promise<ResultadoEstoqueAt> {
  const inicio = process.env.ESTOQUE_AT_INICIO;
  if (process.env.ESTOQUE_AT_AUTOMATICO !== "1" || !inicio) return { desligado: true };
  const admin = getSupabaseAdmin();
  const { data: trava } = await admin.rpc("estoque_at_pegar_trava", { segundos: 600 });
  if (!trava) return { ocupado: true };
  try {
    let q = admin
      .from("service_requests")
      .select("id, ticket_number, type, status")
      .gte("created_at", inicio)
      .in("type", [...new Set([...TIPOS_ENTREGA, ...TIPOS_COM_RECOLHIDO])]);
    if (opts.requestId) q = q.eq("id", opts.requestId);
    const { data: reqs } = await q.returns<ReqEstoque[]>();
    if (!reqs?.length) return { acoes: 0, feitos: 0, semSaldo: 0, erros: [] };
    const ids = reqs.map((r) => r.id);
    const [{ data: itens }, { data: movs }] = await Promise.all([
      admin.from("service_request_items").select("id, request_id, part_code, quantity, is_pickup, destino").in("request_id", ids).returns<ItemEstoque[]>(),
      admin.from("estoque_at_movimentos").select("id, request_id, item_id, etapa, desfaz, codigo, qtd, origem, destino, situacao, tentativas").in("request_id", ids).returns<MovEstoque[]>(),
    ]);
    const acoes = planejarEstoqueAt(reqs, itens ?? [], movs ?? [], { recolhidos: process.env.ESTOQUE_AT_RECOLHIDOS === "1" }).slice(0, 40);
    if (!acoes.length) return { acoes: 0, feitos: 0, semSaldo: 0, erros: [] };

    // Saldo livre do CD lido antes (só leitura): sem saldo não chama a transferência,
    // que cria e cancela um documento no Odoo a cada tentativa.
    const livre = new Map<string, number>();
    const naoControla = new Set<string>();
    const codigosReserva = [...new Set(acoes.filter((a) => a.origem === "estoque").map((a) => a.codigo))];
    if (codigosReserva.length) {
      const s = await inventarioSaldo(EMPRESA_CD, codigosReserva);
      for (const i of s.itens) {
        if (!i.existe || i.estocavel === false) naoControla.add(i.codigo.toUpperCase());
        else livre.set(i.codigo.toUpperCase(), Math.max(0, (i.sistema ?? 0) - (i.reservado ?? 0)));
      }
    }

    let feitos = 0, semSaldo = 0;
    const erros: string[] = [];
    for (const a of acoes) {
      let situacao: MovEstoque["situacao"];
      let picking: string | null = null;
      let mensagem: string;
      if (a.origem === "estoque" && naoControla.has(a.codigo)) {
        situacao = "erro";
        mensagem = `Código ${a.codigo} não existe no Odoo ou não controla estoque.`;
      } else if (a.origem === "estoque" && (livre.get(a.codigo) ?? 0) < a.qtd) {
        situacao = "sem_saldo";
        mensagem = `Sem saldo livre no CD (tem ${livre.get(a.codigo) ?? 0}, precisa ${a.qtd}).`;
      } else {
        try {
          const r = await transferirEstoques(
            { company_id: EMPRESA_CD, origem: a.origem, destino: a.destino, itens: [{ codigo: a.codigo, qtd: a.qtd }], motivo: `Notificação de assistência #${a.ticket}: ${ROTULO_ETAPA[a.etapa]}` },
            OPERADOR,
          );
          situacao = r.ok ? "feito" : "erro";
          picking = r.picking || null;
          mensagem = r.msg;
          if (r.ok && a.origem === "estoque") livre.set(a.codigo, (livre.get(a.codigo) ?? 0) - a.qtd);
        } catch (err) {
          mensagem = mensagemDeErro(err);
          situacao = /saldo livre insuficiente/i.test(mensagem) ? "sem_saldo" : "erro";
        }
      }
      if (situacao === "feito") feitos++;
      else if (situacao === "sem_saldo") semSaldo++;
      else erros.push(`#${a.ticket} ${a.codigo}: ${mensagem}`);
      const agora = new Date().toISOString();
      if (a.existente) {
        await admin.from("estoque_at_movimentos").update({ situacao, picking, mensagem, tentativas: a.existente.tentativas + 1, atualizado_em: agora }).eq("id", a.existente.id);
      } else {
        await admin.from("estoque_at_movimentos").insert({
          request_id: a.request_id, item_id: a.item_id, etapa: a.etapa, desfaz: a.desfaz, codigo: a.codigo, qtd: a.qtd, origem: a.origem, destino: a.destino, situacao, picking, mensagem,
        });
      }
    }
    return { acoes: acoes.length, feitos, semSaldo, erros };
  } finally {
    await admin.rpc("estoque_at_soltar_trava");
  }
}

// Dupla verificação na criação (Victor 30/10): o que vai faltar no CD.
export async function faltasNoCd(itens: { codigo: string; qtd: number }[]): Promise<{ codigo: string; nome: string; livre: number; qtd: number }[]> {
  const pedidos = new Map<string, number>();
  for (const i of itens) {
    const c = i.codigo.trim().toUpperCase();
    if (c) pedidos.set(c, (pedidos.get(c) ?? 0) + Math.max(1, i.qtd || 1));
  }
  if (!pedidos.size) return [];
  const s = await inventarioSaldo(EMPRESA_CD, [...pedidos.keys()]);
  const out: { codigo: string; nome: string; livre: number; qtd: number }[] = [];
  for (const i of s.itens) {
    const qtd = pedidos.get(i.codigo.toUpperCase()) ?? 0;
    const livre = Math.max(0, (i.sistema ?? 0) - (i.reservado ?? 0));
    if (i.existe && i.estocavel !== false && livre < qtd) out.push({ codigo: i.codigo, nome: i.nome ?? "", livre, qtd });
  }
  return out;
}

export const estoqueAtLigado = () => process.env.ESTOQUE_AT_AUTOMATICO === "1" && !!process.env.ESTOQUE_AT_INICIO;
