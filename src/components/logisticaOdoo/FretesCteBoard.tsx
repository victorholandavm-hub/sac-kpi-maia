"use client";

import { useRef, useState } from "react";
import type { CteFrete, CteLista, CteNfe, CteSituacao } from "@/lib/odoo/cte";
import { lerCteAction, subirXmlCteAction, vincularNfeCteAction } from "@/app/assistencia/logistica/cte-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 29/10/2026 (Pedro → Eduardo/CD): aba "Fretes (CT-e)". Os conhecimentos de frete chegam sozinhos (robô, a cada 4 h) e o
// frete é dividido entre as notas e os itens de hora em hora. Aqui o Eduardo só confere e resolve o que travou:
// CT-e sem nota (Vincular NF-e) e CT-e que o robô não pegou (Subir XML). Nada aqui mexe em custo do produto.

const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = (s: string) => (s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s || "—");
const cnpjFmt = (c: string) => (c && c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c || "");

const COR: Record<CteSituacao, string> = {
  sem_nfe: "var(--status-critical)",
  faltam_nfe: "var(--brand-orange)",
  aguardando_rateio: "var(--text-secondary)",
  rateado: "var(--brand-green)",
  tomador_terceiro: "var(--text-secondary)",
  cancelado: "var(--text-secondary)",
};
const ROTULO: Record<CteSituacao, string> = {
  sem_nfe: "Sem nota",
  faltam_nfe: "Falta nota",
  aguardando_rateio: "Aguardando cálculo",
  rateado: "Rateado",
  tomador_terceiro: "Frete de terceiro",
  cancelado: "Cancelado",
};

function Selo({ s }: { s: CteSituacao }) {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap" style={{ borderColor: COR[s], color: COR[s] }}>
      {ROTULO[s]}
    </span>
  );
}

function LinhaNfe({ n, mostrarItens }: { n: CteNfe; mostrarItens: boolean }) {
  return (
    <>
      <tr style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
        <td className="py-1.5 pr-3 whitespace-nowrap">
          <b>{n.numero || "—"}</b>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }} title={n.chave}>
            …{n.chave.slice(-10)} {n.vinculo === "manual" ? `· vinculada à mão${n.vinculado_por ? ` por ${n.vinculado_por}` : ""}` : ""}
          </div>
        </td>
        <td className="pr-3">
          {n.fornecedor || <span style={{ color: "var(--text-secondary)" }}>{cnpjFmt(n.cnpj_fornecedor)}</span>}
          {n.emissao ? <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{data(n.emissao)}</div> : null}
        </td>
        <td className="pr-3 text-right whitespace-nowrap">{n.valor ? brl(n.valor) : "—"}</td>
        <td className="pr-3 whitespace-nowrap">
          {n.no_cmv ? <span style={{ color: "var(--brand-green)" }}>nota baixada</span> : <span style={{ color: "var(--brand-orange)" }}>nota ainda não baixada</span>}
        </td>
        <td className="pr-3 whitespace-nowrap">
          {n.no_odoo ? (
            <span style={{ color: "var(--brand-green)" }}>entrada dada{n.odoo_empresa ? ` (${n.odoo_empresa.slice(0, 3)})` : ""}</span>
          ) : (
            <span style={{ color: "var(--text-secondary)" }}>sem entrada aqui</span>
          )}
        </td>
        <td className="text-right whitespace-nowrap">{n.frete_rateado ? brl(n.frete_rateado) : <span style={{ color: "var(--text-secondary)" }}>—</span>}</td>
      </tr>
      {mostrarItens && n.itens && n.itens.length ? (
        <tr>
          <td colSpan={6} className="pb-2 pl-4">
            <table className="text-xs w-full">
              <thead>
                <tr style={{ color: "var(--text-secondary)" }}>
                  <th className="text-left pr-2">Item</th>
                  <th className="text-left pr-2">Produto</th>
                  <th className="text-right pr-2">Qtd</th>
                  <th className="text-right pr-2">Valor</th>
                  <th className="text-right pr-2">Frete do item</th>
                  <th className="text-right">Custo unit. final</th>
                </tr>
              </thead>
              <tbody>
                {n.itens.map((i) => (
                  <tr key={i.n_item} style={{ color: "var(--text-primary)" }}>
                    <td className="pr-2">{i.n_item}</td>
                    <td className="pr-2">
                      {i.codigo} {i.descricao}
                    </td>
                    <td className="text-right pr-2">{i.qtd}</td>
                    <td className="text-right pr-2">{brl(i.valor)}</td>
                    <td className="text-right pr-2">{i.frete_cte ? brl(i.frete_cte) : "—"}</td>
                    <td className="text-right">{i.custo_unit_final ? brl(i.custo_unit_final) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Vincular({ cte, aoGravar }: { cte: CteFrete; aoGravar: (c: CteFrete) => void }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const chaves = texto.split(/[\s,;]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean);
  const invalidas = chaves.filter((c) => c.length !== 44 || c.slice(20, 22) !== "55");
  if (!aberto) {
    return (
      <button type="button" className={botaoClass} style={botaoPrimarioStyle} onClick={() => setAberto(true)}>
        Vincular NF-e
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <label className="text-sm" style={{ color: "var(--text-primary)" }}>
        Chave da NF-e (44 números). Pode colar mais de uma, uma por linha. Pegue a chave na DANFE que veio com a mercadoria.
      </label>
      <textarea className={inputClass} style={{ ...inputStyle, minHeight: 70, fontFamily: "monospace" }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="25261012345678000190550010001234561000123456" />
      {invalidas.length ? (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {invalidas.length} chave(s) inválida(s): precisa ter 44 números e ser de NF-e (posições 21-22 = 55).
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className={botaoClass}
          style={botaoPrimarioStyle}
          disabled={pending || !chaves.length || invalidas.length > 0}
          onClick={() =>
            run(
              () => vincularNfeCteAction(cte.chave, chaves),
              (r) => r.mensagem,
              (r) => {
                setAberto(false);
                setTexto("");
                if (r.cte) aoGravar(r.cte);
              },
            )
          }
        >
          {pending ? "Gravando…" : `Gravar vínculo (${chaves.length})`}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Linha({ inicial }: { inicial: CteFrete }) {
  const [cte, setCte] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [detalhe, setDetalhe] = useState(false);
  const { showToast } = useAcaoOdoo();
  async function abrir() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !detalhe && cte.nfes.length) {
      setCarregando(true);
      const r = await lerCteAction(cte.chave);
      setCarregando(false);
      if (r.ok) {
        setCte(r.dados);
        setDetalhe(true);
      } else showToast(r.erro, "error");
    }
  }
  const podeVincular = cte.situacao === "sem_nfe" || cte.situacao === "faltam_nfe" || cte.situacao === "aguardando_rateio";
  return (
    <>
      <tr style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }} onClick={abrir}>
        <td className="py-2 pr-3 whitespace-nowrap align-top">{data(cte.emissao)}</td>
        <td className="pr-3 whitespace-nowrap align-top">
          <b>{cte.numero}</b>
          {cte.serie ? <span style={{ color: "var(--text-secondary)" }}>/{cte.serie}</span> : null}
          <div className="text-xs" style={{ color: "var(--text-secondary)" }} title={cte.chave}>
            …{cte.chave.slice(-10)}
          </div>
        </td>
        <td className="pr-3 align-top">
          {cte.transportadora.nome || cnpjFmt(cte.transportadora.cnpj)}
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {cte.modal_texto}
            {cte.tp_serv && cte.tp_serv !== "0" ? ` · ${cte.tp_serv_texto}` : ""}
            {cte.origem ? ` · ${cte.origem} → ${cte.destino}` : ""}
          </div>
        </td>
        <td className="pr-3 align-top">
          {cte.remetente.nome || "—"}
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {cte.qtd_nfe ? `${cte.qtd_nfe} nota${cte.qtd_nfe > 1 ? "s" : ""}: ${cte.nfes.map((n) => n.numero).filter(Boolean).slice(0, 4).join(", ")}${cte.qtd_nfe > 4 ? "…" : ""}` : "nenhuma nota informada"}
          </div>
        </td>
        <td className="pr-3 whitespace-nowrap align-top">
          {cte.tomador.aiam ? <span style={{ color: "var(--brand-green)" }}>nós pagamos</span> : <span style={{ color: "var(--text-secondary)" }}>{cte.tomador.descricao}</span>}
        </td>
        <td className="pr-3 text-right whitespace-nowrap align-top">
          <b>{brl(cte.valor_frete)}</b>
          {cte.frete_rateado_total ? (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>rateado {brl(cte.frete_rateado_total)}</div>
          ) : null}
        </td>
        <td className="align-top">
          <Selo s={cte.situacao} />
        </td>
      </tr>
      {aberto ? (
        <tr>
          <td colSpan={7} className="pb-3 pl-2 pr-2">
            <div className="flex flex-col gap-3 p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                <b>{ROTULO[cte.situacao]}:</b> {cte.situacao_texto}
                {cte.sem_xml ? " (o arquivo deste CT-e não está mais na pasta; os dados vieram do registro do robô)" : ""}
              </p>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Chave {cte.chave} · transportadora {cnpjFmt(cte.transportadora.cnpj)} · nosso CNPJ {cnpjFmt(cte.cnpj_aiam)}
                {cte.arquivo ? ` · arquivo ${cte.arquivo}` : ""}
              </div>
              {cte.nfes.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "var(--text-secondary)" }}>
                        <th className="text-left pr-3">NF-e</th>
                        <th className="text-left pr-3">Fornecedor</th>
                        <th className="text-right pr-3">Valor da nota</th>
                        <th className="text-left pr-3">Nota</th>
                        <th className="text-left pr-3">Entrada</th>
                        <th className="text-right">Frete rateado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cte.nfes.map((n) => (
                        <LinhaNfe key={n.chave} n={n} mostrarItens={detalhe} />
                      ))}
                    </tbody>
                  </table>
                  {carregando ? (
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      Carregando o rateio por item…
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Este CT-e não informa a chave de nenhuma NF-e. Informe abaixo a chave da nota que veio com ele.
                </p>
              )}
              {podeVincular && !cte.cancelado ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <Vincular cte={cte} aoGravar={(c) => setCte(c)} />
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function SubirXml() {
  const { pending, run } = useAcaoOdoo();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const nome = f.name;
          f.text().then((xml) => {
            run(() => subirXmlCteAction(xml, nome), (r) => r.mensagem);
          });
          e.target.value = "";
        }}
      />
      <button type="button" className={botaoClass} style={botaoStyle} disabled={pending} onClick={() => ref.current?.click()}>
        {pending ? "Enviando…" : "Subir XML do CT-e"}
      </button>
    </>
  );
}

export function FretesCteBoard({ lista, dias, q }: { lista: CteLista; dias: number; q: string }) {
  const [filtro, setFiltro] = useState<CteSituacao | "todas">("todas");
  const ordem: CteSituacao[] = ["sem_nfe", "faltam_nfe", "aguardando_rateio", "rateado", "tomador_terceiro", "cancelado"];
  const visiveis = filtro === "todas" ? lista.ctes : lista.ctes.filter((c) => c.situacao === filtro);
  const pendentes = (lista.totais.sem_nfe || 0) + (lista.totais.faltam_nfe || 0);
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <form method="get" className="flex gap-2 flex-wrap items-end">
        <label className="text-sm flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
          Procurar
          <input name="q" defaultValue={q} className={inputClass} style={{ ...inputStyle, minWidth: 280 }} placeholder="nº do CT-e, transportadora, nº da nota ou chave" />
        </label>
        <label className="text-sm flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
          Período
          <select name="dias" defaultValue={String(dias)} className={inputClass} style={inputStyle}>
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
            <option value="180">180 dias</option>
            <option value="400">tudo</option>
          </select>
        </label>
        <button type="submit" className={botaoClass} style={botaoPrimarioStyle}>
          Buscar
        </button>
        <div className="ml-auto flex gap-2 items-end">
          <SubirXml />
        </div>
      </form>

      <div className="flex gap-2 flex-wrap">
        <button type="button" className="text-sm px-3 py-1.5 rounded-full border font-semibold" onClick={() => setFiltro("todas")}
          style={{ borderColor: filtro === "todas" ? "var(--brand-green)" : "var(--border)", background: filtro === "todas" ? "var(--surface-2)" : "transparent", color: "var(--text-primary)" }}>
          Todos ({lista.total})
        </button>
        {ordem.map((s) => (
          <button key={s} type="button" className="text-sm px-3 py-1.5 rounded-full border font-semibold" onClick={() => setFiltro(s)}
            style={{ borderColor: filtro === s ? COR[s] : "var(--border)", background: filtro === s ? "var(--surface-2)" : "transparent", color: "var(--text-primary)" }}>
            {ROTULO[s]} ({lista.totais[s] || 0})
            <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>
              {" "}
              · {brl(lista.valor_por_situacao[s] || 0)}
            </span>
          </button>
        ))}
      </div>

      {pendentes ? (
        <p className="text-sm" style={{ color: "var(--brand-orange)" }}>
          {pendentes} CT-e precisando de você: {lista.totais.sem_nfe ? `${lista.totais.sem_nfe} sem nota (informe a chave da NF-e)` : ""}
          {lista.totais.sem_nfe && lista.totais.faltam_nfe ? " e " : ""}
          {lista.totais.faltam_nfe ? `${lista.totais.faltam_nfe} com nota que ainda não baixou (o robô tenta de novo em até 4 h; se continuar, confira se a nota foi emitida contra o nosso CNPJ)` : ""}.
        </p>
      ) : (
        <p className="text-sm" style={{ color: "var(--brand-green)" }}>
          Nenhum CT-e travado no período. Tudo o que é nosso já está rateado ou entra no próximo cálculo.
        </p>
      )}

      {visiveis.length ? (
        <div className="overflow-x-auto cartao p-3">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-secondary)" }}>
                <th className="text-left py-1 pr-3">Emissão</th>
                <th className="text-left pr-3">CT-e</th>
                <th className="text-left pr-3">Transportadora</th>
                <th className="text-left pr-3">Fornecedor / notas</th>
                <th className="text-left pr-3">Quem paga</th>
                <th className="text-right pr-3">Frete</th>
                <th className="text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <Linha key={c.chave} inicial={c} />
              ))}
            </tbody>
          </table>
          {lista.limitado ? (
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
              Mostrando os 600 mais recentes. Use a busca ou um período menor.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Nenhum CT-e {filtro === "todas" ? "" : `"${ROTULO[filtro]}" `}no período{q ? ` para "${q}"` : ""}.
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Atualizado {lista.atualizado}. Os CT-e chegam sozinhos a cada 4 h e o frete é dividido entre as notas e os itens de hora em hora. Frete de terceiro (CIF do fornecedor ou subcontratação entre transportadoras) não entra no nosso custo.
      </p>
    </div>
  );
}
