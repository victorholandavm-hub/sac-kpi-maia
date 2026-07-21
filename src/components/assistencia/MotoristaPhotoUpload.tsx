"use client";

import { useRef, useState } from "react";
import { driverUploadPhoto } from "@/app/assistencia/driver-actions";
import { useQuickAction } from "./useQuickAction";

export function MotoristaPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    const formData = new FormData();
    formData.set("photo", file);
    formData.set("caption", caption);
    run(async () => {
      await driverUploadPhoto(requestId, formData);
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
        key={inputKey}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
        className="hidden"
      />
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Legenda (opcional)"
        className="rounded-lg border px-3 py-2.5 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Enviando…" : "Anexar foto"}
      </button>
    </div>
  );
}
