"use client";

import { useState } from "react";
import { deleteRequestPhotoAsStaff } from "@/app/assistencia/actions";
import { montadorDeletePhoto } from "@/app/assistencia/montador-actions";
import { driverDeletePhoto } from "@/app/assistencia/driver-actions";
import { useQuickAction } from "./useQuickAction";
import type { RequestPhoto } from "@/lib/servicePhotos";

export function PhotoGallery({
  photos,
  deleteMode,
  currentActor,
}: {
  photos: RequestPhoto[];
  deleteMode?: "staff" | "montador" | "driver";
  currentActor?: string;
}) {
  const { pending, run } = useQuickAction();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (photos.length === 0) return null;

  function canDeletePhoto(p: RequestPhoto): boolean {
    if (!deleteMode) return false;
    if (deleteMode === "staff") return true;
    return p.uploadedBy === currentActor;
  }

  function handleDelete(photoId: string) {
    run(async () => {
      if (deleteMode === "montador") {
        await montadorDeletePhoto(photoId);
      } else if (deleteMode === "driver") {
        await driverDeletePhoto(photoId);
      } else {
        await deleteRequestPhotoAsStaff(photoId);
      }
      setConfirmingId(null);
    }, "Foto removida.");
  }

  return (
    <div className="flex gap-3 flex-wrap">
      {photos.map((p) => (
        <div key={p.id} className="flex flex-col items-center gap-1" style={{ width: "5rem" }}>
          <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.uploadedBy ?? undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption || (p.uploadedBy ? `Foto de ${p.uploadedBy}` : "Foto do chamado")}
              className="w-20 h-20 object-cover rounded border"
              style={{ borderColor: "var(--border)" }}
            />
          </a>
          {p.caption ? (
            <span className="text-[10px] text-center truncate w-full" style={{ color: "var(--text-muted)" }} title={p.caption}>
              {p.caption}
            </span>
          ) : null}
          {canDeletePhoto(p) ? (
            confirmingId === p.id ? (
              <div className="flex items-center gap-1">
                <button
                  disabled={pending}
                  onClick={() => handleDelete(p.id)}
                  className="text-[10px] underline disabled:opacity-60"
                  style={{ color: "var(--status-critical)" }}
                >
                  confirmar
                </button>
                <button onClick={() => setConfirmingId(null)} className="text-[10px] underline" style={{ color: "var(--text-secondary)" }}>
                  cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmingId(p.id)} className="text-[10px] underline" style={{ color: "var(--text-muted)" }}>
                apagar
              </button>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}
