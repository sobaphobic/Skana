import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
  subscribeWorkspaceScope,
} from "./workspaceScope";

export const PRICE_LIST_SESSION_KEY = "skana_price_list";

const priceListListeners = new Set<() => void>();

/** Re-render subscribers after `savePriceList` (same tab). */
function priceListStorageKey(): string {
  const id = getEffectiveWorkspaceId();
  if (!id) return PRICE_LIST_SESSION_KEY;
  return namespacedSessionKey(PRICE_LIST_SESSION_KEY, id);
}

export function subscribePriceList(listener: () => void) {
  priceListListeners.add(listener);
  const uw = subscribeWorkspaceScope(listener);
  return () => {
    priceListListeners.delete(listener);
    uw();
  };
}

function emitPriceListChanged() {
  for (const fn of priceListListeners) {
    fn();
  }
}

export const SALE_TYPES = [
  { value: "license", label: "License" },
  { value: "bespoke", label: "Bespoke" },
  { value: "subscription", label: "Subscription" },
] as const;

export type SaleType = (typeof SALE_TYPES)[number]["value"];

export const DURATION_UNITS = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number]["value"];

export type PriceListItem = {
  id: string;
  name: string;
  saleType: SaleType;
  durationAmount: number;
  durationUnit: DurationUnit;
  unitPricePence: number;
};

function isSaleType(v: string): v is SaleType {
  return v === "license" || v === "bespoke" || v === "subscription";
}

function isDurationUnit(v: string): v is DurationUnit {
  return v === "days" || v === "weeks" || v === "months" || v === "years";
}

export function saleTypeLabel(value: SaleType): string {
  return SALE_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** e.g. "1 month", "3 weeks" */
export function formatDurationPhrase(
  amount: number,
  unit: DurationUnit,
): string {
  const singular: Record<DurationUnit, string> = {
    days: "day",
    weeks: "week",
    months: "month",
    years: "year",
  };
  const plural: Record<DurationUnit, string> = {
    days: "days",
    weeks: "weeks",
    months: "months",
    years: "years",
  };
  const n = Math.max(1, Math.round(amount));
  const word = n === 1 ? singular[unit] : plural[unit];
  return `${n} ${word}`;
}

export function readPriceListRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = priceListStorageKey();
    let raw = sessionStorage.getItem(key);
    const id = getEffectiveWorkspaceId();
    if (
      id &&
      (!raw || raw === "[]") &&
      key !== PRICE_LIST_SESSION_KEY
    ) {
      const leg = sessionStorage.getItem(PRICE_LIST_SESSION_KEY);
      if (leg && leg !== "[]" && leg.trim()) {
        try {
          const arr = JSON.parse(leg) as unknown;
          if (Array.isArray(arr) && arr.length > 0) {
            sessionStorage.setItem(key, leg);
            sessionStorage.removeItem(PRICE_LIST_SESSION_KEY);
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

export function parsePriceList(raw: string | null): PriceListItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: PriceListItem[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      let unitPricePence = 0;
      if (typeof r.unitPricePence === "number" && Number.isFinite(r.unitPricePence)) {
        unitPricePence = Math.max(0, Math.round(r.unitPricePence));
      }
      if (!id || !name) continue;

      let saleType: SaleType = "license";
      if (typeof r.saleType === "string" && isSaleType(r.saleType)) {
        saleType = r.saleType;
      }

      let durationAmount = 1;
      if (typeof r.durationAmount === "number" && Number.isFinite(r.durationAmount)) {
        durationAmount = Math.max(1, Math.round(r.durationAmount));
      }

      let durationUnit: DurationUnit = "months";
      if (typeof r.durationUnit === "string" && isDurationUnit(r.durationUnit)) {
        durationUnit = r.durationUnit;
      }

      out.push({
        id,
        name,
        saleType,
        durationAmount,
        durationUnit,
        unitPricePence,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function readPriceList(): PriceListItem[] {
  return parsePriceList(readPriceListRaw());
}

export function savePriceList(items: PriceListItem[]): void {
  try {
    sessionStorage.setItem(priceListStorageKey(), JSON.stringify(items));
    emitPriceListChanged();
  } catch {
    /* quota / private mode */
  }
}

export function formatGbpFromPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function parseGbpToPence(input: string): number | null {
  const t = input.trim().replace(/[£,]/g, "");
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
