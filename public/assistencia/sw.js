/* Service worker da PWA "Maia Entregas" (app do motorista + telas do CD).
 *
 * Mora em /assistencia/sw.js (e não /sw.js) de propósito: o escopo máximo de
 * um SW é a pasta dele, então daqui o escopo /assistencia/ sai natural (sem
 * header Service-Worker-Allowed) e o proxy.ts já deixa /assistencia passar
 * (sem exceção nova). Com basePath (/apps, /apps/sac) tudo é calculado a
 * partir do próprio endereço deste arquivo.
 *
 * O QUE ELE FAZ
 *  - assets estáticos (/_next/static, ícones, logo, manifest):
 *    stale-while-revalidate;
 *  - navegação (páginas): network-first; sem rede -> /assistencia/offline
 *    (página estática, sem dado de cliente, pré-cacheada);
 *  - Background Sync "maia-fila-baixas": envia as baixas guardadas no
 *    IndexedDB (mesmas regras de src/lib/pwa/filaBaixasRegras.ts).
 *
 * O QUE ELE NUNCA FAZ (decisão de segurança/privacidade)
 *  - não cacheia NENHUMA página/HTML além da página offline: as páginas do
 *    motorista e do CD trazem nome, endereço e telefone de cliente;
 *  - não intercepta /api/*, POST (Server Actions, upload de foto, baixa),
 *    requisições RSC (?_rsc / header RSC: dados da página), nem
 *    /api/photos (foto de cliente), nem PDFs.
 *
 * VERSÃO: mudou este arquivo -> subir SW_VERSAO. O navegador detecta o
 * arquivo novo, instala em espera e o app mostra "Nova versão disponível".
 */

const SW_VERSAO = "2026-10-25.1";
const PREFIXO = "maia-pwa-";
const CACHE_SHELL = `${PREFIXO}shell-${SW_VERSAO}`;
const CACHE_STATIC = `${PREFIXO}static-${SW_VERSAO}`;
const MAX_STATIC = 180;

// .../apps/assistencia/sw.js -> BASE = ".../apps", ESCOPO = ".../apps/assistencia/"
const ESCOPO = new URL("./", self.location.href).pathname;
const BASE = ESCOPO.replace(/\/assistencia\/$/, "");
const URL_OFFLINE = `${ESCOPO}offline`;
const SHELL_FIXO = [
  URL_OFFLINE,
  `${ESCOPO}manifest.webmanifest`,
  `${ESCOPO}pwa/icon-192.png`,
  `${ESCOPO}pwa/icon-512.png`,
  `${ESCOPO}pwa/maskable-192.png`,
  `${ESCOPO}pwa/maskable-512.png`,
  `${ESCOPO}pwa/apple-touch-icon.png`,
];

// ------------------------------------------------------------ ciclo de vida

self.addEventListener("install", (event) => {
  event.waitUntil(atualizarShell());
  // Sem skipWaiting automático: a versão nova espera o "Atualizar" do aviso
  // (trocar o SW no meio de uma baixa seria pior que esperar).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n.startsWith(PREFIXO) && n !== CACHE_SHELL && n !== CACHE_STATIC).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const tipo = event.data && event.data.tipo;
  if (tipo === "SKIP_WAITING") self.skipWaiting();
  if (tipo === "ENVIAR_FILA") event.waitUntil(enviarFila().catch(() => {}));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "maia-fila-baixas") event.waitUntil(enviarFila());
});

// ------------------------------------------------------------ cache

// Baixa a página offline + os assets que ela referencia (para renderizar
// com CSS/JS sem rede). Chamado na instalação e, no máximo 1x/hora, depois
// de uma navegação bem-sucedida (deploy novo troca os hashes dos chunks).
let ultimaAtualizacaoShell = 0;
async function atualizarShell() {
  ultimaAtualizacaoShell = Date.now();
  const cache = await caches.open(CACHE_SHELL);
  const res = await fetch(URL_OFFLINE, { cache: "reload", credentials: "omit" });
  // redirecionada = instância que não serve a página offline (ESTORNO_EMBED,
  // redirect de domínio): não guardar o destino, pode ser página com dado.
  if (!res.ok || res.redirected) throw new Error(`offline ${res.status}`);
  const html = await res.clone().text();
  const assets = new Set();
  const re = /(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) assets.add(new URL(m[1].replace(/&amp;/g, "&"), self.location.origin).pathname);
  await cache.put(URL_OFFLINE, res);
  const resto = SHELL_FIXO.filter((u) => u !== URL_OFFLINE).concat([...assets]);
  await Promise.all(resto.map((u) => cache.add(new Request(u, { cache: "reload", credentials: "omit" })).catch(() => {})));
  // tira do shell os chunks de deploys anteriores
  const manter = new Set([...SHELL_FIXO, ...assets]);
  for (const req of await cache.keys()) {
    if (!manter.has(new URL(req.url).pathname)) await cache.delete(req);
  }
}

function ehEstatico(url) {
  const p = url.pathname;
  return (
    p.startsWith(`${BASE}/_next/static/`) ||
    p.startsWith(`${ESCOPO}pwa/`) ||
    p === `${ESCOPO}manifest.webmanifest` ||
    p === `${BASE}/logo.png` ||
    p === `${BASE}/icon.png` ||
    p === `${BASE}/favicon.ico`
  );
}

function nuncaInterceptar(req, url) {
  if (req.method !== "GET") return true; // Server Actions, uploads, baixa
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith(`${BASE}/api/`)) return true; // inclui /api/photos
  if (url.searchParams.has("_rsc")) return true;
  if (req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch") || req.headers.get("Next-Action")) return true;
  if (url.pathname.includes("/pdf/") || url.pathname.endsWith("/foto") || url.pathname.endsWith("/baixa")) return true;
  return false;
}

async function aparar(nome, max) {
  const cache = await caches.open(nome);
  const chaves = await cache.keys();
  for (let i = 0; i < chaves.length - max; i++) await cache.delete(chaves[i]);
}

async function staleWhileRevalidate(event) {
  const req = event.request;
  const emCache = await caches.match(req);
  const rede = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === "basic") {
        const c = await caches.open(CACHE_STATIC);
        await c.put(req, res.clone());
        await aparar(CACHE_STATIC, MAX_STATIC);
      }
      return res;
    })
    .catch(() => null);
  if (emCache) {
    event.waitUntil(rede);
    return emCache;
  }
  const res = await rede;
  return res || new Response("", { status: 504, statusText: "offline" });
}

async function networkFirstNavegacao(event) {
  try {
    const pre = event.preloadResponse ? await event.preloadResponse : null;
    const res = pre || (await fetch(event.request));
    if (res.ok && Date.now() - ultimaAtualizacaoShell > 3_600_000) event.waitUntil(atualizarShell().catch(() => {}));
    return res; // nunca vai para o cache: página tem dado de cliente
  } catch {
    const offline = await caches.match(URL_OFFLINE);
    return offline || new Response("<h1>Sem conexão</h1><p>Tente de novo quando a rede voltar.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (nuncaInterceptar(req, url)) return;
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavegacao(event));
    return;
  }
  if (ehEstatico(url)) event.respondWith(staleWhileRevalidate(event));
  // resto: rede direta, sem cache
});

// ------------------------------------------------------------ fila offline
// Espelho de src/lib/pwa/filaBaixas.ts + filaBaixasRegras.ts (mesmo banco,
// mesmo lock, mesmo contrato de status). Mudou lá, mudar aqui.

const FILA_DB = "maia-pwa";
const FILA_STORE = "baixas";
const FILA_LOCK = "maia-fila-baixas";

function desfechoDoStatus(status) {
  if (status === null) return "transitorio";
  if (status >= 200 && status < 300) return "enviado";
  if (status === 409) return "ja_registrada";
  if (status === 401) return "sessao";
  if (status === 400 || status === 403 || status === 413 || status === 422) return "recusada";
  return "transitorio";
}

function abrirDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(FILA_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(FILA_STORE)) req.result.createObjectStore(FILA_STORE, { keyPath: "evento_uid" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function op(modo, fn) {
  const db = await abrirDb();
  try {
    return await new Promise((res, rej) => {
      const tx = db.transaction(FILA_STORE, modo);
      const r = fn(tx.objectStore(FILA_STORE));
      tx.oncomplete = () => res(r ? r.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

function avisar() {
  try {
    const c = new BroadcastChannel("maia-fila-baixas");
    c.postMessage({ tipo: "mudou" });
    c.close();
  } catch {
    /* sem BroadcastChannel */
  }
}

async function postar(url, init, timeoutMs) {
  try {
    const res = await fetch(url, Object.assign({}, init, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) }));
    let corpo = {};
    try {
      corpo = await res.json();
    } catch {
      corpo = {};
    }
    return { status: res.status, corpo };
  } catch {
    return { status: null, corpo: {} };
  }
}

function msgErro(corpo, padrao) {
  const e = corpo && (corpo.erro || corpo.error);
  return typeof e === "string" && e ? e : padrao;
}

async function enviarRegistro(b) {
  for (const foto of b.fotos || []) {
    if (foto.url) continue;
    const fd = new FormData();
    fd.set("photo", new File([foto.blob], foto.nome || "comprovante.jpg", { type: foto.blob.type || "image/jpeg" }));
    fd.set("cargaId", String(b.cargaId));
    fd.set("paradaId", String(b.paradaId));
    const r = await postar(`${ESCOPO}motorista/odoo/foto`, { method: "POST", body: fd }, 60000);
    const d = desfechoDoStatus(r.status);
    if (d !== "enviado" || typeof r.corpo.url !== "string") {
      return { desfecho: d === "enviado" ? "transitorio" : d, erro: r.status === null ? "Sem conexão." : msgErro(r.corpo, `Foto não enviada (erro ${r.status}).`) };
    }
    foto.url = r.corpo.url;
    await op("readwrite", (s) => s.put(b));
  }
  const corpo = {
    eventoUid: b.evento_uid,
    cargaId: b.cargaId,
    paradaId: b.paradaId,
    resultado: b.resultado,
    motivo: b.motivo,
    obs: b.obs,
    geoLat: b.geoLat,
    geoLng: b.geoLng,
    registradoEm: b.registradoEm,
    fotoUrls: (b.fotos || []).map((f) => f.url).filter(Boolean),
    itens: b.itens ?? null,
    fotoTipos: b.fotos.filter((f) => !!f.url).map((f) => f.tipo ?? "canhoto"),
  };
  const r = await postar(`${ESCOPO}motorista/odoo/baixa`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }, 45000);
  const d = desfechoDoStatus(r.status);
  return { desfecho: d, erro: d === "enviado" ? null : r.status === null ? "Sem conexão." : msgErro(r.corpo, `Erro ${r.status} ao registrar.`) };
}

async function enviarFilaSemLock() {
  const lista = ((await op("readonly", (s) => s.getAll())) || []).sort((a, b) => String(a.registradoEm).localeCompare(String(b.registradoEm)));
  let semRede = false;
  for (const b of lista) {
    if (b.estado !== "pendente") continue;
    const t = await enviarRegistro(b);
    if (t.desfecho === "enviado" || t.desfecho === "ja_registrada") {
      await op("readwrite", (s) => s.delete(b.evento_uid));
      avisar();
      continue;
    }
    b.tentativas = (b.tentativas || 0) + 1;
    b.ultimoErro = t.erro;
    b.atualizadoEm = new Date().toISOString();
    if (t.desfecho === "recusada") b.estado = "erro";
    await op("readwrite", (s) => s.put(b));
    avisar();
    if (t.desfecho === "transitorio") {
      semRede = true;
      break;
    }
    if (t.desfecho === "sessao") break; // sem sessão não adianta o Sync repetir
  }
  // Rejeitar faz o navegador reagendar o Background Sync (com backoff).
  if (semRede) throw new Error("fila: sem rede, tentar de novo");
}

function enviarFila() {
  if (self.navigator && self.navigator.locks) return self.navigator.locks.request(FILA_LOCK, enviarFilaSemLock);
  return enviarFilaSemLock();
}
