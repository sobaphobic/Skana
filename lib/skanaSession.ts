import { DEALS_SESSION_KEY } from "./dealsSession";
import {
  LEGACY_BUSINESS_CONTACTS_SESSION_KEY,
  MANUAL_CONTACTS_SESSION_KEY,
} from "./manualContactsSession";
import { PIPELINE_CONTACT_HISTORY_SESSION_KEY } from "./pipelineContactHistorySession";
import {
  TEAM_DEMO_UNREAD_SEED_KEY,
  TEAM_MESSAGES_SESSION_KEY,
} from "./teamMessagesSession";
import { TEAM_MESSAGES_READ_SESSION_KEY } from "./teamMessagesReadSession";
import { CALENDAR_ENTRIES_SESSION_KEY } from "./calendarSession";
import { PRICE_LIST_SESSION_KEY } from "./priceListSession";
import {
  ACTIVE_COMPANY_ID_KEY,
  namespacedSessionKey,
  syncActiveCompanyIdToSession,
} from "./workspaceScope";
import {
  resolveCompanyInviteFromSupabase,
  schedulePublishCompanyInvitesIfStale,
  schedulePublishCompanyInvitesToSupabase,
} from "./companyInviteRemote";
import { isSupabaseConfigured } from "./supabase/browser-client";

/** Session keys stored per company via `namespacedSessionKey(base, companyId)`. */
const SESSION_KEYS_NAMESPACED_PER_COMPANY = [
  DEALS_SESSION_KEY,
  MANUAL_CONTACTS_SESSION_KEY,
  LEGACY_BUSINESS_CONTACTS_SESSION_KEY,
  PIPELINE_CONTACT_HISTORY_SESSION_KEY,
  PRICE_LIST_SESSION_KEY,
  TEAM_MESSAGES_SESSION_KEY,
  TEAM_MESSAGES_READ_SESSION_KEY,
  TEAM_DEMO_UNREAD_SEED_KEY,
  CALENDAR_ENTRIES_SESSION_KEY,
] as const;

export function clearWorkspaceSessionKeysForCompany(companyId: string): void {
  const id = companyId.trim();
  if (!id || typeof window === "undefined") return;
  try {
    for (const base of SESSION_KEYS_NAMESPACED_PER_COMPANY) {
      sessionStorage.removeItem(namespacedSessionKey(base, id));
    }
  } catch {
    /* ignore */
  }
}

export const COMPANY_SESSION_KEY = "skana_company_profile";

/** localStorage: multi-company invite codes (normalized key → metadata). */
export const COMPANY_INVITE_REGISTRY_KEY = "skana_company_invite_registry";

/** localStorage: last saved invite code + company name so Join flow works across browser tabs. */
export const COMPANY_INVITE_LOOKUP_KEY = "skana_company_invite_lookup";

export type CompanyInviteRegistryEntry = {
  code: string;
  companyName: string;
  companyId: string;
};

type InviteRegistryFile = {
  byNorm: Record<string, CompanyInviteRegistryEntry>;
};

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalise for comparison (ignore spaces and punctuation). */
export function normalizeCompanyInviteCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/** New codes look like SKANA-X4K2-P8M1 (easy to read aloud). */
export function generateCompanyInviteCode(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += INVITE_CODE_ALPHABET[bytes[i]! % INVITE_CODE_ALPHABET.length]!;
  }
  return `SKANA-${s.slice(0, 4)}-${s.slice(4)}`;
}

export type CompanyInviteLookup = {
  code: string;
  companyName: string;
};

function readInviteRegistry(): InviteRegistryFile {
  if (typeof window === "undefined") return { byNorm: {} };
  try {
    const raw = localStorage.getItem(COMPANY_INVITE_REGISTRY_KEY);
    if (!raw) return { byNorm: {} };
    const o = JSON.parse(raw) as { byNorm?: unknown };
    const byNorm = o?.byNorm;
    if (!byNorm || typeof byNorm !== "object") return { byNorm: {} };
    return { byNorm: byNorm as Record<string, CompanyInviteRegistryEntry> };
  } catch {
    return { byNorm: {} };
  }
}

function writeInviteRegistry(reg: InviteRegistryFile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPANY_INVITE_REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    /* private mode */
  }
}

function upsertInviteRegistryEntry(entry: CompanyInviteRegistryEntry) {
  const norm = normalizeCompanyInviteCode(entry.code);
  if (!norm) return;
  const reg = readInviteRegistry();
  reg.byNorm[norm] = {
    code: entry.code.trim(),
    companyName: entry.companyName.trim(),
    companyId: entry.companyId.trim(),
  };
  writeInviteRegistry(reg);
  try {
    localStorage.setItem(
      COMPANY_INVITE_LOOKUP_KEY,
      JSON.stringify({
        code: entry.code.trim(),
        companyName: entry.companyName.trim(),
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Rebuild registry from all companies (single source of truth on save). */
function syncInviteRegistryFromCompanies(companies: CompanySession[]) {
  const next: InviteRegistryFile = { byNorm: {} };
  for (const c of companies) {
    const code = c.company_invite_code?.trim();
    if (!code || !c.id) continue;
    const norm = normalizeCompanyInviteCode(code);
    if (!norm) continue;
    next.byNorm[norm] = {
      code,
      companyName: c.name.trim(),
      companyId: c.id,
    };
  }
  writeInviteRegistry(next);
  const first = companies.find((c) => c.company_invite_code?.trim());
  if (first?.company_invite_code && first.name) {
    try {
      localStorage.setItem(
        COMPANY_INVITE_LOOKUP_KEY,
        JSON.stringify({
          code: first.company_invite_code.trim(),
          companyName: first.name.trim(),
        }),
      );
    } catch {
      /* ignore */
    }
  } else {
    try {
      localStorage.removeItem(COMPANY_INVITE_LOOKUP_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function findInviteByNormalizedCode(
  normalized: string,
): (CompanyInviteLookup & { companyId: string }) | null {
  if (!normalized) return null;
  ensureWorkspaceMigrated();
  const reg = readInviteRegistry();
  const hit = reg.byNorm[normalized];
  if (hit?.code && hit.companyName && hit.companyId) {
    return {
      code: hit.code,
      companyName: hit.companyName,
      companyId: hit.companyId,
    };
  }
  const rawBundle = (() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(COMPANY_SESSION_KEY);
    } catch {
      return null;
    }
  })();
  const bundleParsed = parseCompaniesBundle(rawBundle);
  if (bundleParsed) {
    for (const c of bundleParsed.companies) {
      if (
        c.company_invite_code &&
        normalizeCompanyInviteCode(c.company_invite_code) === normalized
      ) {
        return {
          code: c.company_invite_code.trim(),
          companyName: c.name.trim(),
          companyId: c.id,
        };
      }
    }
  }
  const legacy = readCompanyInviteLookup();
  if (
    legacy &&
    normalizeCompanyInviteCode(legacy.code) === normalized
  ) {
    return {
      code: legacy.code,
      companyName: legacy.companyName,
      companyId: "",
    };
  }
  return null;
}

export function readCompanyInviteLookup(): CompanyInviteLookup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPANY_INVITE_LOOKUP_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<CompanyInviteLookup>;
    const code = typeof o.code === "string" ? o.code.trim() : "";
    const companyName =
      typeof o.companyName === "string" ? o.companyName.trim() : "";
    if (!code || !companyName) return null;
    return { code, companyName };
  } catch {
    return null;
  }
}

const companyListeners = new Set<() => void>();

export function subscribeCompanySession(listener: () => void) {
  companyListeners.add(listener);
  return () => {
    companyListeners.delete(listener);
  };
}

function emitCompanyChanged() {
  for (const fn of companyListeners) {
    fn();
  }
}

/**
 * Full `skana_company_profile` payload for subscriptions. Must change whenever
 * the company list or active id changes — not only when the active row’s fields change.
 */
export function readCompanySessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  ensureWorkspaceMigrated();
  try {
    return sessionStorage.getItem(COMPANY_SESSION_KEY);
  } catch {
    return null;
  }
}

/** Post–sign-up user details (until Supabase profiles exist). */
export const ONBOARDING_PROFILE_KEY = "skana_onboarding_profile";

export type OnboardingProfile = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
};

export function readOnboardingProfileRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ONBOARDING_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function parseOnboardingProfile(
  raw: string | null,
): OnboardingProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<OnboardingProfile>;
    if (
      !p ||
      typeof p.firstName !== "string" ||
      typeof p.lastName !== "string"
    ) {
      return null;
    }
    return {
      email: String(p.email ?? "").trim(),
      username: String(p.username ?? "").trim(),
      firstName: p.firstName.trim(),
      lastName: p.lastName.trim(),
    };
  } catch {
    return null;
  }
}

export function saveOnboardingProfile(profile: OnboardingProfile): void {
  try {
    sessionStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

/** “Welcome back, …” — first + last name, or fallback. */
export function formatWelcomeDisplayName(
  profile: OnboardingProfile | null,
): string {
  if (!profile) return "there";
  const full = `${profile.firstName} ${profile.lastName}`.trim();
  return full || "there";
}

/** Label for “Signed up as …” on onboarding. */
export function signedUpAsLabel(profile: OnboardingProfile | null): string | null {
  if (!profile) return null;
  const full = `${profile.firstName} ${profile.lastName}`.trim();
  if (full) return full;
  if (profile.email) return profile.email;
  if (profile.username) return profile.username;
  return null;
}

export type CompanyPerson = {
  id: string;
  name: string;
  role: string;
  email?: string;
};

export type CompanyCredentialRow = {
  id: string;
  label: string;
  value: string;
  notes?: string;
  /** Mask value like a password in the UI */
  sensitive?: boolean;
};

export type CompanyDocument = {
  id: string;
  /** Friendly label in the UI (falls back to file name for older saves). */
  title: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
};

export type CompanySession = {
  /** Per-workspace id; required for v2 multi-company storage (empty only during legacy parse). */
  id: string;
  name: string;
  logoDataUrl: string | null;
  company_number?: string;
  company_address?: string;
  company_role?: string;
  /** Share with new users on the Join company screen (generated automatically). */
  company_invite_code?: string;
  people: CompanyPerson[];
  credentials: CompanyCredentialRow[];
  documents: CompanyDocument[];
};

export type CompaniesWorkspaceBundle = {
  v: 2;
  companies: CompanySession[];
  activeCompanyId: string;
};

const WORKSPACE_KEYS_TO_MIGRATE = [
  DEALS_SESSION_KEY,
  PIPELINE_CONTACT_HISTORY_SESSION_KEY,
  PRICE_LIST_SESSION_KEY,
  TEAM_MESSAGES_SESSION_KEY,
  TEAM_MESSAGES_READ_SESSION_KEY,
  CALENDAR_ENTRIES_SESSION_KEY,
] as const;

function migrateLegacyWorkspaceKeys(companyId: string) {
  for (const key of WORKSPACE_KEYS_TO_MIGRATE) {
    try {
      const val = sessionStorage.getItem(key);
      if (val != null) {
        sessionStorage.setItem(namespacedSessionKey(key, companyId), val);
        sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const manual = sessionStorage.getItem(MANUAL_CONTACTS_SESSION_KEY);
    const leg = sessionStorage.getItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
    const val = manual ?? leg;
    if (val != null) {
      sessionStorage.setItem(
        namespacedSessionKey(MANUAL_CONTACTS_SESSION_KEY, companyId),
        val,
      );
      sessionStorage.removeItem(MANUAL_CONTACTS_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_BUSINESS_CONTACTS_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
  try {
    const seed = sessionStorage.getItem(TEAM_DEMO_UNREAD_SEED_KEY);
    if (seed != null) {
      sessionStorage.setItem(
        namespacedSessionKey(TEAM_DEMO_UNREAD_SEED_KEY, companyId),
        seed,
      );
      sessionStorage.removeItem(TEAM_DEMO_UNREAD_SEED_KEY);
    }
  } catch {
    /* ignore */
  }
}

function parseCompaniesBundle(
  raw: string | null,
): CompaniesWorkspaceBundle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.v !== 2 || !Array.isArray(parsed.companies)) return null;
    const companies: CompanySession[] = [];
    for (const row of parsed.companies) {
      if (!row || typeof row !== "object") continue;
      const json = JSON.stringify(row);
      const c = parseCompanySession(json);
      if (c?.id) companies.push(c);
    }
    const activeCompanyId =
      typeof parsed.activeCompanyId === "string"
        ? parsed.activeCompanyId.trim()
        : "";
    if (companies.length === 0 || !activeCompanyId) return null;
    const activeOk = companies.some((c) => c.id === activeCompanyId);
    return {
      v: 2,
      companies,
      activeCompanyId: activeOk
        ? activeCompanyId
        : companies[0]!.id,
    };
  } catch {
    return null;
  }
}

function writeCompaniesWorkspaceBundle(bundle: CompaniesWorkspaceBundle) {
  try {
    sessionStorage.setItem(COMPANY_SESSION_KEY, JSON.stringify(bundle));
    syncActiveCompanyIdToSession(bundle.activeCompanyId);
    syncInviteRegistryFromCompanies(bundle.companies);
    schedulePublishCompanyInvitesToSupabase(bundle.companies);
    emitCompanyChanged();
  } catch {
    /* quota */
  }
}

/**
 * Ensures session is on the v2 multi-company shape and legacy workspace keys are scoped.
 * Safe to call on every read.
 */
export function ensureWorkspaceMigrated(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(COMPANY_SESSION_KEY);
    if (!raw) return;
    const bundle = parseCompaniesBundle(raw);
    if (bundle) {
      syncActiveCompanyIdToSession(bundle.activeCompanyId);
      syncInviteRegistryFromCompanies(bundle.companies);
      schedulePublishCompanyInvitesIfStale(bundle.companies);
      return;
    }
    const legacy = parseCompanySession(raw);
    if (!legacy || !legacy.name) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const company: CompanySession = { ...legacy, id };
    migrateLegacyWorkspaceKeys(id);
    const next: CompaniesWorkspaceBundle = {
      v: 2,
      companies: [company],
      activeCompanyId: id,
    };
    writeCompaniesWorkspaceBundle(next);
  } catch {
    /* ignore */
  }
}

export function readCompaniesWorkspaceBundle(): CompaniesWorkspaceBundle | null {
  if (typeof window === "undefined") return null;
  ensureWorkspaceMigrated();
  const raw = sessionStorage.getItem(COMPANY_SESSION_KEY);
  return parseCompaniesBundle(raw);
}

export function listCompaniesInSession(): CompanySession[] {
  return readCompaniesWorkspaceBundle()?.companies ?? [];
}

export function getActiveCompanyFromBundle(): CompanySession | null {
  const bundle = readCompaniesWorkspaceBundle();
  if (!bundle) return null;
  return (
    bundle.companies.find((c) => c.id === bundle.activeCompanyId) ?? null
  );
}

export function setActiveCompanyById(companyId: string): boolean {
  const bundle = readCompaniesWorkspaceBundle();
  if (!bundle || !companyId.trim()) return false;
  const id = companyId.trim();
  if (!bundle.companies.some((c) => c.id === id)) return false;
  writeCompaniesWorkspaceBundle({ ...bundle, activeCompanyId: id });
  return true;
}

/**
 * Remove a company from the bundle and delete its namespaced workspace data on this device.
 * At least one company must remain.
 */
export function removeCompanyFromWorkspace(
  companyId: string,
):
  | { ok: true }
  | { ok: false; error: string } {
  ensureWorkspaceMigrated();
  const id = companyId.trim();
  if (!id) return { ok: false, error: "Invalid company." };
  const bundle = readCompaniesWorkspaceBundle();
  if (!bundle) return { ok: false, error: "No workspace loaded." };
  if (bundle.companies.length <= 1) {
    return {
      ok: false,
      error:
        "You can’t remove your only company. Add another workspace first, or sign out.",
    };
  }
  if (!bundle.companies.some((c) => c.id === id)) {
    return { ok: false, error: "Company not found." };
  }
  clearWorkspaceSessionKeysForCompany(id);
  const companies = bundle.companies.filter((c) => c.id !== id);
  let activeCompanyId = bundle.activeCompanyId;
  if (activeCompanyId === id) {
    activeCompanyId = companies[0]!.id;
  } else if (!companies.some((c) => c.id === activeCompanyId)) {
    activeCompanyId = companies[0]!.id;
  }
  writeCompaniesWorkspaceBundle({ v: 2, companies, activeCompanyId });
  return { ok: true };
}

/**
 * Add a new company row with its own empty workspace keys. Optionally switch to it.
 */
export function appendCompanyToWorkspace(
  data: Omit<CompanySession, "id"> & { id?: string },
  options?: { makeActive?: boolean },
): string {
  ensureWorkspaceMigrated();
  const id =
    data.id?.trim() ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
  const row: CompanySession = { ...data, id };
  const existing = readCompaniesWorkspaceBundle();
  if (!existing) {
    writeCompaniesWorkspaceBundle({
      v: 2,
      companies: [row],
      activeCompanyId: id,
    });
    return id;
  }
  if (existing.companies.some((c) => c.id === id)) {
    return id;
  }
  const makeActive = options?.makeActive === true;
  const next: CompaniesWorkspaceBundle = {
    v: 2,
    companies: [...existing.companies, row],
    activeCompanyId: makeActive ? id : existing.activeCompanyId,
  };
  writeCompaniesWorkspaceBundle(next);
  return id;
}

/**
 * Resolve a join code and append a segregated workspace (empty pipeline/contacts/etc.).
 * When Supabase invite RPCs are set up, codes published by the admin work from any device.
 */
export async function joinCompanyByInviteCode(rawCode: string): Promise<
  | { ok: true; companyId: string }
  | { ok: false; error: string }
> {
  ensureWorkspaceMigrated();
  const entered = normalizeCompanyInviteCode(rawCode);
  if (!entered) {
    return { ok: false, error: "Enter a company code." };
  }
  const bundle = readCompaniesWorkspaceBundle();
  const existing = bundle?.companies ?? [];
  for (const c of existing) {
    if (
      c.company_invite_code &&
      normalizeCompanyInviteCode(c.company_invite_code) === entered
    ) {
      return {
        ok: false,
        error:
          "That company is already in your list. Switch to it from the sidebar.",
      };
    }
  }
  let hit = findInviteByNormalizedCode(entered);
  if (!hit?.companyName?.trim()) {
    hit = await resolveCompanyInviteFromSupabase(entered);
  }
  if (!hit?.companyName?.trim()) {
    return {
      ok: false,
      error: isSupabaseConfigured()
        ? "That code wasn’t found. Ask your admin for the current code. They should open SkAna while signed in once so the code is published to the server."
        : "That code doesn’t match anything on this browser. Ask your admin for the current code from Company settings, or create the company on this computer first so the code is stored here.",
    };
  }
  const profile = parseOnboardingProfile(readOnboardingProfileRaw());
  const id = appendCompanyToWorkspace(
    {
      name: hit.companyName.trim(),
      logoDataUrl: null,
      company_invite_code: hit.code.trim(),
      people: buildWorkspacePeopleFromProfile(profile, undefined),
      credentials: [],
      documents: [],
    },
    { makeActive: false },
  );
  if (typeof window !== "undefined") {
    void import("./workspaceMembersRemote")
      .then((m) =>
        m.registerWorkspaceMembershipForInviteCode(hit.code.trim()),
      )
      .catch(() => {});
  }
  return { ok: true, companyId: id };
}

function parsePeople(raw: unknown): CompanyPerson[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanyPerson[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const role = typeof r.role === "string" ? r.role.trim() : "";
    const emailRaw = typeof r.email === "string" ? r.email.trim() : "";
    if (!id || !name) continue;
    out.push({
      id,
      name,
      role: role || "Member",
      ...(emailRaw ? { email: emailRaw } : {}),
    });
  }
  return out;
}

function parseCredentials(raw: unknown): CompanyCredentialRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanyCredentialRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const value = typeof r.value === "string" ? r.value : "";
    const notesRaw = typeof r.notes === "string" ? r.notes.trim() : "";
    const sensitive = r.sensitive === true;
    if (!id || !label) continue;
    out.push({
      id,
      label,
      value,
      ...(notesRaw ? { notes: notesRaw } : {}),
      ...(sensitive ? { sensitive: true } : {}),
    });
  }
  return out;
}

function parseDocuments(raw: unknown): CompanyDocument[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanyDocument[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const fileName = typeof r.fileName === "string" ? r.fileName.trim() : "";
    const mimeType = typeof r.mimeType === "string" ? r.mimeType.trim() : "";
    const dataUrl = typeof r.dataUrl === "string" ? r.dataUrl : "";
    const uploadedAt = typeof r.uploadedAt === "string" ? r.uploadedAt : "";
    if (!id || !fileName || !mimeType || !dataUrl || !uploadedAt) continue;
    const titleRaw = typeof r.title === "string" ? r.title.trim() : "";
    const title = titleRaw || fileName;
    out.push({ id, title, fileName, mimeType, dataUrl, uploadedAt });
  }
  return out;
}

/** Normalises session JSON (including legacy saves without arrays). */
export function parseCompanySession(raw: string | null): CompanySession | null {
  if (!raw) return null;
  try {
    const fromBundle = parseCompaniesBundle(raw);
    if (fromBundle) {
      return (
        fromBundle.companies.find(
          (c) => c.id === fromBundle.activeCompanyId,
        ) ??
        fromBundle.companies[0] ??
        null
      );
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed.name !== "string") return null;
    const name = parsed.name.trim();
    if (!name) return null;
    const id =
      typeof parsed.id === "string" && parsed.id.trim()
        ? parsed.id.trim()
        : "";
    const logo =
      parsed.logoDataUrl === null
        ? null
        : typeof parsed.logoDataUrl === "string"
          ? parsed.logoDataUrl
          : null;
    return {
      id,
      name,
      logoDataUrl: logo,
      company_number:
        typeof parsed.company_number === "string"
          ? parsed.company_number.trim() || undefined
          : undefined,
      company_address:
        typeof parsed.company_address === "string"
          ? parsed.company_address.trim() || undefined
          : undefined,
      company_role:
        typeof parsed.company_role === "string"
          ? parsed.company_role.trim() || undefined
          : undefined,
      company_invite_code:
        typeof parsed.company_invite_code === "string"
          ? parsed.company_invite_code.trim() || undefined
          : undefined,
      people: parsePeople(parsed.people),
      credentials: parseCredentials(parsed.credentials),
      documents: parseDocuments(parsed.documents),
    };
  } catch {
    return null;
  }
}

export function readCompanySession(): CompanySession | null {
  ensureWorkspaceMigrated();
  return getActiveCompanyFromBundle();
}

export function saveCompanySession(
  data: Omit<CompanySession, "id"> & { id?: string },
): void {
  ensureWorkspaceMigrated();
  const bundle = readCompaniesWorkspaceBundle();
  const fallbackId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const explicitId =
    typeof data.id === "string" && data.id.trim() ? data.id.trim() : "";
  const targetId = explicitId || bundle?.activeCompanyId?.trim() || fallbackId;

  const prev = bundle?.companies.find((c) => c.id === targetId) ?? null;

  const row: CompanySession = {
    id: targetId,
    name: data.name.trim(),
    logoDataUrl:
      data.logoDataUrl !== undefined
        ? data.logoDataUrl
        : prev?.logoDataUrl ?? null,
    company_number:
      data.company_number !== undefined
        ? data.company_number
        : prev?.company_number,
    company_address:
      data.company_address !== undefined
        ? data.company_address
        : prev?.company_address,
    company_role:
      data.company_role !== undefined ? data.company_role : prev?.company_role,
    company_invite_code:
      data.company_invite_code !== undefined
        ? data.company_invite_code
        : prev?.company_invite_code,
    people: data.people ?? prev?.people ?? [],
    credentials: data.credentials ?? prev?.credentials ?? [],
    documents: data.documents ?? prev?.documents ?? [],
  };

  if (!bundle) {
    writeCompaniesWorkspaceBundle({
      v: 2,
      companies: [row],
      activeCompanyId: targetId,
    });
    return;
  }

  const idx = bundle.companies.findIndex((c) => c.id === targetId);
  let companies: CompanySession[];
  let activeCompanyId = bundle.activeCompanyId;
  if (idx >= 0) {
    companies = bundle.companies.map((c) => (c.id === targetId ? row : c));
  } else {
    companies = [...bundle.companies, row];
    activeCompanyId = explicitId ? bundle.activeCompanyId : targetId;
  }
  writeCompaniesWorkspaceBundle({
    v: 2,
    companies,
    activeCompanyId,
  });
}

export const COMPANY_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  co_founder: "Co-founder",
  director: "Director",
  admin: "Administrator",
  member: "Team member",
  other: "Other",
};

export function formatCompanyRole(role: string | undefined): string {
  if (!role) return "—";
  return COMPANY_ROLE_LABELS[role] ?? role;
}

/** Stable id for the person row derived from the signed-in session profile. */
export const WORKSPACE_ACCOUNT_PERSON_ID = "skana_workspace_account";

/** Workspace member list for the current browser session (one row from onboarding profile). */
export function buildWorkspacePeopleFromProfile(
  profile: OnboardingProfile | null,
  companyRole: string | undefined,
): CompanyPerson[] {
  if (!profile) return [];
  const full = `${profile.firstName} ${profile.lastName}`.trim();
  const name = full || profile.email || profile.username;
  if (!name) return [];
  return [
    {
      id: WORKSPACE_ACCOUNT_PERSON_ID,
      name,
      role: companyRole ? formatCompanyRole(companyRole) : "Member",
      ...(profile.email ? { email: profile.email } : {}),
    },
  ];
}

/** Clears demo session keys (use again after Supabase sign-out). */
export function clearSkanaClientSession(): void {
  try {
    const ids = new Set<string>();
    const raw = sessionStorage.getItem(COMPANY_SESSION_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as { v?: unknown; companies?: unknown };
        if (p?.v === 2 && Array.isArray(p.companies)) {
          for (const c of p.companies as { id?: unknown }[]) {
            if (c && typeof c.id === "string" && c.id.trim()) {
              ids.add(c.id.trim());
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    for (const id of ids) {
      for (const base of SESSION_KEYS_NAMESPACED_PER_COMPANY) {
        sessionStorage.removeItem(namespacedSessionKey(base, id));
      }
    }
    for (const base of SESSION_KEYS_NAMESPACED_PER_COMPANY) {
      sessionStorage.removeItem(base);
    }

    sessionStorage.removeItem(COMPANY_SESSION_KEY);
    sessionStorage.removeItem(ONBOARDING_PROFILE_KEY);
    sessionStorage.removeItem("skana_onboarding_email");
    try {
      localStorage.removeItem(COMPANY_INVITE_LOOKUP_KEY);
      localStorage.removeItem(COMPANY_INVITE_REGISTRY_KEY);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(ACTIVE_COMPANY_ID_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

const MAX_LOGO_STORAGE_BYTES = 600_000;

/** Per-file cap for company documents (sessionStorage is limited). */
export const MAX_COMPANY_DOCUMENT_BYTES = 900_000;

export const MAX_COMPANY_DOCUMENTS = 12;

export function fileToDataUrlIfSmall(file: File): Promise<string | null> {
  if (file.size === 0 || file.size > MAX_LOGO_STORAGE_BYTES) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function fileToDataUrlIfUnder(
  file: File,
  maxBytes: number,
): Promise<string | null> {
  if (file.size === 0 || file.size > maxBytes) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
