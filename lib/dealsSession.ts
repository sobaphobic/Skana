import {
  type LossReasonId,
  isLossReasonId,
  LOSS_REASONS,
} from "./lossReasons";
import {
  OPEN_PIPELINE_STAGES,
  type PipelineStageId,
  isPipelineStageId,
} from "./pipelineStages";
import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export type { LossReasonId } from "./lossReasons";
export { LOSS_REASONS, lossReasonLabel } from "./lossReasons";

export const DEALS_SESSION_KEY = "skana_pipeline_deals";

const dealsListeners = new Set<() => void>();

function dealsStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return DEALS_SESSION_KEY;
  return namespacedSessionKey(DEALS_SESSION_KEY, id);
}

export function subscribeDeals(listener: () => void) {
  dealsListeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    dealsListeners.delete(listener);
    uw();
  };
}

function emitDealsChanged() {
  for (const fn of dealsListeners) {
    fn();
  }
}

export type DealNote = {
  id: string;
  body: string;
  createdAt: string;
};

export type PipelineDeal = {
  id: string;
  stageId: PipelineStageId;
  /** Short label on pipeline cards (distinct from contact name). */
  saleName: string;
  contactName: string;
  contactEmail: string;
  productStartDate: string;
  priceListItemId: string;
  productName: string;
  unitPricePence: number;
  /**
   * After **Closed won**, stays false until marked paid in Current Users.
   * Paid deals stay `closed_won` in data but are hidden from the pipeline column.
   */
  paid: boolean;
  /** ISO timestamp when marked paid (used for “paid this calendar year” on the pipeline). */
  paidAt: string | null;
  /** Set when moved to Closed lost (via pipeline modal). Hidden from the Kanban column. */
  lossReason: LossReasonId | null;
  lossNote: string;
  notes: DealNote[];
};

export function readDealsRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = dealsStorageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || raw === "[]") &&
      key !== DEALS_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(DEALS_SESSION_KEY);
      if (leg && leg !== "[]" && leg.trim()) {
        try {
          const arr = JSON.parse(leg) as unknown;
          if (Array.isArray(arr) && arr.length > 0) {
            sessionStorage.setItem(key, leg);
            sessionStorage.removeItem(DEALS_SESSION_KEY);
            raw = leg;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function parseNotes(raw: unknown): DealNote[] {
  if (!Array.isArray(raw)) return [];
  const out: DealNote[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const body = typeof r.body === "string" ? r.body.trim() : "";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
    if (!id || !body || !createdAt) continue;
    out.push({ id, body, createdAt });
  }
  return out;
}

export function parseDeals(raw: string | null): PipelineDeal[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: PipelineDeal[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      const stageRaw = typeof r.stageId === "string" ? r.stageId : "lead";
      const stageId = isPipelineStageId(stageRaw) ? stageRaw : "lead";
      const contactName =
        typeof r.contactName === "string" ? r.contactName.trim() : "";
      const saleNameRaw =
        typeof r.saleName === "string" ? r.saleName.trim() : "";
      const saleName = saleNameRaw || contactName;
      const contactEmail =
        typeof r.contactEmail === "string" ? r.contactEmail.trim() : "";
      const productStartDate =
        typeof r.productStartDate === "string" ? r.productStartDate.trim() : "";
      const priceListItemId =
        typeof r.priceListItemId === "string" ? r.priceListItemId : "";
      const productName =
        typeof r.productName === "string" ? r.productName.trim() : "";
      let unitPricePence = 0;
      if (typeof r.unitPricePence === "number" && Number.isFinite(r.unitPricePence)) {
        unitPricePence = Math.max(0, Math.round(r.unitPricePence));
      }
      const paid = r.paid === true;
      let paidAt: string | null = null;
      if (typeof r.paidAt === "string" && r.paidAt.trim()) {
        const t = new Date(r.paidAt.trim());
        if (!Number.isNaN(t.getTime())) paidAt = r.paidAt.trim();
      }
      const lossRaw =
        typeof r.lossReason === "string" && isLossReasonId(r.lossReason)
          ? r.lossReason
          : null;
      const lossNote =
        typeof r.lossNote === "string" ? r.lossNote.trim() : "";
      if (!id || !contactName) continue;
      out.push({
        id,
        stageId,
        saleName,
        contactName,
        contactEmail,
        productStartDate,
        priceListItemId,
        productName,
        unitPricePence,
        paid,
        paidAt,
        lossReason: lossRaw,
        lossNote,
        notes: parseNotes(r.notes),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function readDeals(): PipelineDeal[] {
  return parseDeals(readDealsRaw());
}

export function saveDeals(deals: PipelineDeal[]): void {
  try {
    sessionStorage.setItem(dealsStorageKey(), JSON.stringify(deals));
    emitDealsChanged();
    if (typeof window !== "undefined") {
      void import("./workspaceSyncScheduler").then((m) => {
        m.scheduleWorkspaceDocumentPush("deals", () => deals);
      });
    }
  } catch {
    /* quota / private mode */
  }
}

export function sumPenceInStages(
  deals: PipelineDeal[],
  stages: PipelineStageId[],
): number {
  const set = new Set(stages);
  return deals.reduce(
    (acc, d) => (set.has(d.stageId) ? acc + d.unitPricePence : acc),
    0,
  );
}

/** Sum deal values where payment was recorded in the given calendar year (local). */
export function totalPaidThisCalendarYearPence(
  deals: PipelineDeal[],
  calendarYear: number,
): number {
  return deals.reduce((acc, d) => {
    if (!d.paid || !d.paidAt) return acc;
    const dt = new Date(d.paidAt);
    if (Number.isNaN(dt.getTime())) return acc;
    if (dt.getFullYear() !== calendarYear) return acc;
    return acc + d.unitPricePence;
  }, 0);
}

export function computeKpis(deals: PipelineDeal[]) {
  const calendarYear = new Date().getFullYear();
  const openTotal = sumPenceInStages(deals, OPEN_PIPELINE_STAGES);
  const wonUnpaid = deals.filter(
    (d) => d.stageId === "closed_won" && !d.paid,
  );
  const wonTotal = wonUnpaid.reduce((a, d) => a + d.unitPricePence, 0);
  const paidThisYearPence = totalPaidThisCalendarYearPence(
    deals,
    calendarYear,
  );
  return { openTotal, wonTotal, paidThisYearPence, kpiYear: calendarYear };
}

/** Closed-won deals still awaiting payment (shown on Current Users). */
export function unpaidClosedWonDeals(deals: PipelineDeal[]): PipelineDeal[] {
  return deals.filter((d) => d.stageId === "closed_won" && !d.paid);
}

/** Closed-won deals with payment recorded — active customers. */
export function paidClosedWonDeals(deals: PipelineDeal[]): PipelineDeal[] {
  return deals.filter((d) => d.stageId === "closed_won" && d.paid);
}

/** All deals recorded as closed lost (listed on Lost deals page by category). */
export function closedLostDeals(deals: PipelineDeal[]): PipelineDeal[] {
  return deals.filter((d) => d.stageId === "closed_lost");
}

/** Deals shown as cards on the pipeline board (lost + paid wins are archive-only). */
export function dealsVisibleOnKanban(deals: PipelineDeal[]): PipelineDeal[] {
  return deals.filter(
    (d) =>
      d.stageId !== "closed_lost" &&
      !(d.stageId === "closed_won" && d.paid),
  );
}

/** Group lost deals for the Lost deals page — fixed category order + uncategorised. */
export function groupLostDealsByReason(
  deals: PipelineDeal[],
): { reasonId: LossReasonId | "uncategorised"; label: string; deals: PipelineDeal[] }[] {
  const lost = closedLostDeals(deals);
  const buckets = new Map<LossReasonId | "uncategorised", PipelineDeal[]>();
  buckets.set("uncategorised", []);
  for (const r of LOSS_REASONS) {
    buckets.set(r.id, []);
  }
  for (const d of lost) {
    const key = d.lossReason ?? "uncategorised";
    const arr = buckets.get(key);
    if (arr) arr.push(d);
    else buckets.get("uncategorised")!.push(d);
  }
  const out: {
    reasonId: LossReasonId | "uncategorised";
    label: string;
    deals: PipelineDeal[];
  }[] = [];
  for (const r of LOSS_REASONS) {
    const list = buckets.get(r.id) ?? [];
    if (list.length > 0) {
      out.push({ reasonId: r.id, label: r.label, deals: list });
    }
  }
  const unc = buckets.get("uncategorised") ?? [];
  if (unc.length > 0) {
    out.push({
      reasonId: "uncategorised",
      label: "Uncategorised",
      deals: unc,
    });
  }
  return out;
}

/** Put a lost deal back on the board at **Lead** and clear loss metadata. */
export function reinstateLostDeal(
  deals: PipelineDeal[],
  dealId: string,
): PipelineDeal[] {
  return deals.map((d) =>
    d.id !== dealId
      ? d
      : {
          ...d,
          stageId: "lead",
          lossReason: null,
          lossNote: "",
        },
  );
}
