-- SkAna: shared company invite codes (cross-device join)
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- After this, the app publishes codes when a signed-in user saves their workspace,
-- and anyone can resolve a code via RPC to join from another browser.

CREATE TABLE IF NOT EXISTS public.company_invites (
  code_norm text PRIMARY KEY,
  invite_code_display text NOT NULL,
  company_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_invites_created_by_idx
  ON public.company_invites (created_by);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_invites FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.resolve_company_invite(p_code text)
RETURNS TABLE (company_name text, invite_code_display text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ci.company_name, ci.invite_code_display
  FROM public.company_invites ci
  WHERE ci.code_norm = upper(regexp_replace(p_code, '[^A-Z0-9]', '', 'gi'));
$$;

CREATE OR REPLACE FUNCTION public.publish_company_invite(
  p_code text,
  p_company_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text;
  display text;
  name_trim text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  n := upper(regexp_replace(p_code, '[^A-Z0-9]', '', 'gi'));
  display := trim(p_code);
  name_trim := trim(p_company_name);
  IF n = '' OR name_trim = '' OR display = '' THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  INSERT INTO public.company_invites (
    code_norm,
    invite_code_display,
    company_name,
    created_by
  )
  VALUES (n, display, name_trim, auth.uid())
  ON CONFLICT (code_norm) DO UPDATE
  SET
    company_name = EXCLUDED.company_name,
    invite_code_display = EXCLUDED.invite_code_display,
    updated_at = now()
  WHERE company_invites.created_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_company_invite(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  n := upper(regexp_replace(p_code, '[^A-Z0-9]', '', 'gi'));
  IF n = '' THEN
    RETURN;
  END IF;
  DELETE FROM public.company_invites
  WHERE code_norm = n AND created_by = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_company_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_company_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_company_invite(text) TO authenticated;
