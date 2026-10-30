"use client";

import { useEffect, useState } from "react";
import { faltasNoCdAction } from "@/app/assistencia/estoque-at-actions";

type Falta = { codigo: string; nome: string; livre: number; qtd: number };

// Dupla verificação do estoque AT (Victor 30/10/2026): se o produto a entregar
// não tem saldo livre no CD, avisa e só deixa criar com o "Estou ciente"
// marcado (checkbox required -- o navegador barra o envio sem ele).
export function AvisoSaldoCd({ itens }: { itens: { codigo: string; qtd: number }[] }) {
  const chave = itens.map((i) => `${i.codigo.trim().toUpperCase()}:${i.qtd}`).filter((k) => !k.startsWith(":")).join(",");
  const [resposta, setResposta] = useState<{ chave: string; faltas: Falta[] } | null>(null);

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    const t = setTimeout(() => {
      const lista = chave.split(",").map((k) => {
        const [codigo, qtd] = k.split(":");
        return { codigo, qtd: Number(qtd) || 1 };
      });
      faltasNoCdAction(lista)
        .then((r) => vivo && setResposta({ chave, faltas: r.ligado ? r.faltas : [] }))
        .catch(() => vivo && setResposta({ chave, faltas: [] }));
    }, 600);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [chave]);

  const faltas = resposta && resposta.chave === chave ? resposta.faltas : [];
  if (!chave || !faltas.length) return null;
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2 text-sm" style={{ background: "var(--surface-2)", borderLeft: "4px solid var(--status-serious)", color: "var(--text-primary)" }}>
      <b>Sem saldo livre no CD para entregar:</b>
      <ul className="flex flex-col gap-0.5">
        {faltas.map((f) => (
          <li key={f.codigo}>
            <span className="font-mono">{f.codigo}</span> {f.nome.replace(/^\[[^\]]*\]\s*/, "")} · tem {f.livre}, precisa {f.qtd}
          </li>
        ))}
      </ul>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        A notificação pode ser criada, mas o produto só vai para o estoque AT quando chegar no CD.
      </p>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name="ciente_sem_saldo" value="1" required />
        Estou ciente que vai faltar no CD
      </label>
    </div>
  );
}
