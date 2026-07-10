export function Header() {
  return (
    <header
      className="flex items-center gap-4 pb-4"
      style={{ borderBottom: `3px solid var(--brand-orange)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Lojas Maia" className="h-14 w-14 object-contain shrink-0" />
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
          Painel de KPIs — SAC Maia
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Combina as tags aplicadas pelos atendentes com uma leitura por IA do conteúdo das
          conversas — usada para preencher o que a tag não capturou.
        </p>
      </div>
    </header>
  );
}
