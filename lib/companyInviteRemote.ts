import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser-client";

const PUBLISH_THROTTLE_KEY = "skana_last_invite_publish_at";
const PUBLISH_THROTTLE_MS = 60_000;

type CompanyInvitePublishRow = {
  company_invite_code?: string;
  name: string;
};

type InviteHit = {
  code: string;
  companyName: string;
  companyId: string;
};

/**
 * After any workspace save, publish invite codes so teammates can join from other devices.
 * No-op if Supabase isn’t configured or the user isn’t signed in.
 */
export function schedulePublishCompanyInvitesToSupabase(
  companies: CompanyInvitePublishRow[],
): void {
  if (typeof window === "undefined") return;
  void publishCompanyInvitesToSupabase(companies).catch(() => {
    /* network / RPC missing — local invites still work on this device */
  });
}

/**
 * Throttled publish when the workspace bundle is loaded (so admins pick up cloud invites
 * without editing a company). At most once per minute per tab.
 */
export function schedulePublishCompanyInvitesIfStale(
  companies: CompanyInvitePublishRow[],
): void {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return;
  try {
    const raw = sessionStorage.getItem(PUBLISH_THROTTLE_KEY);
    const last = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(last) && Date.now() - last < PUBLISH_THROTTLE_MS) {
      return;
    }
    sessionStorage.setItem(PUBLISH_THROTTLE_KEY, String(Date.now()));
  } catch {
    return;
  }
  schedulePublishCompanyInvitesToSupabase(companies);
}

async function publishCompanyInvitesToSupabase(
  companies: CompanyInvitePublishRow[],
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  for (const c of companies) {
    const code = c.company_invite_code?.trim();
    const name = c.name?.trim();
    if (!code || !name) continue;
    const { error } = await supabase.rpc("publish_company_invite", {
      p_code: code,
      p_company_name: name,
    });
    if (error) {
      console.warn("[SkAna] publish_company_invite", error.message);
    }
  }
}

/** Remove a code from the shared registry (e.g. after regenerate). */
export function scheduleRetireCompanyInviteOnSupabase(code: string): void {
  if (typeof window === "undefined" || !code.trim()) return;
  void retireCompanyInviteOnSupabase(code.trim()).catch(() => {});
}

async function retireCompanyInviteOnSupabase(code: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.rpc("retire_company_invite", { p_code: code });
}

/**
 * Look up a normalized invite code in Supabase (works for any signed-in or anon client).
 */
export async function resolveCompanyInviteFromSupabase(
  normalizedCode: string,
): Promise<InviteHit | null> {
  if (!normalizedCode || !isSupabaseConfigured()) return null;
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("resolve_company_invite", {
    p_code: normalizedCode,
  });

  if (error) {
    console.warn("[SkAna] resolve_company_invite", error.message);
    return null;
  }

  const rows = data as
    | { company_name: string; invite_code_display: string }[]
    | null;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (
    !row ||
    typeof row.company_name !== "string" ||
    !row.company_name.trim()
  ) {
    return null;
  }

  const display =
    typeof row.invite_code_display === "string" && row.invite_code_display.trim()
      ? row.invite_code_display.trim()
      : normalizedCode;

  return {
    code: display,
    companyName: row.company_name.trim(),
    companyId: "",
  };
}
