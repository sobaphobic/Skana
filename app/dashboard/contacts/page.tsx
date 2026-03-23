"use client";

import { ContactCardModal } from "@/components/dashboard/ContactCardModal";
import {
  appendManualContact,
  parseManualContacts,
  readManualContactsRaw,
  removeManualContact,
  subscribeManualContacts,
  type ManualContact,
  type ManualContactKind,
} from "@/lib/manualContactsSession";
import { rollContacts, type RolledContact } from "@/lib/contactRollup";
import {
  parseDeals,
  readDealsRaw,
  subscribeDeals,
} from "@/lib/dealsSession";
import { formatIsoDateMedium } from "@/lib/formatDate";
import { formatGbpFromPence } from "@/lib/priceListSession";
import {
  BookUser,
  Building2,
  Mail,
  Search,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type MouseEvent,
} from "react";

type TabId = "customer" | "business";

function customerPipelineMatchesQuery(c: RolledContact, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (c.contactName.toLowerCase().includes(t)) return true;
  if (c.contactEmail.toLowerCase().includes(t)) return true;
  return c.deals.some(
    (d) =>
      d.saleName.toLowerCase().includes(t) ||
      d.productName.toLowerCase().includes(t),
  );
}

function manualContactMatchesQuery(c: ManualContact, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [
    c.firstName,
    c.lastName,
    c.email,
    c.phone,
    c.jobTitle,
  ].some((s) => s.toLowerCase().includes(t));
}

function manualDisplayName(c: ManualContact): string {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return n || c.email;
}

/** Pipeline rollup for this email, if any — merged into the saved customer row to avoid duplicates. */
function rolledForManualCustomer(
  email: string,
  rolledList: RolledContact[],
): RolledContact | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return (
    rolledList.find(
      (r) =>
        r.contactEmail &&
        r.contactEmail !== "—" &&
        r.contactEmail.trim().toLowerCase() === e,
    ) ?? null
  );
}

type CustomerRow =
  | { source: "pipeline"; data: RolledContact }
  | { source: "manual"; data: ManualContact; rolled: RolledContact | null };

function initialFromName(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : "?";
}

function initialFromManual(c: ManualContact): string {
  return initialFromName(c.firstName || c.lastName || c.email);
}

const controlClass =
  "w-full rounded-xl border border-crm-border bg-crm-bg/40 px-3.5 py-2.5 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15";

export default function ContactsPage() {
  const dealsRaw = useSyncExternalStore(
    subscribeDeals,
    readDealsRaw,
    () => null,
  );
  const deals = useMemo(() => parseDeals(dealsRaw), [dealsRaw]);
  const pipelineCustomers = useMemo(() => rollContacts(deals), [deals]);

  const manualRaw = useSyncExternalStore(
    subscribeManualContacts,
    readManualContactsRaw,
    () => null,
  );
  const manualContacts = useMemo(
    () => parseManualContacts(manualRaw),
    [manualRaw],
  );

  const manualCustomers = useMemo(
    () => manualContacts.filter((c) => c.kind === "customer"),
    [manualContacts],
  );
  const manualBusiness = useMemo(
    () => manualContacts.filter((c) => c.kind === "business"),
    [manualContacts],
  );

  const manualCustomerEmails = useMemo(
    () =>
      new Set(
        manualCustomers
          .map((c) => c.email.trim().toLowerCase())
          .filter(Boolean),
      ),
    [manualCustomers],
  );

  const pipelineCustomersNotInManual = useMemo(
    () =>
      pipelineCustomers.filter(
        (r) =>
          r.contactEmail === "—" ||
          !manualCustomerEmails.has(r.contactEmail.trim().toLowerCase()),
      ),
    [pipelineCustomers, manualCustomerEmails],
  );

  const [tab, setTab] = useState<TabId>("customer");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [formKind, setFormKind] = useState<ManualContactKind>("customer");
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [cardSelection, setCardSelection] = useState<
    | { source: "pipeline"; rolled: RolledContact }
    | { source: "manual"; id: string }
    | null
  >(null);

  const firstId = useId();
  const lastId = useId();
  const phoneId = useId();
  const emailId = useId();
  const jobId = useId();

  const filteredManualWithRolled = useMemo(() => {
    return manualCustomers
      .map((c) => ({
        data: c,
        rolled: rolledForManualCustomer(c.email, pipelineCustomers),
      }))
      .filter(({ data, rolled }) => {
        if (manualContactMatchesQuery(data, query)) return true;
        if (rolled && customerPipelineMatchesQuery(rolled, query)) return true;
        return false;
      });
  }, [manualCustomers, pipelineCustomers, query]);

  const filteredPipelineOnly = useMemo(
    () =>
      pipelineCustomersNotInManual.filter((c) =>
        customerPipelineMatchesQuery(c, query),
      ),
    [pipelineCustomersNotInManual, query],
  );

  const filteredBusiness = useMemo(
    () => manualBusiness.filter((c) => manualContactMatchesQuery(c, query)),
    [manualBusiness, query],
  );

  const mergedCustomerRows = useMemo((): CustomerRow[] => {
    const manualRows: CustomerRow[] = filteredManualWithRolled.map(
      ({ data, rolled }) => ({
        source: "manual" as const,
        data,
        rolled,
      }),
    );
    const pipeRows: CustomerRow[] = filteredPipelineOnly.map((data) => ({
      source: "pipeline" as const,
      data,
    }));
    const rows = [...manualRows, ...pipeRows];
    rows.sort((a, b) => {
      const na =
        a.source === "pipeline"
          ? a.data.contactName
          : manualDisplayName(a.data);
      const nb =
        b.source === "pipeline"
          ? b.data.contactName
          : manualDisplayName(b.data);
      return na.localeCompare(nb, "en", { sensitivity: "base" });
    });
    return rows;
  }, [filteredManualWithRolled, filteredPipelineOnly]);

  const customerTabTotal =
    manualCustomers.length + pipelineCustomersNotInManual.length;
  const withPipelineEmailOnly = pipelineCustomersNotInManual.filter(
    (c) => c.contactEmail && c.contactEmail !== "—",
  ).length;
  const withCustomerEmail = manualCustomers.length + withPipelineEmailOnly;

  const businessWithPhone = manualBusiness.filter((c) => c.phone.trim()).length;
  const businessWithJob = manualBusiness.filter((c) => c.jobTitle.trim()).length;

  const resetForm = useCallback(() => {
    setFormKind("customer");
    setFormFirst("");
    setFormLast("");
    setFormPhone("");
    setFormEmail("");
    setFormJobTitle("");
    setFormError(null);
  }, []);

  const closeModal = useCallback(() => {
    setAddOpen(false);
    resetForm();
  }, [resetForm]);

  const handleAddSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const first = formFirst.trim();
    const last = formLast.trim();
    const phone = formPhone.trim();
    const email = formEmail.trim();
    const jobTitle = formJobTitle.trim();
    if (!first) {
      setFormError("First name is required.");
      return;
    }
    if (!last) {
      setFormError("Last name is required.");
      return;
    }
    if (!phone) {
      setFormError("Phone number is required.");
      return;
    }
    if (!email || !email.includes("@")) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (!jobTitle) {
      setFormError("Job title is required.");
      return;
    }
    appendManualContact({
      kind: formKind,
      firstName: first,
      lastName: last,
      phone,
      email,
      jobTitle,
    });
    closeModal();
    setTab(formKind === "customer" ? "customer" : "business");
  };

  const handleRemoveManual = (id: string, e?: MouseEvent) => {
    e?.stopPropagation();
    removeManualContact(id);
    setCardSelection((sel) =>
      sel?.source === "manual" && sel.id === id ? null : sel,
    );
  };

  useEffect(() => {
    if (!addOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addOpen, closeModal]);

  const noCustomerRows =
    manualCustomers.length === 0 && pipelineCustomers.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-crm-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-crm-muted">
            Directory
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-crm-cream md:text-3xl">
            Contacts
          </h1>
          <p className="mt-2 max-w-xl text-sm text-crm-muted">
            <strong className="font-medium text-crm-cream/90">Customer</strong> contacts
            include everyone on the pipeline plus anyone you add.{" "}
            <strong className="font-medium text-crm-cream/90">Business</strong> contacts
            are partners, suppliers, and other non-customer relationships.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setAddOpen(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-crm-border/80 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
        >
          <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add contact
        </button>
      </div>

      <div
        className="inline-flex rounded-xl border border-crm-border/80 bg-crm-bg/35 p-1"
        role="tablist"
        aria-label="Contact type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "customer"}
          onClick={() => setTab("customer")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "customer"
              ? "bg-crm-active/90 text-crm-cream shadow-sm"
              : "text-crm-muted hover:text-crm-cream"
          }`}
        >
          <UserCircle className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
          Customer contacts
          <span className="tabular-nums opacity-80">({customerTabTotal})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "business"}
          onClick={() => setTab("business")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "business"
              ? "bg-crm-active/90 text-crm-cream shadow-sm"
              : "text-crm-muted hover:text-crm-cream"
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
          Business contacts
          <span className="tabular-nums opacity-80">({manualBusiness.length})</span>
        </button>
      </div>

      {tab === "customer" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-100">
                <Users className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">Customer contacts</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {customerTabTotal}
                </p>
                <p className="text-xs text-crm-muted">Pipeline + added</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-100">
                <Mail className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">With email</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {withCustomerEmail}
                </p>
                <p className="text-xs text-crm-muted">Usable for outreach</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-100">
                <BookUser className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">Total deals</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {deals.length}
                </p>
                <p className="text-xs text-crm-muted">All stages</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-100">
                <Building2 className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">Business contacts</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {manualBusiness.length}
                </p>
                <p className="text-xs text-crm-muted">Saved on this device</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-100">
                <Mail className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">With phone</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {businessWithPhone}
                </p>
                <p className="text-xs text-crm-muted">Of business contacts</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/25 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/20 text-slate-100">
                <BookUser className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium text-crm-muted">With job title</p>
                <p className="text-lg font-semibold tabular-nums text-crm-cream">
                  {businessWithJob}
                </p>
                <p className="text-xs text-crm-muted">Role captured</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-crm-muted"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "customer"
              ? "Search name, email, phone, job title, sale or product…"
              : "Search name, email, phone or job title…"
          }
          className="w-full rounded-xl border border-crm-border bg-crm-bg/40 py-2.5 pl-10 pr-3 text-sm text-crm-cream placeholder:text-crm-muted/70 outline-none transition focus:border-crm-cream/45 focus:ring-2 focus:ring-crm-cream/15"
          aria-label="Search contacts"
        />
      </div>

      {tab === "customer" &&
        (mergedCustomerRows.length === 0 ? (
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/20 px-6 py-16 text-center shadow-sm">
            <p className="text-sm text-crm-muted">
              {noCustomerRows ? (
                <>
                  No customer contacts yet. Create a deal on the{" "}
                  <Link
                    href="/dashboard/pipeline"
                    className="font-medium text-crm-cream/90 underline-offset-2 hover:underline"
                  >
                    pipeline
                  </Link>{" "}
                  or use <strong className="font-medium text-crm-cream/85">Add contact</strong>{" "}
                  as a customer.
                </>
              ) : (
                <>
                  No matches for &ldquo;{query.trim()}&rdquo;. Try a different search or clear
                  the field.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-crm-border bg-crm-elevated/15 shadow-sm md:block">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-crm-border/50 bg-crm-bg/30">
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Contact
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Email
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Phone
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Job title
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Deals
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Pipeline
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-crm-muted" scope="col">
                      Value
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-crm-muted" scope="col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/40">
                  {mergedCustomerRows.map((row) =>
                    row.source === "pipeline" ? (
                      <tr
                        key={`p-${row.data.key}`}
                        className="cursor-pointer transition hover:bg-white/[0.04]"
                        onClick={() =>
                          setCardSelection({ source: "pipeline", rolled: row.data })
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crm-cream/15 text-sm font-semibold text-crm-cream ring-1 ring-crm-border/60">
                              {initialFromName(row.data.contactName)}
                            </span>
                            <div>
                              <p className="font-medium text-crm-cream">{row.data.contactName}</p>
                              <p className="text-[0.65rem] text-crm-muted">Pipeline</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[11rem] truncate px-4 py-3 text-crm-cream/90">
                          {row.data.contactEmail === "—" ? (
                            <span className="text-crm-muted">—</span>
                          ) : (
                            <a
                              href={`mailto:${row.data.contactEmail}`}
                              className="underline-offset-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.data.contactEmail}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-crm-muted">—</td>
                        <td className="max-w-[8rem] truncate px-4 py-3 text-crm-muted">—</td>
                        <td className="max-w-[10rem] px-4 py-3">
                          <p
                            className="truncate text-crm-muted"
                            title={row.data.deals.map((d) => d.saleName).join(", ")}
                          >
                            {row.data.deals.map((d) => d.saleName).join(", ")}
                          </p>
                          <p className="text-[0.65rem] text-crm-muted/90">
                            {row.data.deals.length} deal{row.data.deals.length === 1 ? "" : "s"} ·{" "}
                            {row.data.lastActivityLabel}
                          </p>
                        </td>
                        <td className="max-w-[12rem] px-4 py-3 text-xs text-crm-muted">
                          {row.data.pipelineSummary}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-crm-cream">
                          {formatGbpFromPence(row.data.totalValuePence)}
                        </td>
                        <td className="px-4 py-3 text-right text-crm-muted">—</td>
                      </tr>
                    ) : (
                      <tr
                        key={`m-${row.data.id}`}
                        className="cursor-pointer transition hover:bg-white/[0.04]"
                        onClick={() =>
                          setCardSelection({ source: "manual", id: row.data.id })
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-100 ring-1 ring-crm-border/60">
                              {initialFromManual(row.data)}
                            </span>
                            <div>
                              <p className="font-medium text-crm-cream">
                                {manualDisplayName(row.data)}
                              </p>
                              <p className="text-[0.65rem] text-crm-muted">
                                {row.rolled ? "Saved · linked deals" : "Saved customer"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[11rem] truncate px-4 py-3">
                          <a
                            href={`mailto:${row.data.email}`}
                            className="text-crm-cream/90 underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.data.email}
                          </a>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <a
                            href={`tel:${row.data.phone.replace(/\s/g, "")}`}
                            className="text-crm-cream/90 underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.data.phone}
                          </a>
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-crm-muted" title={row.data.jobTitle}>
                          {row.data.jobTitle}
                        </td>
                        <td className="max-w-[10rem] px-4 py-3">
                          {row.rolled ? (
                            <>
                              <p
                                className="truncate text-crm-muted"
                                title={row.rolled.deals.map((d) => d.saleName).join(", ")}
                              >
                                {row.rolled.deals.map((d) => d.saleName).join(", ")}
                              </p>
                              <p className="text-[0.65rem] text-crm-muted/90">
                                {row.rolled.deals.length} deal
                                {row.rolled.deals.length === 1 ? "" : "s"} ·{" "}
                                {row.rolled.lastActivityLabel}
                              </p>
                            </>
                          ) : (
                            <span className="text-crm-muted">—</span>
                          )}
                        </td>
                        <td className="max-w-[12rem] px-4 py-3 text-xs text-crm-muted">
                          {row.rolled ? row.rolled.pipelineSummary : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-crm-cream">
                          {row.rolled
                            ? formatGbpFromPence(row.rolled.totalValuePence)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleRemoveManual(row.data.id, e)}
                            className="text-xs font-semibold text-crm-muted underline-offset-2 transition hover:text-amber-200 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {mergedCustomerRows.map((row) =>
                row.source === "pipeline" ? (
                  <li
                    key={`p-${row.data.key}`}
                    className="cursor-pointer rounded-2xl border border-crm-border bg-crm-elevated/20 p-4 shadow-sm transition hover:bg-white/[0.03]"
                    onClick={() =>
                      setCardSelection({ source: "pipeline", rolled: row.data })
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-crm-cream/15 text-sm font-semibold text-crm-cream ring-1 ring-crm-border/60">
                        {initialFromName(row.data.contactName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-crm-cream">{row.data.contactName}</p>
                        <p className="text-[0.65rem] uppercase tracking-wide text-crm-muted">Pipeline</p>
                        {row.data.contactEmail !== "—" ? (
                          <a
                            href={`mailto:${row.data.contactEmail}`}
                            className="mt-1 block truncate text-sm text-crm-cream/85 underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.data.contactEmail}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-crm-muted">No email</p>
                        )}
                        <p className="mt-2 text-xs text-crm-muted">{row.data.pipelineSummary}</p>
                        <p className="mt-1 text-sm text-crm-cream/90">
                          {row.data.deals.map((d) => d.saleName).join(", ")}
                        </p>
                        <p className="mt-2 font-semibold tabular-nums text-crm-cream">
                          {formatGbpFromPence(row.data.totalValuePence)}
                        </p>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li
                    key={`m-${row.data.id}`}
                    className="cursor-pointer rounded-2xl border border-crm-border bg-emerald-500/5 p-4 shadow-sm ring-1 ring-emerald-500/15 transition hover:bg-emerald-500/10"
                    onClick={() =>
                      setCardSelection({ source: "manual", id: row.data.id })
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-100 ring-1 ring-crm-border/60">
                        {initialFromManual(row.data)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-crm-cream">{manualDisplayName(row.data)}</p>
                        <p className="text-[0.65rem] uppercase tracking-wide text-crm-muted">
                          {row.rolled ? "Saved · linked deals" : "Saved customer"}
                        </p>
                        <a
                          href={`mailto:${row.data.email}`}
                          className="mt-1 block truncate text-sm text-crm-cream/85 underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.data.email}
                        </a>
                        <a
                          href={`tel:${row.data.phone.replace(/\s/g, "")}`}
                          className="mt-1 block text-sm text-crm-cream/85 underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.data.phone}
                        </a>
                        <p className="mt-2 text-sm text-crm-muted">{row.data.jobTitle}</p>
                        {row.rolled ? (
                          <>
                            <p className="mt-2 text-xs text-crm-muted">{row.rolled.pipelineSummary}</p>
                            <p className="mt-1 text-sm text-crm-cream/90">
                              {row.rolled.deals.map((d) => d.saleName).join(", ")}
                            </p>
                            <p className="mt-2 font-semibold tabular-nums text-crm-cream">
                              {formatGbpFromPence(row.rolled.totalValuePence)}
                            </p>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveManual(row.data.id, e)}
                          className="mt-3 text-xs font-semibold text-crm-muted underline-offset-2 transition hover:text-amber-200 hover:underline"
                        >
                          Remove contact
                        </button>
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </>
        ))}

      {tab === "business" &&
        (filteredBusiness.length === 0 ? (
          <div className="rounded-2xl border border-crm-border bg-crm-elevated/20 px-6 py-16 text-center shadow-sm">
            <p className="text-sm text-crm-muted">
              {manualBusiness.length === 0 ? (
                <>
                  No business contacts yet. Use{" "}
                  <strong className="font-medium text-crm-cream/85">Add contact</strong> and
                  choose <strong className="font-medium text-crm-cream/85">Business contact</strong>.
                </>
              ) : (
                <>
                  No matches for &ldquo;{query.trim()}&rdquo;. Try a different search or clear
                  the field.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-crm-border bg-crm-elevated/15 shadow-sm md:block">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-crm-border/50 bg-crm-bg/30">
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Contact
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Email
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Phone
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Job title
                    </th>
                    <th className="px-4 py-3 font-semibold text-crm-muted" scope="col">
                      Added
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-crm-muted" scope="col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/40">
                  {filteredBusiness.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer transition hover:bg-white/[0.04]"
                      onClick={() => setCardSelection({ source: "manual", id: c.id })}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-100 ring-1 ring-crm-border/60">
                            {initialFromManual(c)}
                          </span>
                          <p className="font-medium text-crm-cream">{manualDisplayName(c)}</p>
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3">
                        <a
                          href={`mailto:${c.email}`}
                          className="text-crm-cream/90 underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.email}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <a
                          href={`tel:${c.phone.replace(/\s/g, "")}`}
                          className="text-crm-cream/90 underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.phone}
                        </a>
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-crm-muted" title={c.jobTitle}>
                        {c.jobTitle}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-crm-muted">
                        {formatIsoDateMedium(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => handleRemoveManual(c.id, e)}
                          className="text-xs font-semibold text-crm-muted underline-offset-2 transition hover:text-amber-200 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {filteredBusiness.map((c) => (
                <li
                  key={c.id}
                  className="cursor-pointer rounded-2xl border border-crm-border bg-crm-elevated/20 p-4 shadow-sm transition hover:bg-white/[0.03]"
                  onClick={() => setCardSelection({ source: "manual", id: c.id })}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-100 ring-1 ring-crm-border/60">
                      {initialFromManual(c)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-crm-cream">{manualDisplayName(c)}</p>
                      <a
                        href={`mailto:${c.email}`}
                        className="mt-0.5 block truncate text-sm text-crm-cream/85 underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.email}
                      </a>
                      <a
                        href={`tel:${c.phone.replace(/\s/g, "")}`}
                        className="mt-1 block text-sm text-crm-cream/85 underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.phone}
                      </a>
                      <p className="mt-2 text-sm text-crm-muted">{c.jobTitle}</p>
                      <p className="mt-2 text-xs text-crm-muted">
                        Added {formatIsoDateMedium(c.createdAt)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveManual(c.id, e)}
                        className="mt-3 text-xs font-semibold text-crm-muted underline-offset-2 transition hover:text-amber-200 hover:underline"
                      >
                        Remove contact
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ))}

      {cardSelection ? (
        <ContactCardModal
          key={
            cardSelection.source === "manual"
              ? `m-${cardSelection.id}`
              : `p-${cardSelection.rolled.key}`
          }
          onClose={() => setCardSelection(null)}
          selection={cardSelection}
          allDeals={deals}
        />
      ) : null}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contact-title"
            className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-crm-border bg-crm-main shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-crm-border/50 px-5 py-4">
              <div>
                <h2
                  id="add-contact-title"
                  className="text-lg font-semibold text-crm-cream"
                >
                  Add contact
                </h2>
                <p className="mt-1 text-sm text-crm-muted">
                  Saved on this device. Choose whether they belong under customer or business
                  contacts.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-crm-muted transition hover:bg-white/10 hover:text-crm-cream"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4 px-5 py-4">
              <div
                className="flex rounded-xl border border-crm-border/80 bg-crm-bg/35 p-1"
                role="group"
                aria-label="Contact category"
              >
                <button
                  type="button"
                  onClick={() => {
                    setFormKind("customer");
                    setFormError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    formKind === "customer"
                      ? "bg-crm-active/90 text-crm-cream shadow-sm"
                      : "text-crm-muted hover:text-crm-cream"
                  }`}
                >
                  <UserCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormKind("business");
                    setFormError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    formKind === "business"
                      ? "bg-crm-active/90 text-crm-cream shadow-sm"
                      : "text-crm-muted hover:text-crm-cream"
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  Business
                </button>
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100/95">
                  {formError}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={firstId} className="text-sm font-medium text-crm-cream/95">
                    First name
                  </label>
                  <input
                    id={firstId}
                    value={formFirst}
                    onChange={(e) => {
                      setFormFirst(e.target.value);
                      setFormError(null);
                    }}
                    className={controlClass}
                    placeholder="Jane"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={lastId} className="text-sm font-medium text-crm-cream/95">
                    Last name
                  </label>
                  <input
                    id={lastId}
                    value={formLast}
                    onChange={(e) => {
                      setFormLast(e.target.value);
                      setFormError(null);
                    }}
                    className={controlClass}
                    placeholder="Smith"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={phoneId} className="text-sm font-medium text-crm-cream/95">
                  Phone number
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  value={formPhone}
                  onChange={(e) => {
                    setFormPhone(e.target.value);
                    setFormError(null);
                  }}
                  className={controlClass}
                  placeholder="+44 7700 900000"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={emailId} className="text-sm font-medium text-crm-cream/95">
                  Email address
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={formEmail}
                  onChange={(e) => {
                    setFormEmail(e.target.value);
                    setFormError(null);
                  }}
                  className={controlClass}
                  placeholder="jane@company.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={jobId} className="text-sm font-medium text-crm-cream/95">
                  Job title
                </label>
                <input
                  id={jobId}
                  value={formJobTitle}
                  onChange={(e) => {
                    setFormJobTitle(e.target.value);
                    setFormError(null);
                  }}
                  className={controlClass}
                  placeholder="Head of Procurement"
                  autoComplete="organization-title"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-crm-border/40 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-crm-border/80 px-4 py-2.5 text-sm font-medium text-crm-cream transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl border border-crm-border/80 bg-crm-active/90 px-4 py-2.5 text-sm font-medium text-crm-cream shadow-sm transition hover:bg-crm-active"
                >
                  Save contact
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
