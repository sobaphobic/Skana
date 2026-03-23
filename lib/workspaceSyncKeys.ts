/** Supabase `workspace_sync_documents.doc_key` — keep in sync with SQL comment. */
export const WORKSPACE_DOC_KEYS = [
  "deals",
  "contacts",
  "calendar",
  "price_list",
  "team_messages",
  "team_messages_read",
  "pipeline_contact_history",
  "company_shared",
] as const;

export type WorkspaceDocKey = (typeof WORKSPACE_DOC_KEYS)[number];

/** sessionStorage base keys — must match *Session.ts modules. */
export const DOC_SESSION_BASE: Record<WorkspaceDocKey, string> = {
  deals: "skana_pipeline_deals",
  contacts: "skana_manual_contacts",
  calendar: "skana_calendar_entries",
  price_list: "skana_price_list",
  team_messages: "skana_team_messages",
  team_messages_read: "skana_team_messages_read",
  pipeline_contact_history: "skana_pipeline_contact_history",
  company_shared: "",
};
