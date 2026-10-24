-- can_manage_logins only ever answers about the signed-in person; nobody signed out needs it.
revoke execute on function public.can_manage_logins() from public, anon;
grant execute on function public.can_manage_logins() to authenticated;
