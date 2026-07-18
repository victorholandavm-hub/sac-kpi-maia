import type { RequestPhoto } from "@/lib/servicePhotos";

export function PhotoGallery({ photos }: { photos: RequestPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {photos.map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title={p.uploadedBy ?? undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={p.uploadedBy ? `Foto de ${p.uploadedBy}` : "Foto do chamado"}
            className="w-20 h-20 object-cover rounded border"
            style={{ borderColor: "var(--border)" }}
          />
        </a>
      ))}
    </div>
  );
}
