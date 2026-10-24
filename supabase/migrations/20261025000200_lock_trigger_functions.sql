-- Trigger functions run on their own; nobody should reach them through the API.
-- (is_staff, has_perm and current_employee_id stay callable: the access rules run them as the signed-in
-- person, and they only ever answer about that person.)
revoke execute on function
  public.set_updated_at(),
  public.guard_employee(),
  public.link_new_user(),
  public.assign_client_code()
from public, anon, authenticated;
