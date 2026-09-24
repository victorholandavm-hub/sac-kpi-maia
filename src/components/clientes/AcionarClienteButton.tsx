import { whatsappHref } from "@/lib/phone";

// "Acionar Cliente" -- aba Frequência & Potencial de Recompra. Sem
// "use client": whatsappHref é só um construtor de string, o link
// funciona server-rendered (diferente de NotifyRouteWhatsAppButton, que só
// é client por causa do modal com estado, não do link em si). Confirmado
// com o Victor: cliente sem telefone esconde o botão e mostra "sem
// telefone" -- nunca um botão cinza/desabilitado, pra não sugerir que dá
// pra clicar mesmo assim.
//
// `mensagem` opcional -- pedido do Victor 24/09/2026 ("Gerar Oferta
// Personalizada via WhatsApp" pro motor de padrões de associação): cada
// padrão detectado (fidelidade, cross-sell de categoria X->Y) manda sua
// própria mensagem via essa prop; sem ela, cai na genérica de sempre.
export function AcionarClienteButton({ nome, phone, mensagem }: { nome: string | null; phone: string | null; mensagem?: string }) {
  if (!phone) {
    return (
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        sem telefone
      </span>
    );
  }

  const msg = mensagem ?? `Olá${nome ? `, ${nome}` : ""}! Notamos que já faz um tempo desde sua última compra na Lojas Maia — separamos uma condição especial pra você. Quer que a gente te mande mais detalhes?`;

  return (
    <a
      href={whatsappHref(phone, msg)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
      style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "#1da851" }}
    >
      🎁 Gerar Oferta
    </a>
  );
}
