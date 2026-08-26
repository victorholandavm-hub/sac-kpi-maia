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
      {/* <label> envolvendo o input, não botão com ref.click() -- em
          navegadores embutidos (o do WhatsApp, principalmente) um clique
          disparado por JavaScript no input escondido é bloqueado por não
          contar como gesto "de verdade" do usuário, e o seletor nunca abre.
          O label é a forma nativa do HTML de associar um clique visível a um
          input de arquivo, sem depender de JS pra abrir o seletor -- funciona
          em muito mais lugares. Sem `capture`: forçar a câmera direto também
          costuma travar nesses navegadores; deixando livre, abre o seletor
          nativo (câmera OU galeria). Um clique só: escolher já envia, sem
          passo extra. */}
      <label
        className="text-base rounded-xl px-4 py-6 font-semibold text-center cursor-pointer flex flex-col items-center gap-1.5"
        style={{
          border: "2px dashed var(--brand-green)",
          color: "var(--brand-green)",
          opacity: pending ? 0.6 : 1,
          pointerEvents: pending ? "none" : "auto",
        }}
      >
        <span className="text-3xl leading-none">📷</span>
        {pending
          ? progresso
            ? `Enviando ${progresso.atual}/${progresso.total}…`
            : "Enviando…"
          : "Tirar ou enviar fotos"}
        {pending ? null : (
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
            Pode escolher várias de uma vez (até {MAX_PHOTOS_POR_VEZ})
          </span>
        )}
        <input
          key={inputKey}
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
  );
}
