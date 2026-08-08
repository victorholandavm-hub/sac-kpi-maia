"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";

export function MontadorPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);

  function upload(file: File) {
    const formData = new FormData();
    formData.set("photo", file);
    formData.set("caption", caption);
    formData.set("requestId", requestId);
    run(async () => {
      // POST comum em vez de Server Action -- o montador quase sempre abre
      // o link de dentro do navegador embutido do WhatsApp, que tem bug
      // conhecido nesse app com o tipo de resposta em stream que Server
      // Actions usam (ver comentário em NavigationProgressBar.tsx). Rota
      // tradicional com resposta JSON simples é bem mais compatível.
      const res = await fetch("/api/montador/upload-photo", { method: "POST", body: formData });
      // Lê como texto primeiro (só dá pra ler o corpo uma vez) -- se não for
      // JSON válido, é sinal de que a resposta nem chegou na nossa rota (ex.:
      // nginx/proxy barrando antes, devolvendo página de erro HTML). Nesses
      // casos mostra o status HTTP na mensagem em vez de um erro genérico
      // mudo, pra dar pista de diagnóstico sem precisar de devtools no
      // celular do montador.
      const raw = await res.text();
      let data: { error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // não era JSON -- segue com data vazio, cai no fallback abaixo
      }
      if (!res.ok) {
        throw new Error(data.error || `Não foi possível enviar a foto (erro ${res.status}).`);
      }
      setCaption("");
      setInputKey((k) => k + 1);
    }, "Foto enviada.");
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
        className="text-sm rounded-lg px-3 py-2.5 font-medium text-center cursor-pointer"
        style={{
          background: "var(--brand-green)",
          color: "var(--brand-green-ink)",
          opacity: pending ? 0.6 : 1,
          pointerEvents: pending ? "none" : "auto",
        }}
      >
        {pending ? "Enviando…" : "Anexar foto"}
        <input
          key={inputKey}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
          className="hidden"
        />
      </label>
    </div>
  );
}
