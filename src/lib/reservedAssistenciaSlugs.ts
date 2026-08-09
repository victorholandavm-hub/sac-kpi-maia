// Todo mundo que mora direto em src/app/assistencia/ (fora do grupo (app))
// como uma página "bare" (só .../assistencia/<isso>, sem mais nada depois)
// -- ou seja, tudo que colide com o parâmetro de rota .../assistencia/[id]
// de dentro de (app). Usado pra blindar [id]/page.tsx e a versão
// interceptada (@modal/(.)[id]/page.tsx) contra um bug real do Next 16:
// navegação client-side (Link, ou redirect() de dentro de Server Action)
// pra uma dessas rotas literais às vezes resolve errado pro [id] dinâmico
// de (app) em vez da página literal de verdade (achado ao vivo: clicar em
// "Equipe assistência"/"Admin" na tela inicial abria a fila com uma gaveta
// dizendo "Solicitação não encontrada" em vez do formulário de login).
// Recarregar a URL direto sempre funciona certo -- só a navegação suave
// que quebra -- então a blindagem força um reload de verdade.
export const RESERVED_ASSISTENCIA_SLUGS = [
  "login",
  "quem-e-voce",
  "redefinir-senha",
  "solicitar",
  "encomendas",
  "loja",
  "montador",
  "motorista",
  "sac",
] as const;

export function isReservedAssistenciaSlug(id: string): boolean {
  return (RESERVED_ASSISTENCIA_SLUGS as readonly string[]).includes(id);
}
