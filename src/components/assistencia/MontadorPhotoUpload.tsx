"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";

// Limite por seleção (não é um total acumulado do chamado) -- alinhado com o
// nginx (client_max_body_size 15m): 10 fotos de até 10 MB cada dariam até
// 100 MB se fossem num POST só, por isso cada foto continua indo em uma
// requisição própria (loop sequencial abaixo), só a limitação de mandar
// muitas de uma vez que muda.
const MAX_PHOTOS_POR_VEZ = 10;

async function uploadOne(requestId: string, file: File, caption: string): Promise<void> {
  const formData = new FormData();
  formData.set("photo", file);
  formData.set("caption", caption);
  formData.set("requestId", requestId);
  // POST comum em vez de Server Action -- o montador quase sempre abre
  // o link de dentro do navegador embutido do WhatsApp, que tem bug
  // conhecido nesse app com o tipo de resposta em stream que Server
  // Actions usam (ver comentário em NavigationProgressBar.tsx). Rota
  // tradicional com resposta JSON simples é bem mais compatível.
  // uploadPhotoRequest (uploadPhotoClient.ts) cuida do fetch/timeout/
  // leitura da resposta, compartilhado com MotoristaPhotoUpload.tsx/
  // RequestPhotoUpload.tsx.
  await uploadPhotoRequest("/api/montador/upload-photo", formData);
}

export function MontadorPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run, showToast } = useQuickAction();
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);

  function upload(files: File[]) {
    const selecionadas = files.slice(0, MAX_PHOTOS_POR_VEZ);
    const excedente = files.length - selecionadas.length;
    if (excedente > 0) {
      showToast(`Só dá pra enviar ${MAX_PHOTOS_POR_VEZ} fotos por vez -- ${excedente} não ${excedente === 1 ? "foi selecionada" : "foram selecionadas"}.`, "error");
    }

    run(async () => {
      const falhas: string[] = [];
      for (let i = 0; i < selecionadas.length; i++) {
        setProgresso({ atual: i + 1, total: selecionadas.length });
        try {
          // Sequencial, não em paralelo -- celular do montador costuma estar
          // em rede ruim (obra/loja), várias uploads simultâneas competindo
          // por banda tendem a estourar timeout todas juntas em vez de só
          // uma por vez.
          await uploadOne(requestId, selecionadas[i], caption);
        } catch (err) {
          falhas.push(`${selecionadas[i].name || "foto"}: ${err instanceof Error ? err.message : "erro"}`);
        }
      }
      setProgresso(null);
      setCaption("");
      setInputKey((k) => k + 1);

      if (falhas.length === selecionadas.length) {
        throw new Error(selecionadas.length === 1 ? falhas[0].split(": ").slice(1).join(": ") || "Não foi possível enviar a foto." : "Não foi possível enviar nenhuma foto.");
      }
      const enviadas = selecionadas.length - falhas.length;
      if (falhas.length > 0) {
        showToast(`${enviadas} de ${selecionadas.length} fotos enviadas. Falhou: ${falhas.join("; ")}.`, "error");
      } else {
        showToast(enviadas === 1 ? "Foto enviada." : `${enviadas} fotos enviadas.`, "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Foto
      </span>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Legenda (opcional)"
        className="rounded-lg border px-3 py-2.5 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      {/* Dois botões separados (câmera / galeria), não um seletor único
          "livre" (sem `capture`) -- pedido do Victor 26/08/2026 (achado
          no fluxo do motorista, mesma causa aqui): "não consegue abrir a
          camera... só consegue adicionar a foto vinda da galeria". A
          teoria era que, sem `capture`, o seletor nativo do celular
          abriria com as duas opções (câmera OU galeria) -- na prática,
          em pelo menos um navegador/aparelho isso não acontece, o
          seletor cai direto pra galeria/arquivos, sem oferecer câmera
          nenhuma. Garantia de verdade só existe com DOIS inputs -- um
          com `capture="environment"` (força câmera, sempre abre a câmera
          de verdade) e outro sem `capture` nenhum (força o seletor de
          arquivo, sempre oferece a galeria, e continua com `multiple`
          pra escolher várias de uma vez -- câmera não suporta seleção
          múltipla por natureza, então esse botão manda uma foto por
          clique). Cada um no seu <label> -- mesmo motivo de sempre:
          clique disparado por JS num input escondido é bloqueado em
          navegador embutido (WhatsApp), o label é a forma nativa de abrir
          o seletor sem depender de JS. */}
      <div className="grid grid-cols-2 gap-2">
        <label
          className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
          style={{
            border: "2px dashed var(--brand-green)",
            color: "var(--brand-green)",
            opacity: pending ? 0.6 : 1,
            pointerEvents: pending ? "none" : "auto",
          }}
        >
          <span className="text-2xl leading-none">📷</span>
          {pending ? (progresso ? `${progresso.atual}/${progresso.total}…` : "Enviando…") : "Tirar foto"}
          <input
            key={`camera-${inputKey}`}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload([file]);
            }}
            className="hidden"
          />
        </label>
        <label
          className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
          style={{
            border: "2px dashed var(--brand-green)",
            color: "var(--brand-green)",
            opacity: pending ? 0.6 : 1,
            pointerEvents: pending ? "none" : "auto",
          }}
        >
          <span className="text-2xl leading-none">🖼️</span>
          {pending ? (progresso ? `${progresso.atual}/${progresso.total}…` : "Enviando…") : "Da galeria"}
          <input
            key={`gallery-${inputKey}`}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) upload(files);
            }}
            className="hidden"
          />
        </label>
      </div>
      {pending ? null : (
        <span className="text-xs font-normal text-center" style={{ color: "var(--text-muted)" }}>
          Na galeria dá pra escolher várias de uma vez (até {MAX_PHOTOS_POR_VEZ})
        </span>
      )}
    </div>
  );
}
