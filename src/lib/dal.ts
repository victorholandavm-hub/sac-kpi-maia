import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { SAC_MANAGED_TYPES, ASSISTENCIA_MANAGED_TYPES } from "./assistenciaLabels";

export type Role = "assistencia" | "admin" | "sac";

export type Profile = {
  id: string;
  fullName: string;
  role: Role;
  storeId: string | null;
};

// Revalida a sessão contra o servidor de Auth do Supabase (não confia só no cookie).
export const verifySession = cache(async () => {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/assistencia/login");
  return user;
});

export const getProfile = cache(async (): Promise<Profile> => {
  const user = await verifySession();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, role, store_id")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    redirect("/assistencia/login");
  }

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role as Role,
    storeId: data.store_id,
  };
});

export function requireRole(profile: Profile, ...roles: Role[]) {
  if (!roles.includes(profile.role)) {
    throw new Error(`Ação não permitida para o papel "${profile.role}".`);
  }
}

// SAC só gerencia notificações/trocas de produto em /assistencia/sac — não
// enxerga a fila normal de montagem/assistência. Chamar no topo de toda
// página do grupo (app) que não seja o detalhe de um chamado específico
// (que o SAC também precisa acessar pros próprios chamados).
export function redirectIfSac(profile: Profile) {
  if (profile.role === "sac") redirect("/assistencia/sac");
}

// Assistência e SAC são times separados, cada um só gerencia o próprio
// domínio de tipos (troca_produto/notificacao_externa etc. pro SAC,
// montagem/desmontagem/troca_peça/vistoria pra assistência) — só admin tem
// acesso total aos dois, como supervisão. Sem essa checagem por tipo, uma
// role check sozinha deixaria qualquer um mexer em qualquer chamado da fila,
// bastando saber o id.
export function requireManageAccess(profile: Profile, requestType: string) {
  if (profile.role === "admin") return;
  if (profile.role === "assistencia" && (ASSISTENCIA_MANAGED_TYPES as readonly string[]).includes(requestType)) return;
  if (profile.role === "sac" && (SAC_MANAGED_TYPES as readonly string[]).includes(requestType)) return;
  throw new Error(`Ação não permitida para o papel "${profile.role}" nesse chamado.`);
}

// Regras de transição de status do pedido de encomenda (ver
// supabase/migrations/0027_pedidos_encomenda.sql / 0028_encomenda_pin_auth.sql
// / 0052_pedido_encomenda_fornecedor.sql):
// fábrica própria só avança solicitado -> em_producao -> pronto_para_expedicao,
// e só nos pedidos da fábrica que é dela; CD só avança daí em diante até
// entregue. Fornecedor externo não tem etapa de produção -- CD assume desde
// "solicitado" (pula direto pra pronto_para_expedicao). Só admin/assistencia
// pode cancelar, em qualquer etapa. Aceita `{ role: string }` em vez de
// `Profile` porque CD e fábrica não são mais contas Supabase Auth — ver
// EncomendaActor em src/lib/encomendaAuth.ts.
const FABRICA_TRANSITIONS: Record<string, string[]> = {
  solicitado: ["em_producao"],
  em_producao: ["pronto_para_expedicao"],
};

const CD_TRANSITIONS: Record<string, string[]> = {
  // "em_carga" -- vai pra loja (fluxo normal); "recebido_cd" -- fica no CD,
  // venda direta pro cliente sem passar pela loja (ver PedidoEncomendaActions.tsx).
  pronto_para_expedicao: ["em_carga", "recebido_cd"],
  em_carga: ["faturado"],
  faturado: ["entregue"],
};

// CD assume a etapa de produção também quando o fornecedor é externo -- não
// existe fábrica pra "aceitar" o pedido nesse caso.
const CD_TRANSITIONS_EXTERNO: Record<string, string[]> = {
  ...CD_TRANSITIONS,
  solicitado: ["pronto_para_expedicao"],
};

export type PedidoEncomendaForAuth = {
  status: string;
  fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  fabricaId: string | null;
};

export function requireEncomendaAction(
  actor: { role: string; fabricaId?: string | null },
  pedido: PedidoEncomendaForAuth,
  toStatus: string
) {
  if (actor.role === "assistencia" || actor.role === "admin") return;

  const externo = pedido.fornecedorTipo === "fabrica_externa";
  const fromStatus = pedido.status;

  if (toStatus === "negado") {
    const podeNegar =
      (actor.role === "fabrica" && !externo && fromStatus === "solicitado") ||
      (actor.role === "cd" && fromStatus === "solicitado");
    if (!podeNegar) {
      throw new Error(`Ação não permitida para o papel "${actor.role}" — só quem cuida do pedido pode negá-lo enquanto ele está solicitado.`);
    }
    return;
  }

  if (toStatus === "cancelado") {
    throw new Error(`Ação não permitida para o papel "${actor.role}" — só admin/assistência pode cancelar um pedido.`);
  }

  if (actor.role === "fabrica") {
    if (externo) {
      throw new Error(`Ação não permitida — esse pedido é de fornecedor externo, não passa pela fábrica.`);
    }
    if (actor.fabricaId && pedido.fabricaId && actor.fabricaId !== pedido.fabricaId) {
      throw new Error(`Ação não permitida — esse pedido é de outra fábrica.`);
    }
    if (!(FABRICA_TRANSITIONS[fromStatus] ?? []).includes(toStatus)) {
      throw new Error(`Ação não permitida para o papel "${actor.role}" nesse pedido.`);
    }
    return;
  }

  if (actor.role === "cd") {
    const allowed = externo ? (CD_TRANSITIONS_EXTERNO[fromStatus] ?? []) : (CD_TRANSITIONS[fromStatus] ?? []);
    if (!allowed.includes(toStatus)) {
      throw new Error(`Ação não permitida para o papel "${actor.role}" nesse pedido.`);
    }
    return;
  }

  throw new Error(`Ação não permitida para o papel "${actor.role}" nesse pedido.`);
}

// Versão booleana da regra acima, sem lançar -- usada só pra destacar na
// fila os pedidos que dependem de uma ação do papel logado (ver
// fila/page.tsx). Não cobre negar/cancelar (ações à parte, não são "avançar
// status"). Reaproveita as mesmas tabelas de transição pra não duplicar a
// regra de verdade em dois lugares.
export function encomendaCanAdvance(actor: { role: string; fabricaId?: string | null }, pedido: PedidoEncomendaForAuth): boolean {
  const externo = pedido.fornecedorTipo === "fabrica_externa";
  if (actor.role === "fabrica") {
    if (externo) return false;
    if (actor.fabricaId && pedido.fabricaId && actor.fabricaId !== pedido.fabricaId) return false;
    return (FABRICA_TRANSITIONS[pedido.status] ?? []).length > 0;
  }
  if (actor.role === "cd") {
    const table = externo ? CD_TRANSITIONS_EXTERNO : CD_TRANSITIONS;
    return (table[pedido.status] ?? []).length > 0;
  }
  return false;
}
