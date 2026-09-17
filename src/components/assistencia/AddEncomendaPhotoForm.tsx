"use client";

import { useRef, useState } from "react";
import { addEncomendaPhotoAction } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";

export function AddEncomendaPhotoForm({ pedidoId }: { pedidoId: string }) {
  const { pending, run } = useQuickAction();
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <button
        disabled={pending || !file}
        onClick={() =>
          run(async () => {
            if (!file) return;
            await addEncomendaPhotoAction(pedidoId, file);
            setFile(null);
            if (inputRef.current) inputRef.current.value = "";
          }, "Foto anexada.")
        }
        className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
        style={{ borderColor: "var(--border)" }}
      >
        Anexar foto
      </button>
    </div>
  );
}
