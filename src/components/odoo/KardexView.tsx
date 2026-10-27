import { buscarProdutosCadastro, lerKardex, listarEmpresas, mensagemDeErro, type ProdutoCadastro } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Kardex só leitura pro SAC e a assistência -- Victor 27/10/2026. Cópia da
// tela do Pedro (assistencia/logistica/(cd)/kardex, que fica no login do CD),
// com a rota da própria página em `acao`. Mudança lá: refletir aqui.

function fmtData(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export type KardexBusca = { codigo?: string; empresa?: string; dias?: string };

export async function KardexView({ sp, acao }: { sp: KardexBusca; acao: string }) {
  const empresa = empresaDaUrl(sp.empresa);
  const codigo = (sp.codigo ?? "").trim().toUpperCase();
  const dias = Math.min(Math.max(Number(sp.dias) || 90, 1), 400);
  const empresas = await listarEmpresas().catch(() => []);
  let dados = null, erro = "";
  // 26/10 (Flávio): busca também pelo NOME -- sem cara de código, lista os produtos para escolher
  const ehCodigo = /^[A-Z]{0,3}\d{3,}[A-Z0-9-]*$/.test(codigo);
  let achados: ProdutoCadastro[] = [];
  if (codigo && !ehCodigo) {
    try { achados = await buscarProdutosCadastro(codigo); } catch (e) { erro = mensagemDeErro(e); }
    if (achados.length === 1) { try { dados = await lerKardex(achados[0].codigo, empresa, dias); achados = []; } catch (e) { erro = mensagemDeErro(e); } }
  } else if (codigo) {
    try { dados = await lerKardex(codigo, empresa, dias); } catch (e) { erro = mensagemDeErro(e); }
  }
  const cell = "px-2 py-1 border-b text-sm";
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Kardex do produto</h2>
      <form className="flex gap-2 flex-wrap items-end" method="get" action={acao}>
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Código ou nome
          <input name="codigo" defaultValue={codigo} placeholder="ex.: 071351 ou guarda roupa vitória" className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }} />
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Loja
          <select name="empresa" defaultValue={String(empresa)} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}>
            {empresas.filter((e) => /^2\d\d /.test(e.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Dias
          <input name="dias" defaultValue={String(dias)} className="rounded-lg border px-3 py-2 w-20" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }} />
        </label>
        <button className="text-sm font-semibold rounded-lg px-4 py-2 border" style={{ borderColor: "var(--brand-green)", background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>Consultar</button>
      </form>
      {erro ? <ErroOdoo titulo="Não consegui ler o Kardex" mensagem={erro} /> : null}
      {codigo && !ehCodigo && !dados && !erro ? (
        <div className="cartao p-4 flex flex-col gap-1 min-w-0">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {achados.length ? `${achados.length} produto(s) com "${codigo}". Clique no produto:` : `Nenhum produto com "${codigo}". Tente outra palavra ou o código.`}
          </p>
          {achados.map((a) => (
            <a key={a.id} href={`${acao}?codigo=${encodeURIComponent(a.codigo)}&empresa=${empresa}&dias=${dias}`} className="text-sm underline" style={{ color: "var(--text-primary)" }}>
              <b>{a.codigo}</b> {a.nome}{a.ativo ? "" : " (bloqueado)"}
            </a>
          ))}
        </div>
      ) : null}
      {dados ? (
        <div className="cartao p-4 flex flex-col gap-3 min-w-0">
          <div style={{ color: "var(--text-primary)" }}><b>{dados.codigo}</b> {dados.produto}</div>
          <div className="text-sm flex gap-4 flex-wrap" style={{ color: "var(--text-secondary)" }}>
            <span>Saldo: <b>{dados.saldo}</b></span><span>Reservado: <b>{dados.reservado}</b></span><span>Disponível: <b>{dados.disponivel}</b></span>
            <span>Saldo no início do período: <b>{dados.saldo_inicial_periodo}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ color: "var(--text-primary)" }}>
              <thead><tr style={{ color: "var(--text-secondary)" }}>
                <th className={cell + " text-left"}>Data</th><th className={cell + " text-left"}>Documento</th><th className={cell + " text-left"}>Origem / parceiro</th>
                <th className={cell}>Entrada</th><th className={cell}>Saída</th><th className={cell}>Saldo</th></tr></thead>
              <tbody>
                {dados.movimentos.map((m, i) => (
                  <tr key={i}>
                    <td className={cell}>{fmtData(m.data)}</td>
                    <td className={cell}>{m.documento}</td>
                    <td className={cell}>{[m.origem, m.parceiro].filter(Boolean).join(" · ")}</td>
                    <td className={cell + " text-center"}>{m.entrada || ""}</td>
                    <td className={cell + " text-center"}>{m.saida || ""}</td>
                    <td className={cell + " text-center"}><b>{m.saldo_apos}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados.movimentos.length === 0 ? <p className="text-sm p-2" style={{ color: "var(--text-secondary)" }}>Sem movimento no período.</p> : null}
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Movimentos do Odoo (desde a virada de 25/10). Antes disso, o histórico ficou no Protheus.</p>
        </div>
      ) : null}
    </div>
  );
}
