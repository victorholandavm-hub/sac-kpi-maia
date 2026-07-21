"use client";

import { useRef, useState } from "react";
import { montadorUploadPhoto } from "@/app/assistencia/montador-actions";
import { useQuickAction } from "./useQuickAction";

export function MontadorPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Foto
      </span>
      {/* Sem `capture`: em navegadores embutidos (ex.: o do WhatsApp) forçar a
          câmera direto costuma travar sem abrir nada — deixando livre, o
          sistema abre o seletor nativo (câmera OU galeria), que funciona em
          muito mais lugares. */}
      <input
        key={inputKey}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-sm rounded-lg px-3 py-2.5 border text-left truncate"
        style={{ borderColor: "var(--border)", color: file ? "var(--text-primary)" : "var(--text-secondary)" }}
      >
        {file ? file.name : "Escolher foto (câmera ou galeria)"}
      </button>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Legenda (opcional)"
        className="rounded-lg border px-3 py-2.5 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        disabled={pending || !file}
        onClick={() => {
          if (!file) return;
          const formData = new FormData();
          formData.set("photo", file);
          formData.set("caption", caption);
          run(async () => {
            await montadorUploadPhoto(requestId, formData);
            setFile(null);
            setCaption("");
            setInputKey((k) => k + 1);
          }, "Foto enviada.");
        }}
        className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Anexar foto
      </button>
    </div>
  );
}
