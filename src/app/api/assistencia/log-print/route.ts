import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireRole, requireManageAccess, type Profile, type Role } from "@/lib/dal";

// Rota de API tradicional em vez de Server Action (era logPrint, actions.ts)
// -- pedido do Victor 16/09/2026: "o botão de imprimir não funciona,
// funciona apenas quando aperto ctrl + P". Mesma causa raiz já corrigida em
// /api/staff/upload-photo (ver comentário lá, 26/08/2026): Server Action
// guarda um ID específico do build; um deploy novo (frequente nesta base)
// invalida quem já estava com a tela de despacho aberta de antes. POST comum
// não tem esse problema -- a rota em si não muda de "id" a cada deploy.
//
// Auditoria de segurança 17/09/2026 (pedido do Victor: "revise seu próprio
// código em busca de vulnerabilidades") -- corrigidas 3 falhas achadas
// comparando com o padrão já estabelecido em upload-photo/route.ts, que a
// versão original desta rota não seguiu até o fim:
//
// 1. Broken Access Control (OWASP A01): faltava requireManageAccess por
//    chamado -- só checava o PAPEL (requireRole), não se esse papel pode
//    gerenciar o TIPO daquele request_id específico (ver comentário de
//    requireManageAccess, dal.ts: "sem essa checagem por tipo, uma role
//    check sozinha deixaria qualquer um mexer em qualquer chamado da fila,
//    bastando saber o id"). Um SAC autenticado que soubesse o UUID de um
//    chamado de montagem (fora do domínio dele) conseguia gravar um evento
//    "printed" nele. Corrigido: busca o tipo de cada request_id e filtra
//    pelos que o papel realmente gerencia, descartando o resto.
// 2. Information Disclosure (OWASP A05): erro do Postgres/Supabase (nome
//    de tabela, constraint etc.) ia direto no JSON de resposta -- visível
//    no DevTools de qualquer usuário autenticado. Corrigido: erro completo
//    só no log do servidor (console.error), resposta ao cliente sempre
//    genérica.
// 3. Falta de validação de entrada: nenhum limite de tamanho no array nem
//    checagem de formato UUID antes de tentar usar. Corrigido: valida
//    formato e limita a MAX_IDS por chamada.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão expirada. Atualize a página e faça login de novo." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profileRow } = await admin.from("profiles").select("id, full_name, role, store_id").eq("id", user.id).maybeSingle();
    if (!profileRow) {
      console.warn("[log-print] perfil não encontrado", { userId: user.id });
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 401 });
    }
    const profile: Profile = { id: profileRow.id, fullName: profileRow.full_name, role: profileRow.role as Role, storeId: profileRow.store_id };

    try {
      requireRole(profile, "assistencia", "admin", "sac");
    } catch (err) {
      console.warn("[log-print] papel não permitido", { role: profile.role });
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }

    let body: { requestIds?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Não foi possível ler o envio." }, { status: 400 });
    }

    const rawIds = Array.isArray(body.requestIds) ? body.requestIds : [];
    if (rawIds.length > MAX_IDS) {
      console.warn("[log-print] lote acima do limite", { recebido: rawIds.length, userId: user.id });
      return NextResponse.json({ error: `No máximo ${MAX_IDS} notificações por vez.` }, { status: 400 });
    }
    // Só aceita string em formato de UUID -- descarta silenciosamente
    // qualquer coisa fora do formato (mesmo espírito de "autenticação pelo
    // próprio caminho" já usado em /api/photos, sem dar pista nenhuma de
    // por que um valor foi rejeitado).
    const ids = [...new Set(rawIds.map((id) => String(id).trim()).filter((id) => UUID_RE.test(id)))];
    if (ids.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Busca o tipo de cada chamado -- ao mesmo tempo confirma que existe
    // (FK de service_request_events já impediria inserir em id inexistente,
    // mas aqui filtramos ANTES, sem depender de erro de banco) e dá a base
    // pra checagem de acesso por tipo logo abaixo.
    const { data: requests, error: fetchError } = await admin.from("service_requests").select("id, type").in("id", ids);
    if (fetchError) {
      console.error("[log-print] falha ao buscar chamados", fetchError, { userId: user.id });
      return NextResponse.json({ error: "Não foi possível processar o pedido." }, { status: 500 });
    }

    // Só loga print nos chamados que esse papel realmente pode gerenciar --
    // mesma regra usada em toda ação de assistência/SAC (requireManageAccess,
    // dal.ts). Chamado fora do domínio do papel é descartado em silêncio,
    // igual a um id que não existe -- não dá pista pra quem chamou sobre
    // quais ids são "reais" fora do alcance dele.
    const allowedIds = (requests ?? [])
      .filter((r) => {
        try {
          requireManageAccess(profile, r.type as string);
          return true;
        } catch {
          return false;
        }
      })
      .map((r) => r.id as string);

    if (allowedIds.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("service_request_events").insert(
      allowedIds.map((id) => ({
        request_id: id,
        actor_id: profile.id,
        event_type: "printed",
      }))
    );
    if (error) {
      console.error("[log-print] falha ao gravar evento", error, { userId: user.id, ids: allowedIds });
      return NextResponse.json({ error: "Não foi possível registrar a impressão." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[log-print] erro não previsto", err);
    return NextResponse.json({ error: "Erro inesperado no servidor." }, { status: 500 });
  }
}
