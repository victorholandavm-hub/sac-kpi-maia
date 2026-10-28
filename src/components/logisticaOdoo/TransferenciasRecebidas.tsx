import { listarTransferenciasLoja, type TransferenciaLoja } from "@/lib/odoo/logistica";

// 28/10/2026 (Pedro/Flávio): transferências que CHEGAM no CD (lojas mandando produto para o 213), com a observação
// que a loja escreveu na nota (avaria, cliente, mostruário...). Também mostra as enviadas, para conferência.
const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function dataHora(s: string) {
  const d = new Date(String(s).replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export async function TransferenciasRecebidas({ empresaAtual, sentido }: { empresaAtual: number; sentido: "recebida" | "enviada" }) {
  let lista: TransferenciaLoja[] = [];
  let erro = "";
  try {
    lista = (await listarTransferenciasLoja(empresaAtual || 13, 30)).filter((t) => t.sentido === sentido);
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  if (erro) return <p style={{ color: "var(--status-critical)" }}>Não carregou: {erro}</p>;
  if (!lista.length) return <p style={{ color: "var(--text-secondary)" }}>Nenhuma transferência {sentido === "recebida" ? "recebida" : "enviada"} nos últimos 30 dias.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "var(--text-secondary)" }}>
            <th className="text-left py-1 pr-3">Data</th>
            <th className="text-left pr-3">{sentido === "recebida" ? "Veio de" : "Foi para"}</th>
            <th className="text-left pr-3">NF</th>
            <th className="text-left pr-3">Itens</th>
            <th className="text-left pr-3">Observação da loja</th>
            <th className="text-right pr-3">Valor</th>
            <th className="text-left">DANFE</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((t) => (
            <tr key={t.chave || t.numero} style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <td className="py-2 pr-3 align-top whitespace-nowrap">{dataHora(t.data)}</td>
              <td className="pr-3 align-top"><b>{t.loja}</b></td>
              <td className="pr-3 align-top whitespace-nowrap">{t.numero}/{t.serie}<div className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.estado}</div></td>
              <td className="pr-3 align-top text-xs">{t.itens.map((i) => `${i.qtd}× ${i.codigo} ${i.nome}`).join(" · ")}</td>
              <td className="pr-3 align-top">{t.obs ? <b>{t.obs}</b> : <span style={{ color: "var(--text-secondary)" }}>—</span>}</td>
              <td className="pr-3 align-top text-right whitespace-nowrap">{brl(t.valor)}</td>
              <td className="align-top">{t.chave ? <a className="underline" href={`/assistencia/logistica/pdf/nota/${t.chave}`} target="_blank" rel="noreferrer">abrir</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
