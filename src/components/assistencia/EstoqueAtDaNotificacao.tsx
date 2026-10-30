import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// O que a notificação fez no estoque do CD/AT (estoqueAt.ts) -- Victor 30/10/2026.
const LOCAL: Record<string, string> = { estoque: "Estoque CD", avaria: "Avaria", assistencia: "AT" };
const SITUACAO: Record<string, { texto: string; cor: string }> = {
  feito: { texto: "feito", cor: "var(--status-good)" },
  sem_saldo: { texto: "sem saldo no CD — tenta de novo a cada 30 min", cor: "var(--status-serious)" },
  erro: { texto: "erro", cor: "var(--status-critical)" },
};

type Mov = { id: string; etapa: string; codigo: string; qtd: number; origem: string; destino: string; situacao: string; picking: string | null; mensagem: string | null; atualizado_em: string };

export async function EstoqueAtDaNotificacao({ requestId }: { requestId: string }) {
  const admin = getSupabaseAdmin();
  const [{ data }, { data: req }] = await Promise.all([
    admin
      .from("estoque_at_movimentos")
      .select("id, etapa, codigo, qtd, origem, destino, situacao, picking, mensagem, atualizado_em")
      .eq("request_id", requestId)
      .order("criado_em")
      .returns<Mov[]>(),
    admin.from("service_requests").select("estoque_ciente_sem_saldo_por, estoque_ciente_sem_saldo_em").eq("id", requestId).maybeSingle<{ estoque_ciente_sem_saldo_por: string | null; estoque_ciente_sem_saldo_em: string | null }>(),
  ]);
  const movs = data ?? [];
  const cientePor = req?.estoque_ciente_sem_saldo_por ?? null;
  const cienteEm = req?.estoque_ciente_sem_saldo_em ?? null;
  if (!movs.length && !cientePor) return null;
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2 text-sm">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Estoque (CD → AT)</h3>
      {cientePor && cienteEm ? (
        <p className="text-xs" style={{ color: "var(--status-serious)" }}>
          Criada sem saldo livre no CD — {cientePor} confirmou que estava ciente em {quando(cienteEm)}.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {movs.map((m) => (
          <li key={m.id} style={{ color: "var(--text-primary)" }}>
            {m.qtd} × <span className="font-mono">{m.codigo}</span>: {LOCAL[m.origem] ?? m.origem} → {LOCAL[m.destino] ?? m.destino} ·{" "}
            <span style={{ color: SITUACAO[m.situacao]?.cor }}>{SITUACAO[m.situacao]?.texto ?? m.situacao}</span>
            {m.picking ? <span className="text-xs" style={{ color: "var(--text-muted)" }}> ({m.picking})</span> : null}
            {m.situacao === "erro" && m.mensagem ? <div className="text-xs" style={{ color: "var(--status-critical)" }}>{m.mensagem}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
