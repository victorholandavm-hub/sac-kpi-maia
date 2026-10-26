"use client";

import { registrarChegadaAction } from "@/app/assistencia/motorista/odoo/odoo-actions";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/assistencia/ToastProvider";
import type { CatalogosOdoo, ResultadoParada } from "@/lib/odoo/logisticaTipos";
import { enviarFila, enviarRegistro, filaDisponivel, guardarNaFila, listarFila, pedirSyncEmSegundoPlano, reduzirFoto, tirarDaFila } from "@/lib/pwa/filaBaixas";
import { FILA_CANAL, novoEventoUid, type BaixaPendente, type FotoPendente } from "@/lib/pwa/filaBaixasRegras";

const MAX_FOTOS = 4;

function lerGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: true },
    );
  });
}

type FotoLocal = FotoPendente & { preview: string };
type Guardada = { motivo: "sem_rede" | "sessao"; erro: string | null };

// Baixa da parada do Odoo: foto do comprovante (opcional por enquanto),
// Entreguei / Entrega parcial / Não consegui (motivo do catálogo do Odoo +
// observação). Geolocalização best-effort no momento da baixa.
//
// PWA (25/10/2026): a baixa vai primeiro para a fila do celular (IndexedDB,
// com evento_uid e as fotos), depois é enviada. Sem rede, fica guardada e
// segue sozinha quando a conexão voltar (ver src/lib/pwa/filaBaixas.ts). As
// fotos ficam no celular até o envio da baixa (não sobem na hora da escolha).
export function ParadaOdooBaixa({ cargaId, paradaId, rotulo, motivos, itens = [] }: { cargaId: number; paradaId: number; rotulo: string; motivos: CatalogosOdoo["motivos"]; itens?: { codigo: string; nome: string; qtd: number }[] }) {
  // 26/10 (Pedro): entrega parcial = o motorista diz o que entregou de cada item; o resto "volta" para o CD
  const [parcial, setParcial] = useState(false);
  // 26/10 (Pedro, igual ao uMov): fotos com nome e obrigatórias — canhoto assinado + mercadoria no local (entrega),
  // foto do local (não consegui). "Cheguei no cliente" registra GPS/hora antes da baixa.
  const [tipoFoto, setTipoFoto] = useState<"canhoto" | "mercadoria" | "local">("canhoto");
  const [chegou, setChegou] = useState<string | null>(null);
  const tem = (t: string) => fotos.some((f) => f.tipo === t);
  const [entregue, setEntregue] = useState<Record<string, string>>(() => Object.fromEntries(itens.map((i) => [i.codigo, String(i.qtd)])));
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [guardada, setGuardada] = useState<Guardada | null>(null);
  const fotosRef = useRef<FotoLocal[]>([]);
  const estavaNaFila = useRef(false);
  const ocupado = pending || preparandoFoto;

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  // Já existe baixa desta parada na fila? Mostra "guardada" em vez do
  // formulário (evita segunda baixa da mesma parada). Relê quando a fila muda
  // (enviou em segundo plano -> volta para a rota).
  useEffect(() => {
    let vivo = true;
    async function conferir() {
      const lista = await listarFila().catch(() => [] as BaixaPendente[]);
      if (!vivo) return;
      const minha = lista.find((b) => b.cargaId === cargaId && b.paradaId === paradaId);
      if (minha) {
        estavaNaFila.current = true;
        setGuardada((g) => g ?? { motivo: "sem_rede", erro: minha.ultimoErro });
      } else if (estavaNaFila.current) {
        // saiu da fila (enviada em segundo plano): recarrega a parada do servidor
        estavaNaFila.current = false;
        setGuardada(null);
        router.refresh();
      }
    }
    void conferir();
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel(FILA_CANAL);
      canal.onmessage = () => void conferir();
    } catch {
      canal = null;
    }
    const local = () => void conferir();
    window.addEventListener(FILA_CANAL, local);
    return () => {
      vivo = false;
      canal?.close();
      window.removeEventListener(FILA_CANAL, local);
    };
  }, [cargaId, paradaId, router]);

  async function adicionarFoto(file: File) {
    if (fotos.length >= MAX_FOTOS) {
      showToast(`No máximo ${MAX_FOTOS} fotos.`, "error");
      return;
    }
    setPreparandoFoto(true);
    try {
      const red = await reduzirFoto(file);
      // 25/10 (teste real): guardar o próprio File do input na fila (IndexedDB) chegava VAZIO no envio
      // ("Selecione uma foto." -> baixa recusada). Sempre guarda uma CÓPIA em memória do conteúdo.
      const blob = new Blob([await red.arrayBuffer()], { type: red.type || "image/jpeg" });
      if (blob.size === 0) throw new Error("A foto veio vazia. Tire de novo.");
      if (blob.size > 10 * 1024 * 1024) throw new Error("Foto grande demais (máximo 10 MB).");
      const nome = red === file ? file.name || "comprovante.jpg" : "comprovante.jpg";
      setFotos((f) => [...f, { id: novoEventoUid(), blob, nome, url: null, preview: URL.createObjectURL(blob), tipo: tipoFoto }]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível usar a foto.", "error");
    } finally {
      setPreparandoFoto(false);
      setInputKey((k) => k + 1);
    }
  }

  function removerFoto(id: string) {
    setFotos((lista) => {
      const f = lista.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return lista.filter((x) => x.id !== id);
    });
  }

  function baixa(resultado: ResultadoParada) {
    if (resultado === "insucesso" && !motivo) {
      showToast("Escolha o motivo.", "error");
      return;
    }
    if ((resultado === "entregue" || resultado === "entrega_parcial") && !(tem("canhoto") && tem("mercadoria"))) {
      showToast("Tire a foto do canhoto assinado E a foto da mercadoria no local.", "error");
      return;
    }
    if (resultado === "insucesso" && !tem("local")) {
      showToast("Tire uma foto do local (fachada/porta) para registrar que você esteve lá.", "error");
      return;
    }
    startTransition(async () => {
      const g = await lerGeo();
      const agora = new Date().toISOString();
      const registro: BaixaPendente = {
        evento_uid: novoEventoUid(),
        cargaId,
        paradaId,
        rotulo,
        resultado,
        motivo: resultado === "insucesso" ? motivo : null,
        obs: obs.trim() || null,
        itens: resultado === "entrega_parcial" ? itens.map((i) => ({ codigo: i.codigo, qtd_entregue: Number(entregue[i.codigo] ?? 0) })) : null,
        geoLat: g?.lat ?? null,
        geoLng: g?.lng ?? null,
        registradoEm: agora,
        fotos: fotos.map(({ id, blob, nome, url, tipo }) => ({ id, blob, nome, url, tipo })),
        estado: "pendente",
        tentativas: 0,
        ultimoErro: null,
        atualizadoEm: agora,
      };

      // 1) guarda no celular; 2) tenta enviar. Sem IndexedDB (aba anônima,
      // navegador embutido restrito), envia direto sem fila.
      const temFila = await filaDisponivel();
      let desfecho: string;
      let erro: string | null;
      let pendentes: number | undefined;
      if (temFila) {
        try {
          await guardarNaFila(registro);
        } catch (e) {
          showToast(e instanceof Error ? `Não deu para guardar no celular: ${e.message}` : "Não deu para guardar no celular.", "error");
          return;
        }
        const r = await enviarFila({ somente: registro.evento_uid });
        const t = r.porUid[registro.evento_uid];
        desfecho = t?.desfecho ?? "transitorio";
        erro = t?.erro ?? null;
        pendentes = t?.dados?.pendentes;
        // Recusa na hora (motivo inválido, carga fora de rota...): o motorista
        // está olhando -- mostra o erro e tira da fila, como era antes.
        if (desfecho === "recusada") await tirarDaFila(registro.evento_uid);
      } else {
        const t = await enviarRegistro(registro, async () => {});
        desfecho = t.desfecho;
        erro = t.erro;
        pendentes = t.dados?.pendentes;
      }

      if (desfecho === "enviado" || desfecho === "ja_registrada") {
        showToast(desfecho === "enviado" ? `Registrado. Faltam ${pendentes ?? "?"} parada(s).` : (erro ?? "Parada já registrada."), desfecho === "enviado" ? "success" : "info");
        router.push("/assistencia/motorista/odoo");
        router.refresh();
        return;
      }
      if (desfecho === "recusada") {
        showToast(erro ?? "O Odoo recusou a baixa.", "error");
        return;
      }
      if (!temFila) {
        showToast("Sem conexão e este navegador não deixa guardar a baixa. Tente de novo quando a rede voltar.", "error");
        return;
      }
      void pedirSyncEmSegundoPlano();
      estavaNaFila.current = true;
      setGuardada({ motivo: desfecho === "sessao" ? "sessao" : "sem_rede", erro });
    });
  }

  if (guardada) {
    return (
      <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "color-mix(in srgb, var(--status-warning) 10%, var(--surface-1))", border: "2px solid var(--status-warning)" }}>
        <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
          {guardada.motivo === "sessao" ? "🔒 Baixa guardada — entre de novo" : "📶 Baixa guardada no celular"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {guardada.motivo === "sessao"
            ? "Sua sessão expirou. A baixa (com as fotos) ficou guardada neste celular e será enviada assim que você entrar de novo pelo login."
            : "Sem conexão agora. A baixa (com as fotos) ficou guardada neste celular e será enviada sozinha quando a rede voltar. Não precisa registrar de novo."}
        </p>
        {guardada.erro ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Último erro: {guardada.erro}
          </p>
        ) : null}
        <button type="button" onClick={() => router.push("/assistencia/motorista/odoo")} className="text-sm font-semibold rounded-xl px-4 py-3 border" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }}>
          ← Voltar para a rota
        </button>
      </div>
    );
  }

  const fotoLabel = (texto: string, icone: string, capture: boolean) => (
    <label
      className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
      style={{ border: "2px dashed var(--status-warning)", color: "var(--status-warning)", opacity: ocupado ? 0.6 : 1, pointerEvents: ocupado ? "none" : "auto" }}
    >
      <span className="text-2xl leading-none">{icone}</span>
      {preparandoFoto ? "Preparando…" : texto}
      <input
        key={`${capture ? "cam" : "gal"}-${inputKey}`}
        type="file"
        accept={capture ? "image/*" : "image/jpeg,image/png,image/webp,image/heic,image/heif"}
        {...(capture ? { capture: "environment" as const } : {})}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void adicionarFoto(f);
        }}
        className="hidden"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-1))", border: "2px solid var(--status-warning)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          📝 Fotos da entrega
        </h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Entregou: foto do <b>canhoto assinado</b> e da <b>mercadoria no local</b>. Não conseguiu: foto do <b>local</b>. Sem sinal, fica guardada no celular até a rede voltar.
        </p>
        <div className="flex gap-2 flex-wrap">
          {(["canhoto", "mercadoria", "local"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTipoFoto(t)} className="text-sm font-semibold rounded-full px-3 py-1.5 border"
              style={{ borderColor: tipoFoto === t ? "var(--brand-green)" : "var(--border)", background: tipoFoto === t ? "var(--brand-green)" : "var(--surface-1)", color: tipoFoto === t ? "var(--brand-green-ink)" : "var(--text-secondary)" }}>
              {t === "canhoto" ? "Canhoto assinado" : t === "mercadoria" ? "Mercadoria no local" : "Foto do local"}{tem(t) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <button type="button" disabled={ocupado || !!chegou} className="text-sm font-bold rounded-xl px-4 py-3 border disabled:opacity-60"
          style={{ borderColor: "var(--brand-green)", color: chegou ? "var(--text-secondary)" : "var(--brand-green)", background: "var(--surface-1)" }}
          onClick={async () => {
            const g = await lerGeo();
            const r = await registrarChegadaAction(cargaId, paradaId, g?.lat ?? null, g?.lng ?? null);
            if (!r.ok) { showToast(r.erro, "error"); return; }
            setChegou(r.dados.em || "ok"); showToast(r.dados.ja_registrada ? "Chegada já estava registrada." : "Chegada registrada (hora e GPS).", "success");
          }}>
          {chegou ? "📍 Chegada registrada" : "📍 Cheguei no cliente"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {fotoLabel("Tirar foto", "📷", true)}
          {fotoLabel("Da galeria", "🖼️", false)}
        </div>
        {fotos.length ? (
          <div className="flex gap-2 flex-wrap">
            {fotos.map((f) => (
              <div key={f.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt="Comprovante" className="h-20 w-20 object-cover rounded-lg border" style={{ borderColor: "var(--border)" }} />
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => removerFoto(f.id)}
                  aria-label="Remover foto"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full text-xs font-bold"
                  style={{ background: "var(--status-critical)", color: "#fff" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" disabled={ocupado} onClick={() => baixa("entregue")} className="text-base font-bold rounded-xl px-4 py-4 disabled:opacity-60" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
        {pending ? "Registrando…" : "✅ Entreguei"}
      </button>
      {parcial ? (
        <div className="rounded-lg p-3 flex flex-col gap-2" style={{ border: "2px solid var(--brand-orange)", background: "var(--surface-1)" }}>
          <b className="text-sm" style={{ color: "var(--text-primary)" }}>Quanto foi entregue de cada item? O resto volta para o CD.</b>
          {itens.map((i) => (
            <label key={i.codigo} className="flex items-center justify-between gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <span><b>{i.codigo}</b> {i.nome.replace(/^\[[^\]]*\]\s*/, "").slice(0, 40)} <span style={{ color: "var(--text-secondary)" }}>(levou {i.qtd})</span></span>
              <input type="number" min={0} max={i.qtd} step={1} inputMode="numeric" className="rounded-lg border px-2 py-2 w-20 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }} value={entregue[i.codigo] ?? ""} onChange={(e) => setEntregue((m) => ({ ...m, [i.codigo]: e.target.value }))} />
            </label>
          ))}
          <div className="flex gap-2">
            <button type="button" disabled={ocupado || !itens.some((i) => Number(entregue[i.codigo]) > 0)} onClick={() => baixa("entrega_parcial")} className="text-base font-bold rounded-xl px-4 py-3 flex-1 disabled:opacity-60" style={{ background: "var(--brand-orange)", color: "#fff" }}>
              {ocupado ? "Registrando…" : "Confirmar entrega parcial"}
            </button>
            <button type="button" onClick={() => setParcial(false)} className="text-sm rounded-xl px-3 py-3 border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Voltar</button>
          </div>
        </div>
      ) : null}
      <button type="button" disabled={ocupado || parcial || !itens.length} onClick={() => setParcial(true)} className="text-base font-semibold rounded-xl px-4 py-3 border disabled:opacity-60" style={{ borderColor: "var(--status-warning)", color: "var(--text-primary)", background: "var(--surface-1)" }}>
        Entrega parcial
      </button>

      <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-2)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Não consegui entregar
        </h3>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}>
          <option value="">Motivo…</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.codigo}>
              {m.nome}
            </option>
          ))}
        </select>
        <textarea
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observação (vale também para entrega parcial)"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <button type="button" disabled={ocupado} onClick={() => baixa("insucesso")} className="text-sm font-semibold rounded-xl px-4 py-3 border disabled:opacity-60" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)", background: "var(--surface-1)" }}>
          Registrar que não consegui
        </button>
      </div>
    </div>
  );
}
