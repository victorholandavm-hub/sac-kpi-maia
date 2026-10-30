import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { DecidirTroca } from "@/components/assistencia/DecidirTroca";
import { AUTORIZADOR_TROCA_SAC, MODOS_TROCA, MOTIVOS_TROCA, type PedidoTroca } from "@/lib/odoo/trocaSac";

export const dynamic = "force-dynamic";

// Trocas de produto pedidas pelo SAC -- Victor 30/10/2026. Pendentes em cima
// (só o login do Victor vê os botões de autorizar/recusar), depois as últimas.

type Troca = {
  id: string;
  criado_em: string;
  pedido: string;
  cliente: string | null;
  chamado: string;
  solicitado_por: string;
  pedido_troca: PedidoTroca;
  valor_credito: number | null;
  total_novo: number | null;
  status: string;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo_recusa: string | null;
  resultado: { credito?: string; nf_troca?: string; numero?: string; pedido_novo?: string } | null;
  erro: string | null;
};

const brl = (v: number | null) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const COR: Record<string, string> = { pendente: "var(--status-warning)", executada: "var(--status-good)", recusada: "var(--text-muted)", parcial: "var(--status-serious)", erro: "var(--status-critical)" };
const ROTULO: Record<string, string> = { pendente: "Aguardando o Victor", executada: "Feita", recusada: "Recusada", parcial: "Feita em parte — falar com o TI", erro: "Erro — falar com o TI" };

function CartaoTroca({ t, podeDecidir }: { t: Troca; podeDecidir: boolean }) {
  const p = t.pedido_troca;
  const diferenca = (t.total_novo ?? 0) - (t.valor_credito ?? 0);
  return (
    <li className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderLeft: `4px solid ${COR[t.status] ?? "var(--border)"}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          <b>Pedido {t.pedido}</b> · {t.cliente ?? "—"} · chamado {t.chamado}
        </span>
        <span className="text-xs font-semibold" style={{ color: COR[t.status] }}>
          {ROTULO[t.status] ?? t.status}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Pedido por {t.solicitado_por} em {quando(t.criado_em)} · {MOTIVOS_TROCA.find((m) => m.codigo === p.motivo)?.nome ?? p.motivo} ·{" "}
        {MODOS_TROCA.find((m) => m.codigo === p.modo)?.nome ?? p.modo}
        {p.modo === "retira_depois" && p.filial_retirada ? ` (loja ${p.filial_retirada})` : ""}
        {p.modo === "entrega" && p.data_entrega ? ` (${p.data_entrega.split("-").reverse().join("/")})` : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Volta ({brl(t.valor_credito)} de crédito)
          </span>
          {p.itens.map((i) => (
            <div key={i.codigo}>
              {i.qtd} × <span className="font-mono">{i.codigo}</span> {i.descricao ?? ""}
            </div>
          ))}
        </div>
        <div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sai ({brl(t.total_novo)})
          </span>
          {p.novos.map((n) => (
            <div key={n.codigo}>
              {n.qtd} × <span className="font-mono">{n.codigo}</span> {n.nome} · {brl(n.preco)}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {diferenca > 0.009 ? `Cliente paga ${brl(diferenca)} por PIX.` : diferenca < -0.009 ? `Sobra ${brl(-diferenca)} de crédito para o cliente.` : "Sem diferença."} Justificativa: {p.justificativa}
      </p>
      {t.status === "executada" && t.resultado ? (
        <p className="text-xs" style={{ color: "var(--status-good)" }}>
          Crédito {t.resultado.credito ?? ""} (nota {t.resultado.nf_troca ?? t.resultado.numero ?? ""}) · pedido novo {t.resultado.pedido_novo ?? ""} · autorizada por {t.decidido_por} em {quando(t.decidido_em)}
        </p>
      ) : null}
      {t.status === "recusada" ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Recusada por {t.decidido_por} em {quando(t.decidido_em)}
          {t.motivo_recusa ? `: ${t.motivo_recusa}` : ""}
        </p>
      ) : null}
      {t.erro ? (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {t.erro}
        </p>
      ) : null}
      {t.status === "pendente" && podeDecidir ? <DecidirTroca id={t.id} /> : null}
    </li>
  );
}

export default async function TrocasSacPage() {
  const profile = await getProfile();
  if (!["sac", "assistencia", "admin"].includes(profile.role)) redirect("/assistencia/inicio");
  const { data } = await getSupabaseAdmin().from("trocas_sac").select("*").order("criado_em", { ascending: false }).limit(60).returns<Troca[]>();
  const todas = data ?? [];
  const pendentes = todas.filter((t) => t.status === "pendente");
  const outras = todas.filter((t) => t.status !== "pendente");
  const podeDecidir = profile.id === AUTORIZADOR_TROCA_SAC;
  return (
    <div className="max-w-6xl mx-auto w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Trocas de produto" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />
      {profile.role === "assistencia" ? (
        <Link href="/assistencia/pedidos" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          ← Consulta de pedido
        </Link>
      ) : (
        <SacTabs active="trocas" />
      )}
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Para pedir uma troca, abra o pedido na Consulta de pedido e clique em “Trocar produto”. {podeDecidir ? "Você autoriza ou recusa aqui." : "Quem autoriza é o Victor."}
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Aguardando autorização · {pendentes.length}
        </h2>
        {pendentes.length ? (
          <ul className="flex flex-col gap-3">
            {pendentes.map((t) => (
              <CartaoTroca key={t.id} t={t} podeDecidir={podeDecidir} />
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma.
          </p>
        )}
      </section>
      {outras.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Últimas trocas ({outras.length})
          </summary>
          <ul className="flex flex-col gap-3 mt-3">
            {outras.map((t) => (
              <CartaoTroca key={t.id} t={t} podeDecidir={false} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
