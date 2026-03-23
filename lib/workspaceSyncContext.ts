/**
 * Workspace sync context without importing skanaSession (avoids circular imports).
 */

import {
  getEffectiveWorkspaceId,
  namespacedSessionKey,
} from "./workspaceScope";
import type { WorkspaceDocKey } from "./workspaceSyncKeys";
import { DOC_SESSION_BASE } from "./workspaceSyncKeys";

const BUNDLE_KEY = "skana_company_profile";

function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

type BundleCompany = {
  id: string;
  company_invite_code?: string;
  name: string;
  logoDataUrl: string | null;
  company_number?: string;
  company_address?: string;
  company_role?: string;
  people?: unknown;
  credentials?: unknown;
  documents?: unknown;
};

function parseBundleCompanies(raw: string | null): {
  activeCompanyId: string;
  companies: BundleCompany[];
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.v !== 2 || !Array.isArray(parsed.companies)) return null;
    const activeCompanyId =
      typeof parsed.activeCompanyId === "string"
        ? parsed.activeCompanyId.trim()
        : "";
    if (!activeCompanyId) return null;
    const companies: BundleCompany[] = [];
    for (const row of parsed.companies) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!id || !name) continue;
      companies.push({
        id,
        name,
        logoDataUrl:
          r.logoDataUrl === null
            ? null
            : typeof r.logoDataUrl === "string"
              ? r.logoDataUrl
              : null,
        company_number:
          typeof r.company_number === "string"
            ? r.company_number.trim() || undefined
            : undefined,
        company_address:
          typeof r.company_address === "string"
            ? r.company_address.trim() || undefined
            : undefined,
        company_role:
          typeof r.company_role === "string"
            ? r.company_role.trim() || undefined
            : undefined,
        company_invite_code:
          typeof r.company_invite_code === "string"
            ? r.company_invite_code.trim() || undefined
            : undefined,
        people: r.people,
        credentials: r.credentials,
        documents: r.documents,
      });
    }
    if (companies.length === 0) return null;
    return { activeCompanyId, companies };
  } catch {
    return null;
  }
}

export function getWorkspaceCodeNormForActiveCompany(): string | null {
  if (typeof window === "undefined") return null;
  const wid = getEffectiveWorkspaceId();
  if (!wid) return null;
  try {
    const raw = sessionStorage.getItem(BUNDLE_KEY);
    const parsed = parseBundleCompanies(raw);
    if (!parsed) return null;
    const c = parsed.companies.find((x) => x.id === wid);
    const code = c?.company_invite_code?.trim();
    if (!code) return null;
    const norm = normalizeInviteCode(code);
    return norm || null;
  } catch {
    return null;
  }
}

export function getWorkspaceSyncMetaKey(codeNorm: string): string {
  return `skana_workspace_sync_meta__${codeNorm}`;
}

export function readWorkspaceSyncDocTimestamps(
  codeNorm: string,
): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(getWorkspaceSyncMetaKey(codeNorm));
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function writeWorkspaceSyncDocTimestamp(
  codeNorm: string,
  docKey: string,
  iso: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const key = getWorkspaceSyncMetaKey(codeNorm);
    const prev = readWorkspaceSyncDocTimestamps(codeNorm);
    prev[docKey] = iso;
    sessionStorage.setItem(key, JSON.stringify(prev));
  } catch {
    /* quota */
  }
}

/**
 * Serializable company row for `company_shared` (no local id — merge by invite code).
 */
export function getActiveCompanySharedPayloadForSync(): Record<
  string,
  unknown
> | null {
  if (typeof window === "undefined") return null;
  const wid = getEffectiveWorkspaceId();
  if (!wid) return null;
  const parsed = parseBundleCompanies(sessionStorage.getItem(BUNDLE_KEY));
  if (!parsed) return null;
  const c = parsed.companies.find((x) => x.id === wid);
  if (!c?.company_invite_code?.trim()) return null;
  return {
    name: c.name,
    logoDataUrl: c.logoDataUrl,
    company_number: c.company_number,
    company_address: c.company_address,
    company_role: c.company_role,
    company_invite_code: c.company_invite_code.trim(),
    people: c.people ?? [],
    credentials: c.credentials ?? [],
    documents: c.documents ?? [],
  };
}

export function namespacedKeyForDoc(
  docKey: WorkspaceDocKey,
  localCompanyId: string,
): string | null {
  const base = DOC_SESSION_BASE[docKey];
  if (!base) return null;
  return namespacedSessionKey(base, localCompanyId);
}
