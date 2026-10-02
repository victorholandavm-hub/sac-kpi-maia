"use client";

import { useState } from "react";
import {
  CADASTRO_TIPOS,
  CADASTRO_TIPO_LABELS,
  CADASTRO_STATUSES,
  CADASTRO_STATUS_LABELS,
  CADASTRO_SOLICITANTES_ATIVOS,
  type CadastroTipo,
  type CadastroStatus,
} from "@/lib/cadastrosHistorico";
import { FormSection } from "./FormSection";

// Campos do formulário "Novo cadastro"/"Editar cadastro" -- extraído pra cá
// (02/10/2026) quando a edição precisou reaproveitar os mesmos 4 blocos e
// máscaras do cadastro novo (ver NovoCadastroDrawer.tsx/EditarCadastroDrawer.tsx),
// sem duplicar as duas versões.

export const inputStyle = { borderColor: "var(--border)" };

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {required ? <span style={{ color: "var(--status-critical)" }}> *</span> : null}
      {children}
    </label>
  );
}

// Mesma máscara do protótipo aprovado (Artifact, 01/10/2026) -- aplicada
// no onChange, nunca trava digitação (sempre aceita o que a pessoa
// digitou, só reformata).
export function maskCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// CNPJ fixo por filial -- pedido do Victor 01/10/2026 ("colocar automático
// assim que colocar a filial já ir o CNPJ fixo da filial"), lista de
// referência que ele passou por print. As 3 linhas de Mangabeira têm CNPJ
// diferente cada uma (empresas/filiais distintas no mesmo bairro) -- por
// isso o rótulo entre parênteses, senão ficaria ambíguo qual delas
// escolher.
export const LOJA_CNPJ: { label: string; cnpj: string }[] = [
  { label: "Bayeux", cnpj: "39.537.682/0001-01" },
  { label: "Santa Rita", cnpj: "39.537.682/0002-92" },
  { label: "Santo Elias", cnpj: "39.537.682/0005-35" },
  { label: "Tambaú", cnpj: "39.537.682/0007-05" },
  { label: "Mangabeira (Líder 1)", cnpj: "39.537.682/0010-00" },
  { label: "Mangabeira (Maia 2)", cnpj: "39.537.682/0006-16" },
  { label: "Mangabeira (Maia 3)", cnpj: "39.537.682/0003-73" },
  { label: "GL", cnpj: "39.537.682/0004-54" },
  { label: "Pluma", cnpj: "39.537.682/0008-88" },
  { label: "Cabedelo", cnpj: "39.537.682/0009-69" },
  { label: "Barão do Triunfo", cnpj: "39.537.682/0011-83" },
  { label: "Shopping M", cnpj: "39.537.682/0012-64" },
  { label: "CD", cnpj: "39.537.682/0013-45" },
  { label: "Mamanguape", cnpj: "39.537.682/0014-26" },
  { label: "Manaíra", cnpj: "39.537.682/0015-07" },
  { label: "Campina Grande", cnpj: "39.537.682/0016-98" },
];
export const OUTRA_LOJA = "__outra__";

// Solicitante -- pedido do Victor 02/10/2026: "na planilha tem solicitante
// como eu e victor e michel que é os que estão com o caso, então coloca
// apenas esses 3 nomes" (lista real em CADASTRO_SOLICITANTES_ATIVOS,
// cadastrosHistorico.ts -- compartilhada com os cards "Equipe X" da
// listagem). É quem está com o caso internamente (equipe pequena, lança
// direto pelo sistema), diferente de "Quem montou" (o montador de
// verdade, particular ou indicado) logo abaixo. "Outro" cobre edição de
// registro antigo importado da planilha, onde o solicitante pode ser
// qualquer um dos nomes que apareciam lá antes (Luisa, Mayara, Kelly
// etc.) -- não faz sentido travar edição de dado histórico numa lista que
// só vale daqui pra frente.
export const OUTRO_SOLICITANTE = "__outro_solicitante__";

// Quem montou -- pedido do Victor 02/10/2026: "o de baixo que realmente é
// o montador se foi particular ou algum indicado, caso seja indicado
// coloca para colocar o nome do indicado". Particular = cliente contratou
// por fora, sem envolvimento da Maia; Indicado = montador que a Maia
// indicou, nesse caso pede o nome dele (histórico tem muito "INDICADO"
// escrito literal em vez do nome de verdade -- essa UI evita repetir
// isso).
export const QUEM_MONTOU_PARTICULAR = "Particular";
export const QUEM_MONTOU_INDICADO = "__indicado__";

export type CadastroFormDefaults = {
  tipo: CadastroTipo;
  codigo: string;
  produto: string;
  descricao: string;
  nf: string;
  vendedora: string;
  loja: string;
  cnpj: string;
  cliente: string;
  cpf: string;
  telefone: string;
  endereco: string;
  data: string;
  prazo: string;
  prazoNota: string;
  solicitante: string;
  quemMontou: string;
  obs: string;
  status: CadastroStatus;
};

// Os 4 blocos de campo do formulário -- usados tanto por "Novo cadastro"
// (sem defaults, sem Situação) quanto por "Editar cadastro" (defaults
// preenchidos, com Situação). `defaults` reseta sozinho a cada vez que o
// componente remonta (a gaveta que o usa já desmonta o form inteiro ao
// fechar, ver NovoCadastroDrawer/EditarCadastroDrawer), não precisa de
// lógica de reset própria aqui.
export function CadastroFormFields({ defaults, isEdit }: { defaults?: Partial<CadastroFormDefaults>; isEdit?: boolean }) {
  const d = defaults ?? {};
  const [cpf, setCpf] = useState(d.cpf ?? "");
  const [cnpj, setCnpj] = useState(d.cnpj ?? "");
  const [telefone, setTelefone] = useState(d.telefone ?? "");
  const lojaJaMapeada = d.loja ? LOJA_CNPJ.some((l) => l.label === d.loja) : false;
  const [lojaSelect, setLojaSelect] = useState(d.loja ? (lojaJaMapeada ? d.loja : OUTRA_LOJA) : "");
  const [lojaCustom, setLojaCustom] = useState(d.loja && !lojaJaMapeada ? d.loja : "");

  const solicitanteJaMapeado = d.solicitante ? (CADASTRO_SOLICITANTES_ATIVOS as readonly string[]).includes(d.solicitante) : false;
  const [solicitanteSelect, setSolicitanteSelect] = useState(d.solicitante ? (solicitanteJaMapeado ? d.solicitante : OUTRO_SOLICITANTE) : "");
  const [solicitanteCustom, setSolicitanteCustom] = useState(d.solicitante && !solicitanteJaMapeado ? d.solicitante : "");

  const quemMontouParticular = (d.quemMontou ?? "").trim().toLowerCase() === "particular";
  const [quemMontouTipo, setQuemMontouTipo] = useState(
    d.quemMontou ? (quemMontouParticular ? QUEM_MONTOU_PARTICULAR : QUEM_MONTOU_INDICADO) : ""
  );
  const [quemMontouIndicadoNome, setQuemMontouIndicadoNome] = useState(d.quemMontou && !quemMontouParticular ? d.quemMontou : "");

  return (
    <>
      <FormSection title="Informações do produto" number={1}>
        <Field label="Solicitação" required>
          <select name="tipo" required defaultValue={d.tipo ?? "ASSISTENCIA"} className="rounded border px-3 py-2" style={inputStyle}>
            {CADASTRO_TIPOS.filter((t) => t !== "HISTORICO" || d.tipo === "HISTORICO").map((t) => (
              <option key={t} value={t}>
                {CADASTRO_TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Código produto">
          <input name="codigo" defaultValue={d.codigo} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Produto" required>
          <input name="produto" required defaultValue={d.produto} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Descrição">
          <textarea
            name="descricao"
            rows={2}
            defaultValue={d.descricao}
            placeholder="O que aconteceu, especificamente"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </FormSection>

      <FormSection title="Detalhes da venda" number={2}>
        <Field label="NF (nota fiscal)">
          <input name="nf" defaultValue={d.nf} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Vendedor(a)">
          <input name="vendedora" defaultValue={d.vendedora} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Loja">
          <select
            value={lojaSelect}
            onChange={(e) => {
              const value = e.target.value;
              setLojaSelect(value);
              if (value === OUTRA_LOJA) {
                setCnpj("");
                return;
              }
              const match = LOJA_CNPJ.find((l) => l.label === value);
              setCnpj(match?.cnpj ?? "");
            }}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="">Selecione a filial</option>
            {LOJA_CNPJ.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label}
              </option>
            ))}
            <option value={OUTRA_LOJA}>Outra (não listada)</option>
          </select>
          {lojaSelect === OUTRA_LOJA ? (
            <input
              name="loja"
              value={lojaCustom}
              onChange={(e) => setLojaCustom(e.target.value)}
              placeholder="Nome da filial"
              className="rounded border px-3 py-2 mt-1.5"
              style={inputStyle}
            />
          ) : (
            <input type="hidden" name="loja" value={lojaSelect} />
          )}
        </Field>
        <Field label="CNPJ">
          <input
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </FormSection>

      <FormSection title="Dados do cliente" number={3}>
        <Field label="Cliente" required>
          <input name="cliente" required defaultValue={d.cliente} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="CPF">
          <input
            name="cpf"
            value={cpf}
            onChange={(e) => setCpf(maskCPF(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Telefone">
          <input
            name="telefone"
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="numeric"
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
        <Field label="Endereço">
          <input name="endereco" defaultValue={d.endereco} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

      <FormSection title="Logística de montagem" number={4}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Data">
            <input name="data" type="date" defaultValue={d.data} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Prazo">
            <input name="prazo" type="date" defaultValue={d.prazo} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </div>
        {isEdit ? (
          d.prazoNota ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nota original do prazo: &ldquo;{d.prazoNota}&rdquo; -- deixe o campo Prazo em branco pra manter essa nota.
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Deixe em branco pra manter o prazo como está.
            </p>
          )
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Prazo em branco vira 30 dias a partir da Data automaticamente.
          </p>
        )}
        <Field label="Solicitante">
          <select
            value={solicitanteSelect}
            onChange={(e) => {
              const value = e.target.value;
              setSolicitanteSelect(value);
              if (value !== OUTRO_SOLICITANTE) setSolicitanteCustom("");
            }}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="">Em branco = você mesmo</option>
            {CADASTRO_SOLICITANTES_ATIVOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={OUTRO_SOLICITANTE}>Outro</option>
          </select>
          {solicitanteSelect === OUTRO_SOLICITANTE ? (
            <input
              name="solicitante"
              value={solicitanteCustom}
              onChange={(e) => setSolicitanteCustom(e.target.value)}
              placeholder="Nome do solicitante"
              className="rounded border px-3 py-2 mt-1.5"
              style={inputStyle}
            />
          ) : (
            <input type="hidden" name="solicitante" value={solicitanteSelect} />
          )}
        </Field>
        <Field label="Quem montou">
          <select
            value={quemMontouTipo}
            onChange={(e) => {
              const value = e.target.value;
              setQuemMontouTipo(value);
              if (value !== QUEM_MONTOU_INDICADO) setQuemMontouIndicadoNome("");
            }}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="">Preenchido depois da visita</option>
            <option value={QUEM_MONTOU_PARTICULAR}>Particular (cliente contratou por fora)</option>
            <option value={QUEM_MONTOU_INDICADO}>Indicado pela Maia</option>
          </select>
          {quemMontouTipo === QUEM_MONTOU_INDICADO ? (
            <input
              name="quemMontou"
              value={quemMontouIndicadoNome}
              onChange={(e) => setQuemMontouIndicadoNome(e.target.value)}
              placeholder="Nome do indicado"
              className="rounded border px-3 py-2 mt-1.5"
              style={inputStyle}
            />
          ) : (
            <input type="hidden" name="quemMontou" value={quemMontouTipo === QUEM_MONTOU_PARTICULAR ? QUEM_MONTOU_PARTICULAR : ""} />
          )}
        </Field>
        <Field label="OBS">
          <textarea name="obs" rows={3} defaultValue={d.obs} className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        {isEdit ? (
          <Field label="Situação" required>
            <select name="status" required defaultValue={d.status ?? "PROGRAMADO"} className="rounded border px-3 py-2" style={inputStyle}>
              {CADASTRO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CADASTRO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </FormSection>
    </>
  );
}
