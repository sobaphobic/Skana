-- SkAna: shared workspace data (deals, contacts, calendar/tasks, messages, etc.)
-- Run in Supabase → SQL Editor after `supabase-workspace-members.sql`.
--
-- One JSON document per domain per company invite code (normalized). RLS: only users
-- listed in `company_workspace_members` for that code can read/write.

CREATE TABLE IF NOT EXISTS public.workspace_sync_documents (
  workspace_code_norm text NOT NULL,
  doc_key text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_code_norm, doc_key)
);

CREATE INDEX IF NOT EXISTS workspace_sync_documents_updated_idx
  ON public.workspace_sync_documents (workspace_code_norm, updated_at DESC);

ALTER TABLE public.workspace_sync_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_sync_documents FROM PUBLIC;

CREATE POLICY "workspace_sync_select_members"
  ON public.workspace_sync_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_workspace_members m
      WHERE m.workspace_code_norm = workspace_sync_documents.workspace_code_norm
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_sync_insert_members"
  ON public.workspace_sync_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_workspace_members m
      WHERE m.workspace_code_norm = workspace_sync_documents.workspace_code_norm
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_sync_update_members"
  ON public.workspace_sync_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_workspace_members m
      WHERE m.workspace_code_norm = workspace_sync_documents.workspace_code_norm
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_workspace_members m
      WHERE m.workspace_code_norm = workspace_sync_documents.workspace_code_norm
        AND m.user_id = auth.uid()
    )
  );

-- Allowed doc_key values (enforced in app): deals, contacts, calendar, price_list,
-- team_messages, team_messages_read, pipeline_contact_history, company_shared

GRANT SELECT, INSERT, UPDATE ON public.workspace_sync_documents TO authenticated;
