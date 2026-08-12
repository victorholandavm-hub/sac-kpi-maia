import Image from "next/image";
export function AssistenciaHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-4 pb-4 flex-wrap"
      style={{ borderBottom: "3px solid var(--brand-orange)" }}
    >
      <div className="flex items-center gap-4">
        <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-14 w-14 object-contain shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </header>
  );
}
