import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { signOut } from "@/app/assistencia/actions";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";

export default async function AssistenciaAppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <header
        className="flex flex-col gap-3 pb-4"
        style={{ borderBottom: "3px solid var(--brand-orange)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Assistência — Lojas Maia
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {profile.fullName} · {ROLE_LABELS[profile.role] ?? profile.role}
              {profile.storeId ? ` · Loja ${profile.storeId}` : ""}
            </p>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </div>
        <AssistenciaNav isAdmin={profile.role === "admin"} />
      </header>
      {children}
    </div>
  );
}
