"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Option = string | { value: string; label: string };

export function FilterSelect({
  name,
  placeholder,
  options,
}: {
  name: string;
  placeholder: string;
  options: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(name) ?? "";
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set(name, e.target.value);
    } else {
      params.delete(name);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="rounded border px-3 py-2 text-sm"
      style={{ borderColor: "var(--border)", color: value ? "var(--text-primary)" : "var(--text-secondary)" }}
    >
      <option value="">{placeholder}</option>
      {normalized.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
