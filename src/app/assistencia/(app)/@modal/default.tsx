// Exigido pelo Next pra slot paralelo: toda rota de (app) que não seja a
// interceptada (.)[id] precisa de um fallback vazio, senão o slot 404 no
// refresh de qualquer outra página (fila, agenda, etc.).
export default function Default() {
  return null;
}
