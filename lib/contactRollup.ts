import type { PipelineDeal } from "@/lib/dealsSession";
import { formatIsoDateMedium } from "@/lib/formatDate";
import { OPEN_PIPELINE_STAGES } from "@/lib/pipelineStages";

const OPEN_SET = new Set(OPEN_PIPELINE_STAGES);

export function contactGroupKey(d: PipelineDeal): string {
  const e = d.contactEmail.trim().toLowerCase();
  if (e) return `email:${e}`;
  return `deal:${d.id}`;
}

export type RolledContact = {
  key: string;
  contactName: string;
  contactEmail: string;
  deals: PipelineDeal[];
  lastActivityLabel: string;
  pipelineSummary: string;
  totalValuePence: number;
};

export function rollContacts(deals: PipelineDeal[]): RolledContact[] {
  const buckets = new Map<string, PipelineDeal[]>();
  for (const d of deals) {
    const k = contactGroupKey(d);
    const arr = buckets.get(k) ?? [];
    arr.push(d);
    buckets.set(k, arr);
  }

  const rows: RolledContact[] = [];
  for (const [, list] of buckets) {
    const sorted = [...list].sort((a, b) =>
      a.saleName.localeCompare(b.saleName, "en", { sensitivity: "base" }),
    );
    const primary =
      sorted.find((d) => d.contactName.trim()) ?? sorted[0]!;
    const email =
      primary.contactEmail.trim() ||
      sorted.find((d) => d.contactEmail.trim())?.contactEmail.trim() ||
      "—";

    let open = 0;
    let wonAwaiting = 0;
    let activePaid = 0;
    let lost = 0;
    for (const d of list) {
      if (d.stageId === "closed_lost") lost++;
      else if (d.stageId === "closed_won" && d.paid) activePaid++;
      else if (d.stageId === "closed_won") wonAwaiting++;
      else if (OPEN_SET.has(d.stageId)) open++;
    }
    const parts: string[] = [];
    if (open) parts.push(`${open} open`);
    if (wonAwaiting) parts.push(`${wonAwaiting} won · unpaid`);
    if (activePaid) parts.push(`${activePaid} active`);
    if (lost) parts.push(`${lost} lost`);

    const latestStart = list
      .map((d) => d.productStartDate.trim())
      .filter(Boolean)
      .sort()
      .at(-1);
    const lastActivityLabel = latestStart
      ? `Start ${formatIsoDateMedium(latestStart)}`
      : `${list.length} deal${list.length === 1 ? "" : "s"}`;

    rows.push({
      key: contactGroupKey(primary),
      contactName: primary.contactName.trim() || primary.saleName || "Unknown",
      contactEmail: email,
      deals: sorted,
      lastActivityLabel,
      pipelineSummary: parts.length ? parts.join(" · ") : "—",
      totalValuePence: list.reduce((a, d) => a + d.unitPricePence, 0),
    });
  }

  return rows.sort((a, b) =>
    a.contactName.localeCompare(b.contactName, "en", { sensitivity: "base" }),
  );
}

export function dealsForPipelineContactKey(
  deals: PipelineDeal[],
  key: string,
): PipelineDeal[] {
  return deals.filter((d) => contactGroupKey(d) === key);
}
