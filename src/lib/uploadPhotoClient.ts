// Compartilhado entre MontadorPhotoUpload.tsx, MotoristaPhotoUpload.tsx e
// RequestPhotoUpload.tsx (upload de foto pelas 3 pontas que sobem foto pra
// um chamado: montador, motorista, equipe/assistência) -- as três tinham o
// mesmo bloco de fetch + parse de resposta copiado, e nenhuma tinha
// timeout. Extraído em 26/08/2026 durante a investigação do pedido do
// Victor ("montador e assistencia estão dizendo que nao estao conseguindo
// adicionar fotos"): os logs de produção mostravam vários "request
// recebida" de montador sem nenhum "sucesso"/erro depois -- sinal de fetch
// pendurado pra sempre numa rede ruim (celular do montador em obra/loja,
// já documentado em MontadorPhotoUpload.tsx), sem nunca resolver nem
// rejeitar. Sem timeout, a pessoa fica olhando "Enviando…" pra sempre, sem
// jeito de desistir e tentar de novo a não ser recarregar a página.
const UPLOAD_TIMEOUT_MS = 45_000;

export async function uploadPhotoRequest(url: string, formData: FormData): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: formData,
      // `AbortSignal.timeout` não existe em navegadores muito antigos --
      // sem essa guarda, faltando a API o fetch nem chegava a rodar (erro
      // síncrono antes do try nem entrar em jogo). Sem ela, comportamento
      // de antes (sem timeout algum).
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(UPLOAD_TIMEOUT_MS) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("A conexão está muito lenta pra enviar a foto. Tente de novo.");
    }
    throw new Error("Não foi possível enviar a foto -- confira sua conexão e tente de novo.");
  }

  // Lê como texto primeiro (só dá pra ler o corpo uma vez) -- se não for
  // JSON válido, é sinal de que a resposta nem chegou na nossa rota (ex.:
  // nginx/proxy barrando antes, devolvendo página de erro HTML). Nesses
  // casos mostra o status HTTP na mensagem em vez de um erro genérico
  // mudo, pra dar pista de diagnóstico sem precisar de devtools no celular.
  const raw = await res.text();
  let data: { error?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // não era JSON -- segue com data vazio, cai no fallback abaixo
  }
  if (!res.ok) {
    throw new Error(data.error || `Não foi possível enviar a foto (erro ${res.status}).`);
  }
}
