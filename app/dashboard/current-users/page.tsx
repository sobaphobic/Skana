"use client";

import {
  parseDeals,
  paidClosedWonDeals,
  readDeals,
  readDealsRaw,
  saveDeals,
  subscribeDeals,
  unpaidClosedWonDeals,
  type PipelineDeal,
} from "@/lib/dealsSession";
import { formatIsoDateMedium } from "@/lib/formatDate";
import { formatGbpFromPence } from "@/lib/priceListSession";
import {
  CheckCircle2,
  CircleDollarSign,
  RotateCcw,
  Search,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

type TabId = "awaiting" | "active";

/** Product start year filter options (newest first), plus “All years” in the UI. */
const YEAR_FILTER_MIN = 2023;
const YEAR_FILTER_MAX = 2060;
const SELECTABLE_YEARS: number[] = Array.from(
  { length: YEAR_FILTER_MAX - YEAR_FILTER_MIN + 1 },
  (_, i) => YEAR_FILTER_MAX - i,
);

function initialFromName(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

function dealMatchesQuery(d: PipelineDeal, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [
    d.saleName,
    d.contactName,
    d.contactEmail,
    d.productName,
  ].some((s) => s.toLowerCase().includes(t));
}

function sumPence(deals: PipelineDeal[]): number {
  return deals.reduce((a, d) => a + d.unitPricePence, 0);
}

function parseProductStartYear(d: PipelineDeal): number | null {
  const raw = d.productStartDate?.trim();
  if (!raw || raw.length < 4) return null;
  const y = Number.parseInt(raw.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function dealMatchesYear(d: PipelineDeal, year: "all" | number): boolean {
  if (year === "all") return true;
  const y = parseProductStartYear(d);
  return y !== null && y === year;
}

export default function CurrentUsersPage() {
  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);
  const awaiting = useMemo(() => unpaidClosedWonDeals(deals), [deals]);
  const active = useMemo(() => paidClosedWonDeals(deals), [deals]);

  const [tab, setTab] = useState<TabId>("awaiting");
  const [query, setQuery] = useState("");
  const [yearKey, setYearKey] = useState<string>("all");

  const yearFilter = useMemo((): "all" | number => {
    if (yearKey === "all") return "all";
    const n = Number.parseInt(yearKey, 10);
    return Number.isFinite(n) ? n : "all";
  }, [yearKey]);

  const awaitingScoped = useMemo(
    () => awaiting.filter((d) => dealMatchesYear(d, yearFilter)),
    [awaiting, yearFilter],
  );
  const activeScoped = useMemo(
    () => active.filter((d) => dealMatchesYear(d, yearFilter)),
    [active, yearFilter],
  );

  const filteredAwaiting = useMemo(
    () => awaitingScoped.filter((d) => dealMatchesQuery(d, query)),
    [awaitingScoped, query],
  );
  const filteredActive = useMemo(
    () => activeScoped.filter((d) => dealMatchesQuery(d, query)),
    [activeScoped, query],
  );

  const list = tab === "awaiting" ? filteredAwaiting : filteredActive;

  const markPaid = useCallback((id: string) => {
    const all = readDeals();
    saveDeals(
      all.map((d) =>
        d.id === id
          ? {
              ...d,
              paid: true,
              paidAt: d.paidAt ?? new Date().toISOString(),
            }
          : d,
      ),
    );
  }, []);

  /** Returns deal to Awaiting payment and clears payment timestamp (testing / corrections). */
  const unmarkPaid = useCallback((id: string) => {
    const all = readDeals();
    saveDeals(
      all.map((d) =>
        d.id === id ? { ...d, paid: false, paidAt: null } : d,
      ),
    );
  }, []);

  const awaitingValue = formatGbpFromPence(sumPence(awaitingScoped));
  const activeValue = formatGbpFromPence(sumPence(activeScoped));
  const totalScoped = awaitingScoped.length + activeScoped.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-crm-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-crm-muted">
            Customers
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream md:text-3xl">
            Current users
          </h1>
          <p className="mt-2 max-w-xl text-sm text-crm-muted">
            Everyone who has won on the pipeline.{" "}
            <strong className="font-medium text-crm-cream/90">Awaiting payment</strong>{" "}
            need to be marked paid; then they appear under{" "}
            <strong className="font-medium text-crm-cream/90">Active</strong>.
          </p>
        </div>
        <Link
          href="/dashboard/pipeline"
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5"
        >
          Open pipeline
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-100">
              <CircleDollarSign className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-crm-muted">Awaiting payment</p>
              <p className="text-lg font-semibold tabular-nums text-crm-cream">
                {awaitingScoped.length}
              </p>
              <p className="text-xs text-crm-muted">{awaitingValue} outstanding</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-100">
              <UserCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium text-crm-muted">Active users</p>
              <p className="text-lg font-semibold tabular-nums text-crm-cream">
                {activeScoped.length}
              </p>
              <p className="text-xs text-crm-muted">{activeValue} contracted</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-100">
              <Users className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-crm-muted">Total customers</p>
              <p className="text-lg font-semibold tabular-nums text-crm-cream">
                {totalScoped}
              </p>
              <p className="text-xs text-crm-muted">
                {yearFilter === "all"
                  ? "Closed won · all dates"
                  : `Product starts in ${yearFilter}`}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-crm-border/40 pt-3">
            <label
              htmlFor="cu-year-filter"
              className="text-[0.65rem] font-semibold uppercase tracking-wide text-crm-muted"
            >
              Filter by start year
            </label>
            <select
              id="cu-year-filter"
              value={yearKey}
              onChange={(e) => setYearKey(e.target.value)}
              className="mt-1.5 w-full cursor-pointer rounded-xl border border-crm-border bg-crm-bg/40 px-3 py-2 text-sm text-crm-cream outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f2e8cf' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.65rem center",
                backgroundSize: "1rem",
                paddingRight: "2.25rem",
                appearance: "none",
              }}
            >
              <option value="all" className="bg-crm-bg text-crm-cream">
                All years
              </option>
              {SELECTABLE_YEARS.map((y) => (
                <option key={y} value={String(y)} className="bg-crm-bg text-crm-cream">
                  {y}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[0.65rem] leading-snug text-crm-muted">
              Choose <strong className="font-medium text-crm-cream/80">All years</strong> or a
              single year ({YEAR_FILTER_MIN}–{YEAR_FILTER_MAX}) using each deal’s product start
              date. No start date → visible only under All years.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex rounded-xl border border-crm-border/80 bg-crm-bg/35 p-1"
          role="tablist"
          aria-label="User segments"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "awaiting"}
            onClick={() => setTab("awaiting")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "awaiting"
                ? "bg-crm-active/90 text-crm-cream shadow-sm"
                : "text-crm-muted hover:text-crm-cream"
            }`}
          >
            Awaiting payment
            <span className="ml-1.5 tabular-nums opacity-80">
              ({awaitingScoped.length})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "active"}
            onClick={() => setTab("active")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "active"
                ? "bg-crm-active/90 text-crm-cream shadow-sm"
                : "text-crm-muted hover:text-crm-cream"
            }`}
          >
            Active
            <span className="ml-1.5 tabular-nums opacity-80">({activeScoped.length})</span>
          </button>
        </div>

        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-crm-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, product…"
            className="w-full rounded-xl border border-crm-border bg-crm-bg/40 py-2.5 pl-10 pr-3 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15"
            aria-label="Search customers"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-crm-border bg-crm-elevated/20 px-6 py-16 text-center shadow-sm">
          <p className="text-sm text-crm-muted">
            {tab === "awaiting" && awaiting.length === 0 ? (
              <>
                No customers awaiting payment. Move a deal to{" "}
                <Link
                  href="/dashboard/pipeline"
                  className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
                >
                  Closed won
                </Link>{" "}
                on the pipeline.
              </>
            ) : tab === "active" && active.length === 0 ? (
              <>
                No active users yet. Mark deals as paid from the{" "}
                <strong className="font-medium text-crm-cream/85">Awaiting payment</strong>{" "}
                tab.
              </>
            ) : query.trim() &&
              (tab === "awaiting"
                ? awaitingScoped.length > 0
                : activeScoped.length > 0) ? (
              <>
                No matches for &ldquo;{query.trim()}&rdquo;. Try a different search or clear
                the filter.
              </>
            ) : yearFilter !== "all" &&
              (tab === "awaiting"
                ? awaitingScoped.length === 0 && awaiting.length > 0
                : activeScoped.length === 0 && active.length > 0) ? (
              <>
                No {tab === "awaiting" ? "awaiting" : "active"} customers with a product start
                in{" "}
                <strong className="font-medium text-crm-cream/85">{yearFilter}</strong>. Try{" "}
                <strong className="font-medium text-crm-cream/85">All years</strong> or set
                start dates on deals.
              </>
            ) : tab === "awaiting" ? (
              <>
                No customers awaiting payment. Move a deal to{" "}
                <Link
                  href="/dashboard/pipeline"
                  className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
                >
                  Closed won
                </Link>{" "}
                on the pipeline.
              </>
            ) : (
              <>
                No active users yet. Mark deals as paid from the{" "}
                <strong className="font-medium text-crm-cream/85">Awaiting payment</strong>{" "}
                tab.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-crm-border bg-crm-elevated/15 shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-crm-border/50 bg-crm-bg/30">
                  <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                    Customer
                  </th>
                  <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                    Email
                  </th>
                  <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                    Product
                  </th>
                  <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                    Start
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-crm-muted" scope="col">
                    Value
                  </th>
                  <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-crm-muted" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/40">
                {list.map((d) => (
                  <tr
                    key={d.id}
                    className="transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crm-cream/15 text-sm font-semibold text-crm-cream ring-1 ring-crm-border/60">
                          {initialFromName(d.contactName || d.saleName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-crm-cream">{d.saleName}</p>
                          <p className="truncate text-xs text-crm-muted">
                            {d.contactName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-crm-cream/90">
                      {d.contactEmail || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 text-crm-muted">
                      {d.productName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-crm-muted">
                      {d.productStartDate
                        ? formatIsoDateMedium(d.productStartDate)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-crm-cream">
                      {formatGbpFromPence(d.unitPricePence)}
                    </td>
                    <td className="px-4 py-3">
                      {tab === "awaiting" ? (
                        <span className="inline-flex rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-100">
                          Payment pending
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-100">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tab === "awaiting" ? (
                        <button
                          type="button"
                          onClick={() => markPaid(d.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-white/35 bg-white px-3 py-1.5 text-xs font-bold text-crm-bg shadow-sm transition hover:bg-crm-cream"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          Mark paid
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => unmarkPaid(d.id)}
                          title="Return to Awaiting payment; removes from pipeline Closed won until marked paid again"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-crm-border/90 bg-crm-bg/30 px-3 py-1.5 text-xs font-semibold text-crm-muted transition hover:border-amber-400/35 hover:text-crm-cream"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                          Unmark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {list.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-crm-border bg-crm-elevated/20 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-crm-cream/15 text-sm font-semibold text-crm-cream ring-1 ring-crm-border/60">
                    {initialFromName(d.contactName || d.saleName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-crm-cream">{d.saleName}</p>
                      {tab === "awaiting" ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-100">
                          Pending
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-100">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-crm-muted">{d.contactName}</p>
                    <p className="mt-1 truncate text-xs text-crm-muted">{d.contactEmail}</p>
                    <p className="mt-2 text-sm text-crm-cream/90">{d.productName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-crm-muted">
                      {d.productStartDate ? (
                        <span>Starts {formatIsoDateMedium(d.productStartDate)}</span>
                      ) : null}
                      <span className="font-semibold tabular-nums text-crm-cream">
                        {formatGbpFromPence(d.unitPricePence)}
                      </span>
                    </div>
                    {tab === "awaiting" ? (
                      <button
                        type="button"
                        onClick={() => markPaid(d.id)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/35 bg-white px-4 py-2.5 text-sm font-bold text-crm-bg shadow-md transition hover:bg-crm-cream"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Mark as paid
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => unmarkPaid(d.id)}
                        title="Return to Awaiting payment"
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-crm-border/90 bg-crm-bg/30 px-4 py-2.5 text-sm font-semibold text-crm-muted transition hover:border-amber-400/35 hover:text-crm-cream"
                      >
                        <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Unmark paid
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
