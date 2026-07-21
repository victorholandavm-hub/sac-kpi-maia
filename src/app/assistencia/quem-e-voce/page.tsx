import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ASSISTENCIA_TEAM_COOKIE_NAME, verifyAssistenciaTeamPending } from "@/lib/assistenciaTeamAuth";
import { chooseAssistenciaIdentity } from "@/app/assistencia/actions";

export const dynamic = "force-dynamic";

export default async function QuemEVocePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const cookieStore = await cookies();
  const pending = cookieStore.get(ASSISTENCIA_TEAM_COOKIE_NAME)?.value;
  if (!verifyAssistenciaTeamPending(pending)) {
    redirect("/assistencia/login");
  }

  const admin = getSupabaseAdmin();
  const { data: members } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "assistencia")
    .order("full_name");

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Lojas Maia" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Quem é você?
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Escolha seu nome pra identificar suas ações no sistema.
            </p>
          </div>
        </div>

        {erro ? (
          <p className="text-sm text-center" style={{ color: "var(--status-critical)" }}>
            Não foi possível entrar. Tente de novo.
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {(members ?? []).length === 0 ? (
            <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
              Nenhuma pessoa da equipe cadastrada ainda.
            </p>
          ) : (
            (members ?? []).map((m) => (
              <form key={m.id} action={chooseAssistenciaIdentity.bind(null, m.id)}>
                <button
                  type="submit"
                  className="w-full rounded-xl border p-4 text-left font-medium"
                  style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {m.full_name}
                </button>
              </form>
            ))
          )}
        </div>

        <Link href="/assistencia/login" className="text-sm underline text-center" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </div>
    </div>
  );
}
