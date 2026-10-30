"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buscarProdutosTrocaAction,
  pedirTrocaAction,
  previaTrocaAction,
  trazerVendaProtheusAction,
} from "@/app/assistencia/sac/troca/actions";
import { MODOS_TROCA, MOTIVOS_TROCA, totalNovos, type ItemNovo, type PedidoTroca, type ProdutoOdoo } from "@/lib/odoo/trocaSac";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campo = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" };
const cartao = "rounded-2xl p-4 flex flex-col gap-3";

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}

// Venda do Protheus que ainda não está no Odoo: traz antes de trocar.
export function TrazerVendaProtheus({ filial, cpf, chave, nf }: { filial: string; cpf: string; chave: string; nf: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className={cartao} style={{ background: "var(--surface-1)" }}>
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        A venda <b>NF {nf}</b> (loja {filial}) é do sistema antigo. Para trocar, ela precisa vir para o Odoo primeiro (fica como venda já entregue, com
        as notas antigas).
      </p>
      {erro ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {erro}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErro(null);
            const r = await trazerVendaProtheusAction(filial, cpf, chave);
            if (!r.ok) return setErro(r.erro);
            router.replace(`/assistencia/sac/troca?pedido=${encodeURIComponent(r.dados.pedido)}`);
          })
        }
        className="self-start rounded-xl px-5 py-2.5 text-sm font-semibold"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Trazendo a venda…" : "Trazer a venda para o Odoo"}
      </button>
    </div>
  );
}

type ItemPedido = { codigo: string; nome: string; qtd: number; preco: number };

export function TrocaSacForm({ pedido, pedidoId, cliente, loja, itens }: { pedido: string; pedidoId: number; cliente: string | null; loja: string; itens: ItemPedido[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [volta, setVolta] = useState<Record<string, number>>({});
  const [credito, setCredito] = useState<number | null>(null);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<ProdutoOdoo[]>([]);
  const [novos, setNovos] = useState<ItemNovo[]>([]);
  const [modo, setModo] = useState<PedidoTroca["modo"]>("entrega");
  const [filialRetirada, setFilialRetirada] = useState(loja);
  const [dataEntrega, setDataEntrega] = useState("");
  const [motivo, setMotivo] = useState<PedidoTroca["motivo"]>("defeito");
  const [justificativa, setJustificativa] = useState("");
  const [chamado, setChamado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  const itensVolta = Object.entries(volta)
    .filter(([, q]) => q > 0)
    .map(([codigo, qtd]) => ({ codigo, qtd }));

  // Prévia do crédito sempre que muda o que volta.
  useEffect(() => {
    if (itensVolta.length === 0) return;
    let vivo = true;
    const t = setTimeout(() => {
      previaTrocaAction(pedidoId, itensVolta).then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setCredito(r.dados.valor);
          setErroPrevia(null);
        } else setErroPrevia(r.erro);
      });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula pelo conteúdo, não pela referência do array
  }, [pedidoId, JSON.stringify(itensVolta)]);

  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      buscarProdutosTrocaAction(q).then((r) => vivo && setAchados(r.ok ? r.dados : []));
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca]);

  // Prévia/achados só valem enquanto há o que mostrar (sem setState no efeito pra limpar).
  const creditoAtual = itensVolta.length ? credito : null;
  const achadosAtuais = busca.trim().length >= 2 ? achados : [];
  const total = totalNovos(novos);
  const diferenca = creditoAtual === null ? null : Math.round((total - creditoAtual) * 100) / 100;

  if (feito) {
    return (
      <div className={cartao} style={{ background: "var(--surface-1)", border: "1px solid var(--status-good)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--status-good)" }}>
          Pedido de troca enviado para o Victor autorizar.
        </p>
        <Link href="/assistencia/sac/trocas" className="text-sm underline" style={{ color: "var(--text-primary)" }}>
          Ver as trocas pedidas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cartao} style={{ background: "var(--surface-1)" }}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Pedido {pedido}
          </span>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {cliente ?? "cliente sem nome"} · loja {loja}
          </span>
        </div>
        <Rotulo>1. O que volta</Rotulo>
        <ul className="flex flex-col gap-2">
          {itens.map((i) => (
            <li key={i.codigo} className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-primary)" }}>
              <input
                type="number"
                min={0}
                max={i.qtd}
                step={1}
                value={volta[i.codigo] ?? 0}
                onChange={(e) => setVolta((v) => ({ ...v, [i.codigo]: Math.max(0, Math.min(i.qtd, Number(e.target.value) || 0)) }))}
                className="w-20 rounded-lg px-2 py-1.5 text-sm"
                style={campo}
                aria-label={`Quantidade de ${i.nome} que volta`}
              />
              <span>
                de {i.qtd} × <span className="font-mono">{i.codigo}</span> {i.nome}
              </span>
            </li>
          ))}
        </ul>
        {erroPrevia ? (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {erroPrevia}
          </p>
        ) : creditoAtual !== null ? (
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Crédito do que volta: <b>{brl(creditoAtual)}</b>
          </p>
        ) : null}
      </div>

      <div className={cartao} style={{ background: "var(--surface-1)" }}>
        <Rotulo>2. Produto novo</Rotulo>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou nome do produto" className="rounded-lg px-3 py-2 text-sm" style={campo} />
        {achadosAtuais.length ? (
          <ul className="flex flex-col max-h-56 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            {achadosAtuais.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setNovos((n) => [...n.filter((x) => x.codigo !== a.default_code), { codigo: a.default_code, nome: a.name, qtd: 1, preco: Number(a.list_price ?? 0) }]);
                    setBusca("");
                    setAchados([]);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                  style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <span className="font-mono">{a.default_code}</span> {a.name} · {brl(Number(a.list_price ?? 0))}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {novos.length ? (
          <ul className="flex flex-col gap-2">
            {novos.map((n) => (
              <li key={n.codigo} className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-primary)" }}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={n.qtd}
                  onChange={(e) => setNovos((l) => l.map((x) => (x.codigo === n.codigo ? { ...x, qtd: Math.max(1, Number(e.target.value) || 1) } : x)))}
                  className="w-20 rounded-lg px-2 py-1.5 text-sm"
                  style={campo}
                  aria-label={`Quantidade de ${n.nome}`}
                />
                <span>
                  × <span className="font-mono">{n.codigo}</span> {n.nome} · {brl(n.preco)}
                </span>
                <button type="button" onClick={() => setNovos((l) => l.filter((x) => x.codigo !== n.codigo))} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                  tirar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {novos.length && diferenca !== null ? (
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Produto novo: <b>{brl(total)}</b> ·{" "}
            {diferenca > 0.009 ? (
              <>
                o cliente paga a diferença de <b>{brl(diferenca)}</b> por <b>PIX</b>
              </>
            ) : diferenca < -0.009 ? (
              <>
                sobra <b>{brl(-diferenca)}</b> de crédito para o cliente
              </>
            ) : (
              <>sem diferença</>
            )}
          </p>
        ) : null}
      </div>

      <div className={cartao} style={{ background: "var(--surface-1)" }}>
        <Rotulo>3. Como sai, motivo e chamado</Rotulo>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Como o produto novo sai
            <select value={modo} onChange={(e) => setModo(e.target.value as PedidoTroca["modo"])} className="rounded-lg px-3 py-2 text-sm" style={campo}>
              {MODOS_TROCA.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          {modo === "retira_depois" ? (
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Loja onde o cliente retira
              <input value={filialRetirada} onChange={(e) => setFilialRetirada(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="ex.: 205" className="rounded-lg px-3 py-2 text-sm" style={campo} />
            </label>
          ) : modo === "entrega" ? (
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Data de entrega (opcional)
              <input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={campo} />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as PedidoTroca["motivo"])} className="rounded-lg px-3 py-2 text-sm" style={campo}>
              {MOTIVOS_TROCA.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Número do chamado *
            <input value={chamado} onChange={(e) => setChamado(e.target.value)} placeholder="ex.: 4821" className="rounded-lg px-3 py-2 text-sm" style={campo} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Justificativa *
          <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} className="rounded-lg px-3 py-2 text-sm" style={campo} placeholder="O que aconteceu e o que o cliente pediu" />
        </label>
        {erro ? (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {erro}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErro(null);
              const r = await pedirTrocaAction({
                pedido,
                pedidoId,
                cliente,
                chamado,
                troca: { itens: itensVolta, novos, modo, filial_retirada: filialRetirada, data_entrega: dataEntrega, motivo, justificativa },
              });
              if (!r.ok) return setErro(r.erro);
              setFeito(true);
              router.refresh();
            })
          }
          className="self-start rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Enviando…" : "Pedir autorização ao Victor"}
        </button>
      </div>
    </div>
  );
}
