export type ContactHistoryEntry = {
  id: string;
  body: string;
  createdAt: string;
};

export function createHistoryEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-h`;
}

export function parseContactHistoryEntries(raw: unknown): ContactHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ContactHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const body = typeof r.body === "string" ? r.body.trim() : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
    if (!id || !body || !createdAt) continue;
    out.push({ id, body, createdAt });
  }
  return out.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function formatHistoryWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
