import Link from "next/link";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { LogisticaTabs } from "@/components/logisticaOdoo/LogisticaTabs";
import { ROTAS_OPERADOR_LOJA } from "@/lib/operadorLoja";

// Logística do CD (roteirizador/expedição + cargas) sobre o Odoo. Mora sob
// /assistencia de propósito: o proxy.ts deixa /assistencia passar e cada
// tela confere a própria sessão (aqui: PIN do CD ou equipe admin/
// assistência). Fora de /assistencia cairia no login do painel de KPIs.
export const dynamic = "force-dynamic";

export default async function LogisticaCdLayout({ children }: { children: React.ReactNode }) {
  const op = await getOperadorLogistica();
  if (!op) {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
        <AssistenciaHeader title="Logística do CD" subtitle="Entre com o PIN do CD ou com o login da equipe." />
        <div className="cartao p-6 flex flex-col gap-3 text-sm" style={{ color: "var(--text-primary)" }}>
          <p>Esta tela é do CD (expedição, cargas e romaneio). Faça login e volte aqui.</p>
          <Link href="/assistencia/encomendas/cd/login" className="underline" style={{ color: "var(--brand-green)" }}>
            Entrar com o PIN do CD
          </Link>
          <Link href="/assistencia/login" className="underline" style={{ color: "var(--brand-green)" }}>
            Entrar como equipe (admin/assistência)
          </Link>
        </div>
      </div>
    );
  }
  return (
    <ToastProvider>
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 pb-24 sm:pb-6 flex flex-col gap-5 min-w-0">
        <AssistenciaHeader title={op.loja ? `Estoque — loja ${op.loja.filial}` : "Logística — CD"} subtitle={`${op.nome} · ${op.loja ? "conferente da loja " + op.loja.filial : op.origem === "cd" ? "CD" : "Equipe"} · motor: Odoo`}>
          <Link href="/assistencia" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Início
          </Link>
        </AssistenciaHeader>
        <LogisticaTabs somente={op.loja ? ROTAS_OPERADOR_LOJA : undefined} />
        {children}
      </div>
    </ToastProvider>
  );
}
