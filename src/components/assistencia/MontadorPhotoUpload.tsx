"use client";

import { useState } from "react";
import { montadorUploadPhoto } from "@/app/assistencia/montador-actions";
import { useQuickAction } from "./useQuickAction";

export function MontadorPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        key={inputKey}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-xs"
      />
      <button
        disabled={pending || !file}
        onClick={() => {
          if (!file) return;
          const formData = new FormData();
          formData.set("photo", file);
          run(async () => {
            await montadorUploadPhoto(requestId, formData);
            setFile(null);
            setInputKey((k) => k + 1);
          }, "Foto enviada.");
        }}
        className="text-xs rounded px-2 py-1 disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Anexar foto
      </button>
    </div>
  );
}
