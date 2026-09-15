"use client";

import { useState } from "react";
import { whatsappHref } from "@/lib/phone";

type RouteClient = { id: string; clientName: string | null; clientPhone: string | null };

function buildMessage(clientName: string | null): string {
  return `Olá${clientName ? `, ${clientName}` : ""}! Saímos do CD e sua entrega já está a caminho hoje. Qualquer dúvida, é só chamar por aqui. — Lojas Aiam`;
}

// "Avisar rota" -- pedido do Victor 15/09/2026: "seria possivel o
// motorista ter a possibilidade de ao sair do CD, poder mandar uma
// mensagem para todos os clientes da rota do dia via whatsapp?". Não
// existe integração de envio automático de WhatsApp no sistema (só wa.me,
// que abre a conversa já com o texto pronto -- quem manda continua sendo
// a pessoa, uma conversa de cada vez, não tem como o app mandar sozinho
// pra vários ao mesmo tempo sem contratar WhatsApp Business API).
// Confirmado com o Victor: melhor jeito dado essa limitação é uma lista
// com um botão WhatsApp por cliente, motorista vai clicando e só aperta
// enviar em cada um -- mais rápido que abrir cada chamado um por um pra
// achar o telefone.
export function NotifyRouteWhatsAppButton({ items }: { items: RouteClient[] }) {
  const [open, setOpen] = useState(false);

  // Um só por telefone -- cliente com mais de uma entrega na mesma rota
  // não precisa aparecer duas vezes na lista.
  const clients = [...new Map(items.filter((i) => i.clientPhone).map((i) => [i.clientPhone, i])).values()];

  if (clients.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // preventDefault -- este botão mora dentro de um <summary>
          // (motorista/page.tsx); sem isso o clique também dispararia o
          // toggle nativo de abrir/fechar o grupo.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
        style={{ color: "#1da851", background: "color-mix(in srgb, #25d366 18%, transparent)" }}
      >
        📤 Avisar rota ({clients.length})
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-md max-h-[80vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Avisar clientes da rota
              </h3>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Clique no WhatsApp de cada cliente -- abre a conversa já com a mensagem pronta, só falta apertar enviar.
            </p>
            <ul className="flex flex-col gap-2">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {c.clientName ?? "Cliente sem nome"}
                  </span>
                  <a
                    href={whatsappHref(c.clientPhone!, buildMessage(c.clientName))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
                    style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "#1da851" }}
                  >
                    💬 WhatsApp
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
