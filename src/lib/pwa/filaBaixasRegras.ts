// Regras puras da fila offline das baixas do motorista (sem IndexedDB, sem
// fetch) -- testáveis no vitest em ambiente node. O service worker
// (public/assistencia/sw.js) repete estas mesmas regras em JS puro: mudou
// aqui, mudar lá (o teste filaBaixasRegras.test.ts confere o sw.js).

import type { ResultadoParada } from "@/lib/odoo/logisticaTipos";

export const FILA_DB = "maia-pwa";
export const FILA_DB_VERSAO = 1;
export const FILA_STORE = "baixas";
export const FILA_LOCK = "maia-fila-baixas";
export const FILA_CANAL = "maia-fila-baixas";
export const FILA_SYNC_TAG = "maia-fila-baixas";

export type TipoFoto = "canhoto" | "mercadoria" | "local";
export type FotoPendente = { id: string; blob: Blob; nome: string; url: string | null; tipo?: TipoFoto };

export type BaixaPendente = {
  evento_uid: string;
  cargaId: number;
  paradaId: number;
  rotulo: string; // cliente da parada, só para mostrar na fila
  resultado: ResultadoParada;
  motivo: string | null;
  obs: string | null;
  itens?: { codigo: string; qtd_entregue: number }[] | null; // entrega parcial (26/10)
  geoLat: number | null;
  geoLng: number | null;
  registradoEm: string; // ISO do toque no botão
  fotos: FotoPendente[];
  estado: "pendente" | "erro";
  tentativas: number;
  ultimoErro: string | null;
  atualizadoEm: string;
};

// Resultado de UMA tentativa de envio (foto ou baixa), decidido só pelo
// status HTTP (contrato documentado na rota baixa/route.ts):
//   enviado       -> sai da fila
//   ja_registrada -> sai da fila (parada já tinha resultado; avisa)
//   sessao        -> fica; para a fila toda até o motorista entrar de novo
//   recusada      -> fica marcada "erro" (motorista vê e decide)
//   transitorio   -> fica; para a fila (sem rede / servidor fora)
export type Desfecho = "enviado" | "ja_registrada" | "sessao" | "recusada" | "transitorio";

export function desfechoDoStatus(status: number | null): Desfecho {
  if (status === null) return "transitorio"; // fetch lançou: sem rede
  if (status >= 200 && status < 300) return "enviado";
  if (status === 409) return "ja_registrada";
  if (status === 401) return "sessao";
  // 404 = deploy sem a rota (ou proxy no meio): nunca descartar a baixa por isso.
  if (status === 400 || status === 403 || status === 413 || status === 422) return "recusada";
  return "transitorio";
}

export function saiDaFila(d: Desfecho): boolean {
  return d === "enviado" || d === "ja_registrada";
}

export function interrompeFila(d: Desfecho): boolean {
  return d === "sessao" || d === "transitorio";
}

// Corpo JSON que vai para POST /assistencia/motorista/odoo/baixa.
export function corpoDaBaixa(b: BaixaPendente) {
  return {
    eventoUid: b.evento_uid,
    cargaId: b.cargaId,
    paradaId: b.paradaId,
    resultado: b.resultado,
    motivo: b.motivo,
    obs: b.obs,
    itens: b.itens ?? null,
    geoLat: b.geoLat,
    geoLng: b.geoLng,
    registradoEm: b.registradoEm,
    fotoUrls: b.fotos.map((f) => f.url).filter((u): u is string => !!u),
    fotoTipos: b.fotos.filter((f) => !!f.url).map((f) => f.tipo ?? "canhoto"),
  };
}

// UUID v4: crypto.randomUUID quando há (exige contexto seguro), senão
// getRandomValues (http por IP / navegadores antigos).
export function novoEventoUid(c: Pick<Crypto, "getRandomValues"> & { randomUUID?: () => string } = globalThis.crypto): string {
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function textoPendentes(n: number): string {
  return n === 1 ? "1 baixa aguardando envio" : `${n} baixas aguardando envio`;
}
