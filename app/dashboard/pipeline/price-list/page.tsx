"use client";

import {
  DURATION_UNITS,
  SALE_TYPES,
  formatDurationPhrase,
  formatGbpFromPence,
  parseGbpToPence,
  parsePriceList,
  readPriceListRaw,
  saleTypeLabel,
  savePriceList,
  subscribePriceList,
  type DurationUnit,
  type PriceListItem,
  type SaleType,
} from "@/lib/priceListSession";
import { ArrowLeft, ListPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useState, useSyncExternalStore } from "react";

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

const selectClass = `${controlClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10`;
const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
} as const;

function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function parseDurationAmount(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export default function PriceListPage() {
  const itemsRaw = useSyncExternalStore(
    subscribePriceList,
    readPriceListRaw,
    () => null,
  );
  const items = useMemo(() => parsePriceList(itemsRaw), [itemsRaw]);
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useId();
  const saleTypeId = useId();
  const durationAmountId = useId();
  const durationUnitId = useId();
  const priceId = useId();

  const persist = useCallback((next: PriceListItem[]) => {
    savePriceList(next);
  }, []);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const saleTypeRaw = String(fd.get("sale_type") ?? "");
    const durationRaw = String(fd.get("duration_amount") ?? "");
    const durationUnitRaw = String(fd.get("duration_unit") ?? "");
    const priceRaw = String(fd.get("unit_price") ?? "");

    const saleType =
      saleTypeRaw === "license" || saleTypeRaw === "bespoke" || saleTypeRaw === "subscription"
        ? saleTypeRaw
        : null;
    const durationUnit =
      durationUnitRaw === "days" ||
      durationUnitRaw === "weeks" ||
      durationUnitRaw === "months" ||
      durationUnitRaw === "years"
        ? durationUnitRaw
        : null;
    const durationAmount = parseDurationAmount(durationRaw);
    const pence = parseGbpToPence(priceRaw);

    if (!name) {
      setFormError("Enter a name for this line item.");
      return;
    }
    if (!saleType) {
      setFormError("Choose a sale type.");
      return;
    }
    if (durationAmount === null) {
      setFormError("Enter a duration of at least 1.");
      return;
    }
    if (!durationUnit) {
      setFormError("Choose a duration unit.");
      return;
    }
    if (pence === null) {
      setFormError("Enter a valid unit price (e.g. 99 or 99.99).");
      return;
    }

    const next: PriceListItem[] = [
      ...items,
      {
        id: newItemId(),
        name,
        saleType: saleType as SaleType,
        durationAmount,
        durationUnit: durationUnit as DurationUnit,
        unitPricePence: pence,
      },
    ];
    persist(next);
    e.currentTarget.reset();
  };

  const remove = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <div>
        <Link
          href="/dashboard/pipeline"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-crm-muted transition hover:text-crm-cream"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back to sales pipeline
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-crm-cream">
              Price list
            </h1>
            <p className="mt-1 text-sm text-crm-muted">
              Add products or services you quote from the pipeline. Stored in
              this browser until Supabase is connected.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-crm-border bg-crm-elevated/20 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-crm-cream">
          <ListPlus className="h-4 w-4 text-crm-muted" strokeWidth={2} aria-hidden />
          Add line item
        </h2>
        <form className="mt-4 space-y-4" onSubmit={handleAdd}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor={nameId}
                className="text-sm font-medium text-crm-cream/95"
              >
                Name
              </label>
              <input
                id={nameId}
                name="name"
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. Website build — standard"
                className={controlClass}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor={saleTypeId}
                className="text-sm font-medium text-crm-cream/95"
              >
                Sale type
              </label>
              <select
                id={saleTypeId}
                name="sale_type"
                required
                className={selectClass}
                style={selectChevron}
                defaultValue="license"
              >
                {SALE_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-crm-bg text-crm-cream">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-crm-cream/95">Duration</span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <label htmlFor={durationAmountId} className="sr-only">
                    Duration amount
                  </label>
                  <input
                    id={durationAmountId}
                    name="duration_amount"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 12"
                    className={controlClass}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[12rem]">
                  <label htmlFor={durationUnitId} className="sr-only">
                    Duration unit
                  </label>
                  <select
                    id={durationUnitId}
                    name="duration_unit"
                    required
                    className={selectClass}
                    style={selectChevron}
                    defaultValue="months"
                  >
                    {DURATION_UNITS.map((u) => (
                      <option key={u.value} value={u.value} className="bg-crm-bg text-crm-cream">
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor={priceId}
                className="text-sm font-medium text-crm-cream/95"
              >
                Unit price (GBP)
              </label>
              <input
                id={priceId}
                name="unit_price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className={controlClass}
              />
            </div>
          </div>
          {formError ? (
            <p className="text-sm text-red-300/95" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
          >
            Add to price list
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-crm-border bg-crm-elevated/20 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-crm-cream">Your items</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-crm-muted">
            No line items yet. Add one above to build your list.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-crm-border/50">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-crm-cream">{item.name}</p>
                  <p className="mt-1 text-sm text-crm-muted">
                    {saleTypeLabel(item.saleType)}
                    <span className="text-crm-border"> · </span>
                    {formatDurationPhrase(item.durationAmount, item.durationUnit)}
                  </p>
                  <p className="mt-2 text-sm font-semibold tabular-nums text-crm-cream">
                    {formatGbpFromPence(item.unitPricePence)}{" "}
                    <span className="font-normal text-crm-muted">unit price</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-crm-border/80 px-3 py-2 text-sm font-medium text-crm-cream/90 transition hover:bg-red-500/15 hover:text-red-200"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
