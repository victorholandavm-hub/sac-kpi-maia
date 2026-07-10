export type RangePreset = "7d" | "month" | "year" | "all";

export type DateRange = {
  preset: RangePreset | "custom";
  from: Date | null;
  to: Date;
};

export function resolveRange(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const now = new Date();

  if (searchParams.from) {
    const from = new Date(searchParams.from);
    const to = searchParams.to ? new Date(searchParams.to) : now;
    return { preset: "custom", from, to };
  }

  const preset = (searchParams.range as RangePreset) ?? "all";

  if (preset === "7d") {
    return { preset, from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (preset === "month") {
    return { preset, from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (preset === "year") {
    return { preset, from: new Date(now.getFullYear(), 0, 1), to: now };
  }
  return { preset: "all", from: null, to: now };
}
