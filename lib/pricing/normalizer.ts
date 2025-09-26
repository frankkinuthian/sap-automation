export function normalizeName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferUnitFromName(name: string): string {
  const n = name.toLowerCase();
  if (/(kg|kgs|\(kgs\)|kilogram)/.test(n)) return "kg";
  return "unit";
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


