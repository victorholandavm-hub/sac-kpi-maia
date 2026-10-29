"use client";

import { useEffect, useState } from "react";
import { getPartOrderEmailAction } from "@/app/assistencia/pecas-actions";
import { EmailRepresentante, emailDoPedido } from "./PartOrderEmailButton";

// E-mail pro representante logo depois de criar o pedido de peça -- Victor
// 29/10/2026 ("já nessa janela de novo pedido de peça, já mostre o e-mail
// que vai pro representante").
export function EmailNovoPedidoPeca({ partOrderId }: { partOrderId: string }) {
  const [email, setEmail] = useState<{ representativeEmail: string | null; subject: string; body: string } | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    getPartOrderEmailAction(partOrderId)
      .then((r) => {
        if (!vivo) return;
        if (!r) return setErro(true);
        setEmail({ representativeEmail: r.o.representativeEmail, ...emailDoPedido(r.o, r.extras) });
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [partOrderId]);

  if (erro) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Não consegui montar o e-mail agora. Ele está no botão “✉️ E-mail” do pedido, na lista.
      </p>
    );
  }
  if (!email) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Montando o e-mail pro representante…
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        E-mail pro representante
      </h3>
      <EmailRepresentante o={{ representativeEmail: email.representativeEmail }} subject={email.subject} body={email.body} />
    </div>
  );
}
