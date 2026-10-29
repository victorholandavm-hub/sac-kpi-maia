"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ModalLogistica } from "./ModalLogistica";
import { Recolhivel } from "./Recolhivel";
import {
  formatarDocumento,
  grupoDaCarga,
  MINUTOS_SEM_BAIXA_ALERTA,
  regioesVisiveis,
  situacaoBaixa,
  resumirRotas,
  STATUS_CARGA_ORDEM,
  resumoStatusCargas,
  type CargaRota,
  type GrupoRota,
  type NotaRota,
  type RotasDoDia as Rotas,
} from "@/lib/rotasDoDiaCore";

// Mural "Rotas de hoje" -- pedido do Victor 17/10/2026: as rotas do dia no
// topo da logística, antes dos KPIs, com a luz verde de "ao vivo", mais
// detalhe que o Monitor de Cargas e separado em nossos e terceirizados. Os
// dados vêm da rodada rápida do sync (a cada 10 min) e a página recarrega
// sozinha (FiltrosLogistica). Visual do painel escuro (mesmo dia): números
// grandes, barras finas estilo player, cartões arredondados sem borda.

const COR = {
  entregue: "var(--status-good)",
  parcial: "var(--status-warning)",
  voltou: "var(--status-critical)",
  pendente: "var(--surface-2)",
};

const COR_GRUPO: Record<GrupoRota, string> = {
  "Próprio": "var(--brand-green)",
  Terceirizado: "var(--series-5)",
  "No CD": "var(--text-muted)",
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pctTexto(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function tempo(min: number) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function iniciais(nome: string | null | undefined) {
  const p = (nome ?? "?").replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase();
}

function diaCurto(iso: string) {
  return iso.split("-").reverse().slice(0, 2).join("/");
}

// Barra fina segmentada (estilo player): 2px de respiro entre os trechos.
function BarraFina({ partes, total, alta = "h-1.5" }: { partes: { n: number; cor: string; rotulo: string }[]; total: number; alta?: string }) {
  const visiveis = partes.filter((p) => p.n > 0);
  return (
    <span
      className={`flex ${alta} w-full gap-[2px] rounded-full overflow-hidden`}
      style={{ background: "var(--surface-2)" }}
      role="img"
      aria-label={visiveis.map((p) => `${p.n} ${p.rotulo}`).join(", ") || "sem dados"}
    >
      {visiveis.map((p) => (
        <span key={p.rotulo} className="h-full" style={{ width: `${(p.n / Math.max(1, total)) * 100}%`, background: p.cor }} />
      ))}
    </span>
  );
}

function Legenda({ itens }: { itens: { cor: string; texto: string }[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
      {itens.map((i) => (
        <span key={i.texto} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: i.cor }} />
          {i.texto}
        </span>
      ))}
    </span>
  );
}

// Clicável (Victor 18/10/2026): o card abre a janela com o detalhe do número.
function Destaque({ rotulo, valor, onAbrir, children }: { rotulo: string; valor: string; onAbrir: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      title={`Ver detalhe: ${rotulo.toLowerCase()}`}
      className="group w-full text-left rounded-2xl p-5 flex flex-col gap-3 min-w-0 shadow-lg shadow-black/20 transition-colors hover:bg-[var(--surface-2)]"
      style={{ background: "var(--surface-1)" }}
    >
      <span className="flex items-center justify-between gap-2 w-full text-sm" style={{ color: "var(--text-secondary)" }}>
        {rotulo}
        <ChevronRight aria-hidden size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
      </span>
      <span className="text-4xl font-bold tracking-tight tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
        {valor}
      </span>
      {children}
    </button>
  );
}

function CartaoCarga({ c, grupo, dia, agora, onAbrir }: { c: CargaRota; grupo: GrupoRota; dia: string; agora: string; onAbrir: () => void }) {
  const { desde, parada: estaParada, texto: textoBaixa } = situacaoBaixa(c, dia, agora);
  const deOutroDia = c.dia < dia;
  const regioes = regioesVisiveis(c.regioes);
  const produtos = c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
  const comResultado = c.notas - c.pendentes;
  const conclusao = c.notas > 0 ? comResultado / c.notas : null;
  const voltaram = c.naoEntregues + c.canceladas;
  const corGrupo = COR_GRUPO[grupo];
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="w-full text-left rounded-2xl p-5 flex flex-col gap-4 transition-colors hover:bg-[var(--surface-2)] shadow-lg shadow-black/20"
        style={{ background: "var(--surface-1)", outline: estaParada ? "1px solid var(--status-warning)" : undefined }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: `color-mix(in srgb, ${corGrupo} 18%, transparent)`, color: corGrupo }}
          >
            {iniciais(c.motorista?.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {c.motorista?.nome ?? "Sem motorista"}
            </p>
            <p className="text-xs truncate opacity-80" style={{ color: "var(--text-secondary)" }}>
              {c.tipoVeiculo === "Carro" ? "Strada" : c.tipoVeiculo === "Caminhão" ? "Caminhão" : "Sem placa"}
              {c.veiculo ? ` ${c.veiculo}` : ""} · #{c.carga}
              {c.vinculo === "Terceirizado" && c.transportadora ? ` · ${c.transportadora}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
              {pctTexto(conclusao)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              concluído
            </p>
          </div>
        </div>

        <BarraFina
          total={c.notas}
          partes={[
            { n: c.entregues, cor: COR.entregue, rotulo: "entregues" },
            { n: c.parciais, cor: COR.parcial, rotulo: "parciais" },
            { n: voltaram, cor: COR.voltou, rotulo: "voltaram" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
              {STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status ?? "—"}
            </span>
            {deOutroDia && (
              <span
                className="rounded-full px-2.5 py-1 font-medium"
                style={{ background: "color-mix(in srgb, var(--status-warning) 18%, transparent)", color: "var(--text-primary)" }}
                title="Carga de outro dia que continua em rota"
              >
                desde {diaCurto(c.dia)}
              </span>
            )}
            <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
              <b style={{ color: "var(--text-primary)" }}>{comResultado}</b>/{c.notas} notas
              {voltaram > 0 ? ` · ${voltaram} ${voltaram === 1 ? "voltou" : "voltaram"}` : ""}
            </span>
          </span>
          {textoBaixa && (
            <span className="inline-flex items-center gap-1.5 tabular-nums" style={{ color: estaParada ? "var(--status-warning)" : "var(--text-muted)" }}>
              {estaParada && <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />}
              {textoBaixa}
              {desde !== null ? ` · há ${tempo(desde)}` : ""}
            </span>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {fmt(produtos)} produtos · G {fmt(c.volumes.G)} · M {fmt(c.volumes.M)} · P {fmt(c.volumes.P)}
          {regioes.length > 0 ? ` · ${regioes.join(", ")}` : ""}
        </p>

        {c.insucessos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.insucessos.map((i) => (
              <span
                key={i.codigo}
                className="text-[11px] px-2.5 py-1 rounded-full"
                style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-critical) 18%, transparent)" }}
              >
                {i.n} × {i.descricao ?? i.codigo}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}

function Grupo({
  grupo,
  titulo,
  cargas,
  dia,
  agora,
  onAbrir,
}: {
  grupo: GrupoRota;
  titulo: string;
  cargas: CargaRota[];
  dia: string;
  agora: string;
  onAbrir: (c: CargaRota) => void;
}) {
  const r = resumirRotas(cargas);
  return (
    <Recolhivel
      id={`rotas-${grupo === "Próprio" ? "nossos" : "terceirizados"}`}
      variante="simples"
      tituloClassName="text-lg font-semibold"
      titulo={
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COR_GRUPO[grupo] }} />
          {titulo}
        </span>
      }
      extra={
        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {r.cargas} carga{r.cargas === 1 ? "" : "s"} · {fmt(r.notas)} notas · {pctTexto(r.andamento)} concluído
        </span>
      }
    >
      {cargas.length === 0 ? (
        <p className="text-sm rounded-2xl p-5" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
          Nenhuma carga.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cargas.map((c) => (
            <CartaoCarga key={c.carga} c={c} grupo={grupo} dia={dia} agora={agora} onAbrir={() => onAbrir(c)} />
          ))}
        </ul>
      )}
    </Recolhivel>
  );
}

// Cargas de dias anteriores que continuam Em Rota no Protheus (0186): falta a
// baixa de alguma nota ou o encerramento da carga. Ficam fora dos números de
// hoje, num bloco próprio no fim do mural (Victor 20/10/2026).
function PendentesAnteriores({
  cargas,
  dia,
  agora,
  onAbrir,
}: {
  cargas: CargaRota[];
  dia: string;
  agora: string;
  onAbrir: (c: CargaRota) => void;
}) {
  const semBaixa = cargas.reduce((t, c) => t + c.pendentes, 0);
  return (
    <Recolhivel
      id="rotas-pendentes-anteriores"
      variante="simples"
      tituloClassName="text-lg font-semibold"
      titulo={
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--status-warning)" }} />
          Pendentes de dias anteriores
        </span>
      }
      extra={
        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {cargas.length} carga{cargas.length === 1 ? "" : "s"} · {fmt(semBaixa)} nota{semBaixa === 1 ? "" : "s"} sem baixa
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Continuam Em Rota: falta a baixa dessas notas ou o encerramento da carga. Não entram nos números de hoje.
        </p>
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {cargas.map((c) => (
            <CartaoCarga key={c.carga} c={c} grupo={grupoDaCarga(c)} dia={dia} agora={agora} onAbrir={() => onAbrir(c)} />
          ))}
        </ul>
      </div>
    </Recolhivel>
  );
}

const ROTULO_NOTA: Record<string, { rotulo: string; cor: string }> = {
  "1": { rotulo: "Entregue", cor: COR.entregue },
  "2": { rotulo: "Parcial", cor: COR.parcial },
  "3": { rotulo: "Voltou", cor: COR.voltou },
  "4": { rotulo: "Cancelada", cor: COR.voltou },
};

// CPF/CNPJ embaixo do nome do cliente (Victor 19/10/2026).
function Documento({ doc }: { doc: string | null | undefined }) {
  const texto = formatarDocumento(doc);
  if (!texto) return null;
  return (
    <span className="block font-normal tabular-nums" style={{ color: "var(--text-muted)" }}>
      {texto}
    </span>
  );
}

function NotasCarga({ c, onFechar }: { c: CargaRota; onFechar: () => void }) {
  return (
    <ModalLogistica
      titulo={`Carga #${c.carga} · ${c.motorista?.nome ?? "sem motorista"}`}
      subtitulo={`${c.notas} notas · ${c.notas - c.pendentes} com resultado · ${c.pendentes} pendentes. Baixas mais recentes primeiro.`}
      onFechar={onFechar}
    >
      <table className="w-full text-xs">
        <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
          <tr>
            {["Situação", "Hora", "Cliente", "Bairro", "NF / pedido", "Ocorrência"].map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {c.notasLista.map((n: NotaRota, i) => {
            const s = n.status ? ROTULO_NOTA[n.status] : null;
            return (
              <tr key={`${n.pedido}-${n.notaFiscal}-${i}`} className="align-top" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>
                  <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s?.cor ?? "var(--text-muted)" }} />
                  {s?.rotulo ?? "Pendente"}
                  {n.tentativa && n.tentativa > 1 ? (
                    <span className="block font-normal" style={{ color: "var(--text-muted)" }}>
                      {n.tentativa}ª tentativa
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{n.hora ?? "—"}</td>
                <td className="px-3 py-2.5 font-medium min-w-[160px]" style={{ color: "var(--text-primary)" }}>
                  {n.cliente ?? "—"}
                  <Documento doc={n.cpf} />
                </td>
                <td className="px-3 py-2.5 min-w-[120px]" style={{ color: "var(--text-secondary)" }}>
                  {n.bairro ?? "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                  {n.notaFiscal ?? "—"}
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {n.pedido ?? ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 min-w-[140px]" style={{ color: "var(--text-secondary)" }}>
                  {n.ocorrencia ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalLogistica>
  );
}

// Detalhe dos cards do topo (Victor 18/10/2026: "esses cards fiquem
// clicáveis"). Notas hoje e Andamento abrem a lista de notas do dia, com
// filtro por grupo e situação; Andamento já vem só com as cargas na rua,
// que é a base da porcentagem. Produtos abre o porte por carga; Cargas, a
// lista de cargas (clicar numa delas abre as notas dela).
type FiltroGrupo = "todas" | "rua" | GrupoRota;
type FiltroSituacao = "todas" | "entregue" | "voltou" | "pendente";
type Detalhe =
  | { tipo: "notas"; grupo: FiltroGrupo; situacao: FiltroSituacao }
  | { tipo: "produtos" }
  | { tipo: "cargas" };

function situacaoNota(n: NotaRota): Exclude<FiltroSituacao, "todas"> {
  if (n.status === "1" || n.status === "2") return "entregue";
  if (n.status === "3" || n.status === "4") return "voltou";
  return "pendente";
}

const ORDEM_SITUACAO: Record<Exclude<FiltroSituacao, "todas">, number> = { voltou: 0, pendente: 1, entregue: 2 };

function nomeMotorista(c: CargaRota) {
  return c.motorista?.nome ?? "sem motorista";
}

function Pilulas<T extends string>({
  rotulo,
  opcoes,
  valor,
  onTrocar,
}: {
  rotulo: string;
  opcoes: { valor: T; texto: string; n: number }[];
  valor: T;
  onTrocar: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full p-1 gap-0.5" role="group" aria-label={rotulo} style={{ background: "var(--surface-2)" }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => onTrocar(o.valor)}
            className="rounded-full text-xs px-3 py-1 font-medium tabular-nums transition-colors"
            style={{ background: ativo ? "var(--text-primary)" : "transparent", color: ativo ? "var(--canvas)" : "var(--text-secondary)" }}
          >
            {o.texto} · {fmt(o.n)}
          </button>
        );
      })}
    </div>
  );
}

function Th({ children, direita = false }: { children: React.ReactNode; direita?: boolean }) {
  return (
    <th className={`px-3 py-2.5 font-medium whitespace-nowrap ${direita ? "text-right" : "text-left"}`} style={{ color: "var(--text-muted)" }}>
      {children}
    </th>
  );
}

function NotasDoDia({
  cargas,
  grupoInicial,
  situacaoInicial,
  onFechar,
  onAbrirCarga,
}: {
  cargas: CargaRota[];
  grupoInicial: FiltroGrupo;
  situacaoInicial: FiltroSituacao;
  onFechar: () => void;
  onAbrirCarga: (c: CargaRota) => void;
}) {
  const [grupo, setGrupo] = useState<FiltroGrupo>(grupoInicial);
  const [situacao, setSituacao] = useState<FiltroSituacao>(situacaoInicial);
  const todas = cargas.flatMap((c) => c.notasLista.map((n) => ({ n, c, g: grupoDaCarga(c), s: situacaoNota(n) })));
  const noGrupo = (g: FiltroGrupo) => (x: (typeof todas)[number]) => g === "todas" || (g === "rua" ? x.g !== "No CD" : x.g === g);
  const doGrupo = todas.filter(noGrupo(grupo));
  const linhas = doGrupo
    .filter((x) => situacao === "todas" || x.s === situacao)
    .sort((a, b) => ORDEM_SITUACAO[a.s] - ORDEM_SITUACAO[b.s] || (b.n.hora ?? "").localeCompare(a.n.hora ?? ""));
  const temCd = todas.some((x) => x.g === "No CD");
  const contaSit = (s: Exclude<FiltroSituacao, "todas">) => doGrupo.filter((x) => x.s === s).length;

  return (
    <ModalLogistica
      titulo={grupoInicial === "rua" ? "Andamento das rotas · notas" : "Notas do dia"}
      subtitulo="Voltaram primeiro, depois pendentes e entregues; baixas mais recentes no topo. Clique na carga pra ver as notas dela."
      onFechar={onFechar}
    >
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        <Pilulas<FiltroGrupo>
          rotulo="Grupo"
          valor={grupo}
          onTrocar={setGrupo}
          opcoes={[
            { valor: "todas", texto: "Todas", n: todas.length },
            ...(temCd ? [{ valor: "rua" as const, texto: "Na rua", n: todas.filter(noGrupo("rua")).length }] : []),
            { valor: "Próprio", texto: "Nossas", n: todas.filter(noGrupo("Próprio")).length },
            { valor: "Terceirizado", texto: "Terceirizadas", n: todas.filter(noGrupo("Terceirizado")).length },
            ...(temCd ? [{ valor: "No CD" as const, texto: "No CD", n: todas.filter(noGrupo("No CD")).length }] : []),
          ]}
        />
        <Pilulas<FiltroSituacao>
          rotulo="Situação"
          valor={situacao}
          onTrocar={setSituacao}
          opcoes={[
            { valor: "todas", texto: "Todas", n: doGrupo.length },
            { valor: "entregue", texto: "Entregues", n: contaSit("entregue") },
            { valor: "voltou", texto: "Voltaram", n: contaSit("voltou") },
            { valor: "pendente", texto: "Pendentes", n: contaSit("pendente") },
          ]}
        />
      </div>
      {linhas.length === 0 ? (
        <p className="px-5 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma nota neste filtro.
        </p>
      ) : (
        <table className="w-full text-xs mt-2">
          <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
            <tr>
              <Th>Situação</Th>
              <Th>Hora</Th>
              <Th>Cliente</Th>
              <Th>Bairro</Th>
              <Th>Carga · motorista</Th>
              <Th>NF / pedido</Th>
              <Th>Ocorrência</Th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {linhas.map(({ n, c, g }, i) => {
              const st = n.status ? ROTULO_NOTA[n.status] : null;
              return (
                <tr key={`${c.carga}-${n.pedido}-${n.notaFiscal}-${i}`} className="align-top" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>
                    <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: st?.cor ?? "var(--text-muted)" }} />
                    {st?.rotulo ?? "Pendente"}
                    {n.tentativa && n.tentativa > 1 ? (
                      <span className="block font-normal" style={{ color: "var(--text-muted)" }}>
                        {n.tentativa}ª tentativa
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{n.hora ?? "—"}</td>
                  <td className="px-3 py-2.5 font-medium min-w-[160px]" style={{ color: "var(--text-primary)" }}>
                    {n.cliente ?? "—"}
                    <Documento doc={n.cpf} />
                  </td>
                  <td className="px-3 py-2.5 min-w-[110px]" style={{ color: "var(--text-secondary)" }}>
                    {n.bairro ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 min-w-[140px]">
                    <button type="button" onClick={() => onAbrirCarga(c)} className="text-left hover:underline" style={{ color: "var(--text-primary)" }}>
                      <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COR_GRUPO[g] }} />#{c.carga}
                      <span className="block" style={{ color: "var(--text-muted)" }}>
                        {nomeMotorista(c)}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                    {n.notaFiscal ?? "—"}
                    <span className="block" style={{ color: "var(--text-muted)" }}>
                      {n.pedido ?? ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 min-w-[140px]" style={{ color: "var(--text-secondary)" }}>
                    {n.ocorrencia ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </ModalLogistica>
  );
}

function ProdutosDoDia({ cargas, onFechar }: { cargas: CargaRota[]; onFechar: () => void }) {
  const total = (c: CargaRota) => c.volumes.G + c.volumes.M + c.volumes.P + c.volumes.naoClassificado;
  const linhas = [...cargas].sort((a, b) => total(b) - total(a));
  const soma = cargas.reduce(
    (t, c) => ({ G: t.G + c.volumes.G, M: t.M + c.volumes.M, P: t.P + c.volumes.P, N: t.N + c.volumes.naoClassificado }),
    { G: 0, M: 0, P: 0, N: 0 },
  );
  const tdNum = "px-3 py-2.5 text-right tabular-nums";
  return (
    <ModalLogistica titulo="Produtos do dia por carga" subtitulo="Quantidade de produtos de cada porte em cada carga, da maior pra menor." onFechar={onFechar}>
      <table className="w-full text-xs">
        <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
          <tr>
            <Th>Carga · motorista</Th>
            <Th direita>G</Th>
            <Th direita>M</Th>
            <Th direita>P</Th>
            <Th direita>Sem porte</Th>
            <Th direita>Total</Th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {linhas.map((c) => (
            <tr key={c.carga} style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2.5" style={{ color: "var(--text-primary)" }}>
                <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COR_GRUPO[grupoDaCarga(c)] }} />#{c.carga}
                <span className="block" style={{ color: "var(--text-muted)" }}>
                  {nomeMotorista(c)}
                </span>
              </td>
              <td className={tdNum}>{fmt(c.volumes.G)}</td>
              <td className={tdNum}>{fmt(c.volumes.M)}</td>
              <td className={tdNum}>{fmt(c.volumes.P)}</td>
              <td className={tdNum}>{c.volumes.naoClassificado ? fmt(c.volumes.naoClassificado) : "—"}</td>
              <td className={`${tdNum} font-semibold`} style={{ color: "var(--text-primary)" }}>
                {fmt(total(c))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <td className="px-3 py-2.5">Total</td>
            <td className={tdNum}>{fmt(soma.G)}</td>
            <td className={tdNum}>{fmt(soma.M)}</td>
            <td className={tdNum}>{fmt(soma.P)}</td>
            <td className={tdNum}>{soma.N ? fmt(soma.N) : "—"}</td>
            <td className={tdNum}>{fmt(soma.G + soma.M + soma.P + soma.N)}</td>
          </tr>
        </tfoot>
      </table>
    </ModalLogistica>
  );
}

const ORDEM_GRUPO: Record<GrupoRota, number> = { "Próprio": 0, Terceirizado: 1, "No CD": 2 };

function CargasDoDia({
  cargas,
  dia,
  agora,
  onFechar,
  onAbrirCarga,
}: {
  cargas: CargaRota[];
  dia: string;
  agora: string;
  onFechar: () => void;
  onAbrirCarga: (c: CargaRota) => void;
}) {
  const linhas = [...cargas].sort((a, b) => ORDEM_GRUPO[grupoDaCarga(a)] - ORDEM_GRUPO[grupoDaCarga(b)] || a.carga.localeCompare(b.carga));
  return (
    <ModalLogistica titulo="Cargas do dia" subtitulo="Nossas, terceirizadas e as que ainda estão no CD. Clique numa carga pra ver as notas dela." onFechar={onFechar}>
      <table className="w-full text-xs">
        <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
          <tr>
            <Th>Carga</Th>
            <Th>Motorista · veículo</Th>
            <Th>Situação</Th>
            <Th direita>Notas</Th>
            <Th direita>Entregues</Th>
            <Th direita>Voltaram</Th>
            <Th direita>Pendentes</Th>
            <Th>Última baixa</Th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {linhas.map((c) => {
            const g = grupoDaCarga(c);
            const b = situacaoBaixa(c, dia, agora);
            const voltaram = c.naoEntregues + c.canceladas;
            return (
              <tr key={c.carga} onClick={() => onAbrirCarga(c)} className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>
                  <button type="button" onClick={() => onAbrirCarga(c)} className="hover:underline">
                    <span aria-hidden className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COR_GRUPO[g] }} />#{c.carga}
                  </button>
                  {c.dia < dia && (
                    <span className="block font-normal" style={{ color: "var(--status-warning)" }}>
                      desde {diaCurto(c.dia)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 min-w-[150px]" style={{ color: "var(--text-primary)" }}>
                  {c.motorista?.nome ?? "Sem motorista"}
                  <span className="block" style={{ color: "var(--text-muted)" }}>
                    {g === "No CD" ? "No CD" : g === "Terceirizado" ? `Terceirizado${c.transportadora ? ` · ${c.transportadora}` : ""}` : "Nosso"}
                    {c.veiculo ? ` · ${c.veiculo}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.notas)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.entregues + c.parciais)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: voltaram ? "var(--status-critical)" : undefined }}>
                  {fmt(voltaram)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.pendentes)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums" style={{ color: b.parada ? "var(--status-warning)" : "var(--text-secondary)" }}>
                  {b.texto ?? "—"}
                  {b.desde !== null ? ` · há ${tempo(b.desde)}` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalLogistica>
  );
}

// historico: o dia de hoje não tem carga (domingo) e o mural mostra o último
// dia de operação -- sem "ao vivo" nem alerta de carga parada.
export function RotasDoDia({
  rotas,
  agora,
  dadosDe,
  atrasado,
  historico = false,
}: {
  rotas: Rotas;
  agora: string;
  dadosDe: string | null;
  atrasado: boolean;
  historico?: boolean;
}) {
  const [aberta, setAberta] = useState<CargaRota | null>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const doDia = rotas.cargas.filter((c) => c.dia >= rotas.dia);
  const anteriores = rotas.cargas.filter((c) => c.dia < rotas.dia);
  const porGrupo = (g: GrupoRota) => doDia.filter((c) => grupoDaCarga(c) === g);
  const proprias = porGrupo("Próprio");
  const terceiras = porGrupo("Terceirizado");
  const noCd = porGrupo("No CD");
  const naRua = [...proprias, ...terceiras];
  const r = resumirRotas(naRua);
  const notasCd = noCd.reduce((t, c) => t + c.notas, 0);
  const totalNotas = r.notas + notasCd;
  const volumes = doDia.reduce(
    (t, c) => ({ P: t.P + c.volumes.P, M: t.M + c.volumes.M, G: t.G + c.volumes.G, N: t.N + c.volumes.naoClassificado }),
    { P: 0, M: 0, G: 0, N: 0 },
  );
  const agoraEfetivo = historico ? "" : agora;
  const paradas = historico ? 0 : naRua.filter((c) => situacaoBaixa(c, rotas.dia, agoraEfetivo).parada).length;
  const dia = new Date(`${rotas.dia}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

  return (
    <section className="flex flex-col gap-6" aria-label="Rotas de hoje, ao vivo">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          {historico ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest" style={{ color: "var(--text-muted)" }}>
              <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--text-muted)" }} />
              HOJE NÃO TEM CARGA · ÚLTIMO DIA DE OPERAÇÃO
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest"
              style={{ color: atrasado ? "var(--status-warning)" : "var(--brand-green)" }}
              title={atrasado ? "O Odoo não é lido há mais de 70 minutos" : undefined}
            >
              <span aria-hidden className={`luz-ao-vivo ${atrasado ? "atrasada" : ""} inline-block w-2.5 h-2.5 rounded-full shrink-0`} />
              {atrasado ? "ATRASADO" : "AO VIVO"}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {historico ? `Rotas de ${dia.split(",")[0]}` : "Rotas de hoje"}
          </h1>
          <p className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>
            {dia}
          </p>
        </div>
        <span
          className="text-xs rounded-full px-3.5 py-2"
          style={{
            background: atrasado ? "color-mix(in srgb, var(--status-warning) 18%, var(--surface-1))" : "var(--surface-1)",
            color: atrasado ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {dadosDe ? `Odoo às ${dadosDe}` : "Sem sincronização recente"} · atualiza a cada 30 min
        </span>
      </header>

      {doDia.length === 0 ? (
        <p className="text-sm rounded-2xl p-6" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
          Nenhuma carga com previsão para hoje.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Destaque rotulo="Notas hoje" valor={fmt(totalNotas)} onAbrir={() => setDetalhe({ tipo: "notas", grupo: "todas", situacao: "todas" })}>
              <BarraFina
                total={totalNotas}
                partes={[
                  { n: proprias.reduce((t, c) => t + c.notas, 0), cor: COR_GRUPO["Próprio"], rotulo: "nossas" },
                  { n: terceiras.reduce((t, c) => t + c.notas, 0), cor: COR_GRUPO.Terceirizado, rotulo: "terceirizadas" },
                  { n: notasCd, cor: COR_GRUPO["No CD"], rotulo: "no CD" },
                ]}
              />
              <Legenda
                itens={[
                  { cor: COR_GRUPO["Próprio"], texto: `${fmt(proprias.reduce((t, c) => t + c.notas, 0))} nossas` },
                  { cor: COR_GRUPO.Terceirizado, texto: `${fmt(terceiras.reduce((t, c) => t + c.notas, 0))} terceirizadas` },
                  ...(notasCd > 0 ? [{ cor: COR_GRUPO["No CD"], texto: `${fmt(notasCd)} no CD` }] : []),
                ]}
              />
            </Destaque>
            <Destaque rotulo="Andamento das rotas" valor={pctTexto(r.andamento)} onAbrir={() => setDetalhe({ tipo: "notas", grupo: "rua", situacao: "todas" })}>
              <BarraFina
                total={r.notas}
                partes={[
                  { n: r.entregues + r.parciais, cor: COR.entregue, rotulo: "entregues" },
                  { n: r.naoEntregues, cor: COR.voltou, rotulo: "voltaram" },
                ]}
              />
              <Legenda
                itens={[
                  { cor: COR.entregue, texto: `${fmt(r.entregues + r.parciais)} entregues` },
                  { cor: COR.voltou, texto: `${fmt(r.naoEntregues)} ${r.naoEntregues === 1 ? "voltou" : "voltaram"}` },
                  { cor: "var(--surface-2)", texto: `${fmt(r.pendentes)} pendentes` },
                ]}
              />
            </Destaque>
            <Destaque rotulo="Produtos" valor={fmt(volumes.P + volumes.M + volumes.G + volumes.N)} onAbrir={() => setDetalhe({ tipo: "produtos" })}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                G {fmt(volumes.G)} · M {fmt(volumes.M)} · P {fmt(volumes.P)}
                {volumes.N > 0 ? ` · ${fmt(volumes.N)} sem porte` : ""}
              </span>
            </Destaque>
            <Destaque rotulo="Cargas" valor={fmt(doDia.length)} onAbrir={() => setDetalhe({ tipo: "cargas" })}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {resumoStatusCargas(doDia)}
              </span>
              {paradas > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                  <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
                  {paradas} sem baixa há mais de {tempo(MINUTOS_SEM_BAIXA_ALERTA)}
                </span>
              )}
            </Destaque>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Grupo grupo="Próprio" titulo="Nossos" cargas={proprias} dia={rotas.dia} agora={agoraEfetivo} onAbrir={setAberta} />
            <Grupo grupo="Terceirizado" titulo="Terceirizados" cargas={terceiras} dia={rotas.dia} agora={agoraEfetivo} onAbrir={setAberta} />
          </div>

          {noCd.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ainda no CD, sem motorista:
              </span>
              {noCd.map((c) => (
                <button
                  key={c.carga}
                  type="button"
                  onClick={() => setAberta(c)}
                  className="text-xs px-3 py-1.5 rounded-full tabular-nums transition-colors hover:bg-[var(--surface-2)]"
                  style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}
                >
                  #{c.carga} · {STATUS_CARGA_ORDEM[c.statusCodigo ?? ""] ?? c.status} · {c.notas} nota{c.notas === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {anteriores.length > 0 && (
        <PendentesAnteriores cargas={anteriores} dia={rotas.dia} agora={agoraEfetivo} onAbrir={setAberta} />
      )}
      {aberta && <NotasCarga c={aberta} onFechar={() => setAberta(null)} />}
      {detalhe?.tipo === "notas" && (
        <NotasDoDia
          cargas={doDia}
          grupoInicial={detalhe.grupo}
          situacaoInicial={detalhe.situacao}
          onFechar={() => setDetalhe(null)}
          onAbrirCarga={(c) => {
            setDetalhe(null);
            setAberta(c);
          }}
        />
      )}
      {detalhe?.tipo === "produtos" && <ProdutosDoDia cargas={doDia} onFechar={() => setDetalhe(null)} />}
      {detalhe?.tipo === "cargas" && (
        <CargasDoDia
          cargas={doDia}
          dia={rotas.dia}
          agora={agoraEfetivo}
          onFechar={() => setDetalhe(null)}
          onAbrirCarga={(c) => {
            setDetalhe(null);
            setAberta(c);
          }}
        />
      )}
    </section>
  );
}
