do $$
declare
  admin_user_id uuid;
begin
  select id
  into admin_user_id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_SHOPKEEPER_EMAIL')
  limit 1;

  if admin_user_id is null then
    raise exception 'Replace the email placeholder with the confirmed shopkeeper Auth email before running this script.';
  end if;

  insert into public.shop_admins (user_id)
  values (admin_user_id)
  on conflict (user_id) do nothing;
end;
$$;
