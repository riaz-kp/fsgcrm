-- What the firm starts with: the team and the built-in scopes of work. No clients or sample figures.
--
-- Emails are left empty: a person can sign up only once their email is set here or in Team. Set the
-- first head's email from the SQL editor, for example
--   update public.employees set email = 'vijeesh@example.com' where id = 'e-vijeesh';
-- then they sign up and add everyone else's from the Team page.

grant usage on all sequences in schema public to authenticated;

insert into public.employees (id, name, title, role, hue, responsibilities, reports_to, permissions) values
  ('e-vijeesh', 'Vijeesh', 'CEO', 'ceo', 212, array['Audit head', 'TDS filing', 'IT filing'], null, null),
  ('e-praveen', 'Praveen', 'Operations Head', 'head', 262, array['Operations', 'Audit head', 'Task allocation'], 'e-vijeesh', null),
  ('e-anna', 'Anna', 'GST Filing Head', 'head', 332, array['GST filing', 'MSME registration', 'LLP incorporation', 'Company nil audit'], 'e-praveen', null),
  ('e-husni', 'Husni', 'Trainee', 'trainee', 24, array['Book keeping'], 'e-anna', null),
  ('e-henna', 'Henna', 'Trainee', 'trainee', 162, array['GST registration'], 'e-anna', null),
  ('e-afna', 'Afna', 'Trainee', 'trainee', 292, array['DSC'], 'e-anna', null),
  ('e-harikrishna', 'Harikrishna', 'Trainee', 'trainee', 190, array['GST filing'], 'e-anna', null),
  ('e-ramees', 'Ramees', 'Trainee', 'trainee', 46, array['GST filing'], 'e-anna', null),
  -- Handles enquiries, not filings, so she starts without access to portal passwords.
  ('e-shani', 'Shani', 'Trainee', 'trainee', 348, array['Client lead management'], 'e-praveen', array['edit_clients', 'view_fees'])
on conflict (id) do nothing;

-- Mirrors BUILTIN_SCOPES in src/lib/meta.ts.
insert into public.scopes (key, label, short, scope_group, tracker, detail_hint, builtin) values
  ('gst_registration', 'GST registration', 'GST Reg', 'GST', 'services', null, true),
  ('gst_filing', 'GST filing', 'GST', 'GST', 'gst', null, true),
  ('annual_return', 'Annual return', 'Annual', 'GST', 'gst', null, true),
  ('eway', 'E-way bill', 'E-way', 'GST', 'gst', null, true),
  ('it_non_audit', 'IT · non-audit case', 'IT', 'Income tax & audit', 'it', null, true),
  ('it_audit', 'IT · audit case', 'IT Audit', 'Income tax & audit', 'it', null, true),
  ('internal_audit', 'Internal audit', 'Int. Audit', 'Income tax & audit', 'audit', null, true),
  ('tds', 'TDS', 'TDS', 'Payroll & TDS', 'tds', null, true),
  ('pf', 'PF', 'PF', 'Payroll & TDS', null, null, true),
  ('esi', 'ESI', 'ESI', 'Payroll & TDS', null, null, true),
  ('incorporation', 'Incorporation / formation', 'Incorp', 'One-time', 'services', null, true),
  ('project_report', 'Project report', 'Proj. Report', 'One-time', null, null, true),
  ('legal_metrology', 'Legal metrology', 'Legal Met.', 'One-time', 'services', null, true),
  ('certification', 'Certifications', 'Cert.', 'One-time', 'services', 'Which certificate? e.g. ISO 9001 renewal', true),
  ('tan_application', 'TAN application', 'TAN', 'One-time', 'services', null, true),
  ('pan_application', 'PAN application', 'PAN', 'One-time', 'services', null, true),
  ('other', 'Other', 'Other', 'One-time', 'services', 'What is the work?', true)
on conflict (key) do nothing;
