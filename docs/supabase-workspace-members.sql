-- SkAna: teammates visible across devices (Company → People, team messages, etc.)
-- Run in Supabase → SQL Editor after `supabase-company-invites.sql`.
--
-- Registers each signed-in user under the normalized company invite code so others
-- can list them. Data is minimal (name, email, role).

CREATE TABLE IF NOT EXISTS public.company_workspace_members (
  workspace_code_norm text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text,
  role text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_code_norm, user_id)
);

CREATE INDEX IF NOT EXISTS company_workspace_members_workspace_idx
  ON public.company_workspace_members (workspace_code_norm);

ALTER TABLE public.company_workspace_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_workspace_members FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.upsert_workspace_member(
  p_workspace_code text,
  p_display_name text,
  p_email text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  n := upper(regexp_replace(p_workspace_code, '[^A-Z0-9]', '', 'gi'));
  IF n = '' THEN
    RAISE EXCEPTION 'Invalid workspace code';
  END IF;
  INSERT INTO public.company_workspace_members (
    workspace_code_norm,
    user_id,
    display_name,
    email,
    role,
    updated_at
  )
  VALUES (
    n,
    auth.uid(),
    left(trim(coalesce(p_display_name, '')), 200),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(left(trim(coalesce(p_role, '')), 120), ''),
    now()
  )
  ON CONFLICT (workspace_code_norm, user_id) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.list_workspace_members(p_workspace_code text)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  role text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.user_id,
    m.display_name,
    m.email,
    m.role,
    m.updated_at
  FROM public.company_workspace_members m
  WHERE m.workspace_code_norm = upper(regexp_replace(p_workspace_code, '[^A-Z0-9]', '', 'gi'))
  ORDER BY m.display_name;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_workspace_member(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_members(text) TO authenticated;
