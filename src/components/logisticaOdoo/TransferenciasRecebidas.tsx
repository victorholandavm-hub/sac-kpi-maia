import { listarTransferenciasLoja, listarTransferenciasAceitar, type TransferenciaLoja, type TransferenciaAceitar } from "@/lib/odoo/logistica";
import { DevolverTransferencia } from "./DevolverTransferencia";
import { AceitarTransferencia } from "./AceitarTransferencia";

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
  // 29/10 (Antonio/CD + Pedro): as que AGUARDAM ACEITE (ainda não entraram no estoque) vêm no topo, com o botão de aceitar
  let pendentes: TransferenciaAceitar[] = [];
  let erroPend = "";
  try {
    lista = (await listarTransferenciasLoja(empresaAtual || 13, 30)).filter((t) => t.sentido === sentido);
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  if (sentido === "recebida") {
    try {
      pendentes = await listarTransferenciasAceitar(empresaAtual || 13);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      erroPend = /has no attribute|not found/i.test(m) ? "A conferência/aceite de transferências fica disponível depois da próxima atualização do Odoo (hoje à noite)." : `Não carregou as pendentes de aceite: ${m}`;
    }
  }
  const pendBloco = sentido === "recebida" ? (
    <div className="rounded-xl p-3 mb-4" style={{ border: `2px solid ${pendentes.length ? "var(--brand-orange)" : "var(--border)"}`, background: "var(--surface-1)" }}>
      <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>📥 Aguardando conferência e aceite ({pendentes.length})</h3>
      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>A mercadoria só entra no estoque do CD depois que alguém confere e aceita. Se chegou menos, informe a quantidade: o que faltou volta para a loja por nota de devolução automática.</p>
      {erroPend ? <p className="text-sm" style={{ color: "var(--status-critical)" }}>{erroPend}</p> : null}
      {!erroPend && !pendentes.length ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nenhuma transferência aguardando aceite.</p> : null}
      {pendentes.map((t) => (
        <div key={t.picking_id} className="py-2" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <div className="flex flex-wrap gap-x-3 items-baseline text-sm">
            <span className="whitespace-nowrap">{dataHora(t.data)}</span>
            <b>De {t.de}</b>
            <span className="whitespace-nowrap">NF {t.nota.numero}/{t.nota.serie}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>enviada por {t.enviado_por || "—"}{t.obs ? ` · obs: ${t.obs}` : ""}</span>
            {t.nota.chave ? <a className="underline text-xs" href={`/assistencia/logistica/pdf/nota/${t.nota.chave}`} target="_blank" rel="noreferrer">DANFE</a> : null}
          </div>
          <div className="text-xs my-1">{t.itens.map((i) => `${i.qtd}× ${i.codigo} ${i.nome}`).join(" · ")}</div>
          <AceitarTransferencia companyId={empresaAtual || 13} pickingId={t.picking_id} numero={`${t.nota.numero}/${t.nota.serie}`} de={t.de} itens={t.itens} />
        </div>
      ))}
    </div>
  ) : null;
  if (erro) return <>{pendBloco}<p style={{ color: "var(--status-critical)" }}>Não carregou: {erro}</p></>;
  if (!lista.length) return <>{pendBloco}<p style={{ color: "var(--text-secondary)" }}>Nenhuma transferência {sentido === "recebida" ? "recebida" : "enviada"} nos últimos 30 dias.</p></>;
  return (
    <div className="overflow-x-auto">
      {pendBloco}
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
            {sentido === "recebida" ? <th className="text-left pl-3">Ação</th> : null}
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
              {sentido === "recebida" ? <td className="align-top pl-3"><DevolverTransferencia companyId={empresaAtual || 13} chave={t.chave} numero={`${t.numero}/${t.serie}`} itens={t.itens} /></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
