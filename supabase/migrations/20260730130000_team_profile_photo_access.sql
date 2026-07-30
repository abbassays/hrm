-- Let authenticated colleagues view only the dedicated team-avatar object in
-- the private identity-docs bucket. CNIC files remain covered exclusively by
-- the existing owner/admin policies.
create policy idocs_profile_photo_authenticated
on storage.objects
for select
to authenticated
using (
  bucket_id = 'identity-docs'
  and storage.filename(name) = 'photo'
);
