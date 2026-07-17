import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { signOut } from "@/app/assistencia/actions";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export default async function AssistenciaAppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        <AssistenciaHeader
          title="Assistência — Lojas Maia"
          subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}${profile.storeId ? ` · Loja ${profile.storeId}` : ""}`}
        >
          <form action={signOut}>
            <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              Sair
            </button>
          </form>
        </AssistenciaHeader>
        <AssistenciaNav isAdmin={profile.role === "admin"} />
      </div>
      {children}
    </div>
  );
}
