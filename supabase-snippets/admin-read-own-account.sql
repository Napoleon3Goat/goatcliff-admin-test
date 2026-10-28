-- Lets a logged-in admin read ONLY their own row in admin_accounts,
-- so the admin panel can see their name and role. Nobody can read other admins' rows with this.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create policy "Admins can read their own account"
  on public.admin_accounts
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));
