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
      className={`rounded-lg border border-gray-200 px-3.5 py-2 text-sm hover:border-gray-300 focus:border-gray-300 focus:outline-none transition-colors duration-150 ${
        value ? "text-gray-800" : "text-gray-500"
      }`}
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
