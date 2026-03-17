-- Create the extractions bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit)
values ('extractions', 'extractions', false, 20971520)
on conflict (id) do nothing;

-- INSERT: upload (auth)
create policy "Users can upload extraction files"
on storage.objects for insert to authenticated
with check (bucket_id = 'extractions');

-- SELECT: read for signed URLs
create policy "Users can read extraction files"
on storage.objects for select to authenticated
using (bucket_id = 'extractions');

-- UPDATE: overwrite existing file (upsert when same path is uploaded again)
create policy "Users can update extraction files"
on storage.objects for update to authenticated
using (bucket_id = 'extractions')
with check (bucket_id = 'extractions');

-- DELETE: client cleanup after processing
create policy "Users can delete extraction files"
on storage.objects for delete to authenticated
using (bucket_id = 'extractions');

-- DELETE: edge function cleanup
create policy "Service role can delete extraction files"
on storage.objects for delete to service_role
using (bucket_id = 'extractions');
