import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { nomePedidoOdoo } from "@/lib/pedidoOdoo";

// Expedição só leitura pro SAC e a assistência -- Victor 27/10/2026 ("só
// visualizar e pesquisar"). Lê odoo_expedicao (leitura do Odoo a cada 30 min,
// odooExpedicaoSync.ts): as saídas vistas na última leitura da expedição.
// Nenhum botão de ação -- montar carga, pendência etc. continuam na tela do CD.

const MAX_LINHAS = 300;
const JANELA_LEITURA_MS = 20 * 60_000;

export type ExpedicaoBusca = { q?: string; loja?: string; situacao?: string };

type Linha = {
  picking_id: number;
  pedido: string;
  cliente: string | null;
  telefone: string | null;
  empresa: string | null;
  modo: string | null;
  expresso: boolean | null;
  retira_em: string | null;
  data_programada: string | null;
  pendencia_motivo: string | null;
  carga_romaneio: string | null;
  carga_estado: string | null;
  nf5922: string | null;
  nf5117: string | null;
  legado: boolean;
  na_expedicao_em: string;
};

const SITUACOES = [
  { valor: "", rotulo: "Todas" },
  { valor: "aguardando", rotulo: "Aguardando carga" },
  { valor: "em_carga", rotulo: "Em carga" },
  { valor: "pendencia", rotulo: "Pendência" },
  { valor: "retira", rotulo: "Cliente retira" },
];

const ESTADO_CARGA: Record<string, string> = {
  montagem: "montagem",
  separacao: "em separação",
  conferida: "conferida",
  liberada: "liberada",
  em_rota: "em rota",
  finalizada: "finalizada",
};

const dia = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function situacao(l: Linha): { texto: string; cor: string } {
  if (l.pendencia_motivo) return { texto: `Pendência: ${l.pendencia_motivo}`, cor: "var(--status-critical)" };
  if (l.carga_romaneio) return { texto: `Carga ${l.carga_romaneio}${l.carga_estado ? ` (${ESTADO_CARGA[l.carga_estado] ?? l.carga_estado})` : ""}`, cor: "var(--status-warning)" };
  if (l.modo?.startsWith("retira")) return { texto: "Aguardando o cliente retirar", cor: "var(--brand-orange)" };
  return { texto: "Aguardando carga", cor: "var(--text-muted)" };
}

export async function ExpedicaoLeituraView({ sp, acao, consulta }: { sp: ExpedicaoBusca; acao: string; consulta: string }) {
  const admin = getSupabaseAdmin();
  const { data: ultima } = await admin.from("odoo_expedicao").select("na_expedicao_em").not("na_expedicao_em", "is", null).order("na_expedicao_em", { ascending: false }).limit(1);
  const lidaEm = ultima?.[0]?.na_expedicao_em as string | undefined;
  const q = (sp.q ?? "").trim();
  const loja = (sp.loja ?? "").trim();
  const sit = SITUACOES.some((s) => s.valor === sp.situacao) ? (sp.situacao ?? "") : "";

  let linhas: Linha[] = [];
  let lojas: string[] = [];
  if (lidaEm) {
    const desde = new Date(new Date(lidaEm).getTime() - JANELA_LEITURA_MS).toISOString();
    const { data: todasLojas } = await admin.from("odoo_expedicao").select("empresa").gte("na_expedicao_em", desde).returns<{ empresa: string | null }[]>();
    lojas = [...new Set((todasLojas ?? []).map((l) => l.empresa).filter((e): e is string => !!e))].sort();
    let consultaDb = admin
      .from("odoo_expedicao")
      .select("picking_id, pedido, cliente, telefone, empresa, modo, expresso, retira_em, data_programada, pendencia_motivo, carga_romaneio, carga_estado, nf5922, nf5117, legado, na_expedicao_em")
      .gte("na_expedicao_em", desde);
    if (loja) consultaDb = consultaDb.eq("empresa", loja);
    if (sit === "pendencia") consultaDb = consultaDb.not("pendencia_motivo", "is", null);
    if (sit === "em_carga") consultaDb = consultaDb.is("pendencia_motivo", null).not("carga_romaneio", "is", null);
    if (sit === "aguardando") consultaDb = consultaDb.is("pendencia_motivo", null).is("carga_romaneio", null).not("modo", "like", "retira%");
    if (sit === "retira") consultaDb = consultaDb.is("pendencia_motivo", null).is("carga_romaneio", null).like("modo", "retira%");
    if (q) {
      const nome = nomePedidoOdoo(q);
      const d = q.replace(/\D/g, "");
      if (nome) consultaDb = consultaDb.eq("pedido", nome);
      else if (d && d.length === q.replace(/[\s./-]/g, "").length) consultaDb = consultaDb.or(`nf5922.like.${d}*,nf5117.like.${d}*,telefone.like.*${d}*`);
      else consultaDb = consultaDb.ilike("cliente", `%${q.replace(/[%_,()]/g, " ")}%`);
    }
    const { data } = await consultaDb.order("data_programada", { ascending: true, nullsFirst: false }).order("pedido").limit(MAX_LINHAS + 1).returns<Linha[]>();
    linhas = data ?? [];
  }

  const campo = { background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" };
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Saídas na expedição do Odoo (entregas e retiradas ainda não concluídas), só para consulta.
        {lidaEm ? ` Última leitura: ${hora(lidaEm)} (atualiza a cada 30 min).` : " Ainda não houve leitura."}
      </p>
      <form action={acao} method="GET" className="flex flex-wrap gap-2 items-end">
        <input name="q" defaultValue={q} placeholder="Cliente, pedido (S01720), nota ou telefone" className="flex-1 min-w-[220px] rounded-xl px-4 py-2.5 text-sm" style={campo} />
        <select name="loja" defaultValue={loja} className="rounded-xl px-3 py-2.5 text-sm" style={campo}>
          <option value="">Todas as lojas</option>
          {lojas.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select name="situacao" defaultValue={sit} className="rounded-xl px-3 py-2.5 text-sm" style={campo}>
          {SITUACOES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          Filtrar
        </button>
      </form>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {linhas.length > MAX_LINHAS ? `Mostrando as primeiras ${MAX_LINHAS}. Filtre por loja ou situação.` : `${linhas.length} saída${linhas.length === 1 ? "" : "s"}.`}
      </p>
      <div className="overflow-x-auto rounded-2xl" style={{ background: "var(--surface-1)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-left" style={{ color: "var(--text-muted)" }}>
              <th className="px-3 py-2 font-medium">Pedido</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Loja</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Programado</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, MAX_LINHAS).map((l) => {
              const s = situacao(l);
              return (
                <tr key={l.picking_id} className="border-t align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    <a href={`${consulta}?q=${encodeURIComponent(l.pedido)}`} className="underline font-medium">
                      {l.pedido}
                    </a>
                    {l.legado ? (
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                        venda do Protheus
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {l.cliente ?? "—"}
                    {l.telefone ? (
                      <span className="block text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {l.telefone}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.empresa ?? "—"}</td>
                  <td className="px-3 py-2">
                    {l.modo?.startsWith("retira") ? `Retira${l.retira_em ? ` em ${l.retira_em}` : ""}` : l.expresso ? "Entrega express" : "Entrega"}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{dia(l.data_programada)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-start gap-1.5">
                      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: s.cor }} />
                      {s.texto}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {[l.nf5922 ? `venda ${l.nf5922}` : null, l.nf5117 ? `entrega ${l.nf5117}` : null].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {linhas.length === 0 ? (
          <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
            Nada na expedição com esse filtro.
          </p>
        ) : null}
      </div>
    </div>
  );
}
