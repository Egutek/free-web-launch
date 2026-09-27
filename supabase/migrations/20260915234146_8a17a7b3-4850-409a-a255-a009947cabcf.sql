CREATE TABLE public.operators (
  id text PRIMARY KEY,
  name text NOT NULL,
  machine_type text NOT NULL DEFAULT 'LL',
  department_id text NOT NULL DEFAULT 'unassigned',
  is_vna_only boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  shift text NOT NULL DEFAULT 'A',
  absence_reason text,
  notes text,
  last_moved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to operators" ON public.operators FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.move_history (
  id text PRIMARY KEY,
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  machine_type text NOT NULL DEFAULT 'LL',
  from_dept text NOT NULL,
  to_dept text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  shift text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.move_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.move_history TO authenticated;
GRANT ALL ON public.move_history TO service_role;
ALTER TABLE public.move_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to move_history" ON public.move_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX move_history_timestamp_idx ON public.move_history (timestamp DESC);

CREATE TABLE public.shift_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_built_in boolean NOT NULL DEFAULT false,
  operator_count integer NOT NULL DEFAULT 0,
  active_count integer NOT NULL DEFAULT 0,
  shift text,
  assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_templates TO authenticated;
GRANT ALL ON public.shift_templates TO service_role;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to shift_templates" ON public.shift_templates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.custom_departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'slate',
  badge_bg text NOT NULL DEFAULT '',
  badge_text text NOT NULL DEFAULT '',
  border_color text NOT NULL DEFAULT '',
  icon_name text NOT NULL DEFAULT 'Boxes',
  target_count integer NOT NULL DEFAULT 0,
  shift text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_departments TO authenticated;
GRANT ALL ON public.custom_departments TO service_role;
ALTER TABLE public.custom_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to custom_departments" ON public.custom_departments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shift_templates_updated_at BEFORE UPDATE ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custom_departments_updated_at BEFORE UPDATE ON public.custom_departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.operators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.move_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_departments;
ALTER TABLE public.operators REPLICA IDENTITY FULL;
ALTER TABLE public.move_history REPLICA IDENTITY FULL;
ALTER TABLE public.shift_templates REPLICA IDENTITY FULL;
ALTER TABLE public.custom_departments REPLICA IDENTITY FULL;

INSERT INTO public.operators (id, name, machine_type, department_id, status, shift, notes) VALUES
('op-1','Andrii Gurkot','LL','hovc','active','A','Příjem palet'),('op-2','Barnóky Roman','RTR','hovc','active','A','Příjem a kontrola'),('op-3','Bereš Zbyněk','LL','hovc','active','A',NULL),('op-4','Bogár Alexander','RTR','hovc','active','A',NULL),('op-5','BOHDAN BAIOV','LL','hovc','active','A',NULL),('op-6','Burget David','LL','hovc','active','A',NULL),('op-7','Červeňák Michael','RTR','hovc','active','A',NULL),('op-8','Daduč Imrich','LL','hovc','active','A',NULL),('op-9','Daniel Šír','RTR','hovc','active','A',NULL),('op-10','DAVID SVOBODA','LL','hovc','active','A',NULL),('op-11','DEMIANETS D.','RTR','hovs','active','A','Regálový sklad'),('op-12','Faber Dominik','LL','hovs','active','A',NULL),('op-13','Fiala Ladislav','RTR','hovs','active','A',NULL),('op-14','Gajdoš Slavomír','LL','hovs','active','A',NULL),('op-15','Györke Ladislav','RTR','hovs','active','A',NULL),('op-16','Halimov Oleh','LL','hovs','active','A',NULL),('op-17','Havel Zdeněk','RTR','hovs','active','A',NULL),('op-18','Hemzáček Lukáš (TL)','RTR','hovs','active','A','Team Leader (TL)'),('op-19','Horváth Valentin','LL','hovs','active','A',NULL),('op-20','Hosszu Radek','RTR','hovs','active','A',NULL),('op-21','Hřava Dominik','LL','putaway','active','A','Zaskladnění'),('op-22','Chrastina Atilla','RTR','putaway','active','A',NULL),('op-23','IHOR Pozniak','LL','putaway','active','A',NULL),('op-24','IHOR Savchenko','RTR','putaway','active','A',NULL),('op-25','JAKUB PFREIMER','LL','putaway','active','A',NULL),('op-26','JAKUB SKÁLA','RTR','putaway','active','A',NULL),('op-27','Jiří Nečas','LL','putaway','active','A',NULL),('op-28','Jiří Teplý (SV)','RTR','putaway','active','A','Supervisor (SV)'),('op-29','Jiří Vašíček','LL','putaway','active','A',NULL),('op-30','Josef Bartko','RTR','putaway','active','A',NULL),('op-31','Kateřina Novotná','LL','vas','active','A','Kitting & balení'),('op-32','Kochut Yurii','LL','vas','active','A',NULL),('op-33','Kovalchuk O.','RTR','vas','active','A',NULL),('op-34','Kryvoruchko Daria','LL','vas','active','A',NULL),('op-35','Kurcius David','RTR','vas','active','A',NULL),('op-36','Máca Filip','LL','vas','active','A',NULL),('op-37','Martin Mazánek','LL','vas','active','A',NULL),('op-38','Martin Vlček','RTR','vas','active','A',NULL),('op-39','Merzliakov O. (Alex)','LL','vas','active','A',NULL),('op-40','Mika Dominik','RTR','vas','active','A',NULL),('op-41','Miroslav Havlík','RTR','obwf','active','A','Expedice Waterfront'),('op-42','Miroslav Kónya','LL','obwf','active','A',NULL),('op-43','Mrhal Aleš','RTR','obwf','active','A',NULL),('op-44','Müller Jan','LL','obwf','active','A',NULL),('op-45','Mykhailchuk M.','RTR','obwf','active','A',NULL),('op-46','Nováček M.','LL','obwf','active','A',NULL),('op-47','Pacelt Jakub','RTR','obwf','active','A',NULL),('op-48','Pavelka Vojtěch','LL','obwf','active','A',NULL),('op-49','Petrus Oleksandr','RTR','obwf','active','A',NULL),('op-50','Popelář Hynek','RTR','vna','active','A','Úzké uličky VNA'),('op-51','Pukančík Ota (TL)','RTR','vna','active','A','Team Leader (TL)'),('op-52','Robert Trapl','RTR','vna','active','A',NULL),('op-53','Sebastian Čermák','RTR','vna','active','A',NULL),('op-54','SIDEI BOGDAN','RTR','vna','active','A',NULL),('op-55','Simona Pyttlová','RTR','vna','active','A',NULL),('op-56','Sivák David','RTR','vna','active','A',NULL),('op-57','Sivák R.','RTR','vna','active','A',NULL),('op-58','Sovadina Václav','LL','obwi','active','A','Zásilkový & web pick'),('op-59','Šándor Milan','RTR','obwi','active','A',NULL),('op-60','Tomáš Bartoš','LL','obwi','active','A',NULL),('op-61','TONDA HORÁK','RTR','obwi','active','A',NULL),('op-62','Velat Petr','LL','obwi','active','A',NULL),('op-63','VITALII SAVCHENKO','RTR','obwi','active','A',NULL),('op-64','Vít Varga','LL','obwi','active','A',NULL),('op-65','Vojtěch Hodl','RTR','obwi','active','A',NULL),
('op-b-1','Petr Dvořák','LL','hovc','active','B',NULL),('op-b-2','Martin Černý','RTR','hovc','active','B',NULL),('op-b-3','Tomáš Procházka','LL','hovc','active','B',NULL),('op-b-4','Jiří Kučera','RTR','hovc','active','B',NULL),('op-b-5','Michal Veselý','LL','hovc','active','B',NULL),('op-b-6','Jakub Horák','LL','hovc','active','B',NULL),('op-b-7','Jan Němec','RTR','hovc','active','B',NULL),('op-b-8','Lukáš Marek','LL','hovc','active','B',NULL),('op-b-9','David Pokorný','RTR','hovc','active','B',NULL),('op-b-10','Filip Pospíšil','LL','hovc','active','B',NULL),('op-b-11','Martin Hájek','RTR','hovs','active','B',NULL),('op-b-12','Václav Král','LL','hovs','active','B',NULL),('op-b-13','Tomáš Jelínek','RTR','hovs','active','B',NULL),('op-b-14','Zdeněk Růžička','LL','hovs','active','B',NULL),('op-b-15','Jan Beneš','RTR','hovs','active','B',NULL),('op-b-16','Karel Fiala','LL','hovs','active','B',NULL),('op-b-17','Ondřej Sedláček','RTR','hovs','active','B',NULL),('op-b-18','Roman Zeman','RTR','hovs','active','B','Team leader HOVS'),('op-b-19','Michal Kolář','LL','hovs','active','B',NULL),('op-b-20','Tomáš Navrátil','RTR','hovs','active','B',NULL),('op-b-21','Milan Čermák','LL','putaway','active','B',NULL),('op-b-22','Libor Vaněk','RTR','putaway','active','B',NULL),('op-b-23','Aleš Urban','LL','putaway','active','B',NULL),('op-b-24','Radim Blažek','RTR','putaway','active','B',NULL),('op-b-25','Vladimír Kříž','LL','putaway','active','B',NULL),('op-b-26','Daniel Kratochvíl','RTR','putaway','active','B',NULL),('op-b-27','Stanislav Kovář','LL','putaway','active','B',NULL),('op-b-28','Viktor Bartoš','RTR','putaway','active','B','Putaway koordinátor'),('op-b-29','Boris Vlček','LL','putaway','active','B',NULL),('op-b-30','Emil Holub','RTR','putaway','active','B',NULL),('op-b-31','Simona Dvořáková','LL','vas','active','B',NULL),('op-b-32','Monika Novotná','LL','vas','active','B',NULL),('op-b-33','Igor Štěpánek','RTR','vas','active','B',NULL),('op-b-34','Lucie Procházková','LL','vas','active','B',NULL),('op-b-35','René Kopecký','RTR','vas','active','B',NULL),('op-b-36','Patrik Šmíd','LL','vas','active','B',NULL),('op-b-37','Richard Beran','LL','vas','active','B',NULL),('op-b-38','Erik Tichý','RTR','vas','active','B',NULL),('op-b-39','Tereza Králová','LL','vas','active','B',NULL),('op-b-40','Robert Richter','RTR','obwf','active','B',NULL),('op-b-41','Marian Soukup','LL','obwf','active','B',NULL),('op-b-42','Vladislav Dušek','RTR','obwf','active','B',NULL),('op-b-43','Kamil Janda','LL','obwf','active','B',NULL),('op-b-44','Norbert Vávra','RTR','obwf','active','B',NULL),('op-b-45','Alexej Hruška','LL','obwf','active','B',NULL),('op-b-46','Denis Matoušek','RTR','obwf','active','B',NULL),('op-b-47','Ivan Polák','LL','obwf','active','B',NULL),('op-b-48','Eduard Štěrba','RTR','vna','active','B',NULL),('op-b-49','Gabriel Tesař','RTR','vna','active','B','Team leader VNA'),('op-b-50','Igor Moravec','RTR','vna','active','B',NULL),('op-b-51','Marcel Švec','RTR','vna','active','B',NULL),('op-b-52','Oliver Bárta','RTR','vna','active','B',NULL),('op-b-53','Sebastian Liška','RTR','vna','active','B',NULL),('op-b-54','Tadeáš Mach','RTR','vna','active','B',NULL),('op-b-55','Adrian Sýkora','LL','obwi','active','B',NULL),('op-b-56','Bohumil Vlasák','RTR','obwi','active','B',NULL),('op-b-57','Cyril Trojan','LL','obwi','active','B',NULL),('op-b-58','Dalibor Pešek','RTR','obwi','active','B',NULL),('op-b-59','František Říha','LL','obwi','active','B',NULL),('op-b-60','Gustav Zoubek','RTR','obwi','active','B',NULL),
('op-c-1','Jan Kováč','LL','hovc','active','C',NULL),('op-c-2','Petr Řezníček','RTR','hovc','active','C',NULL),('op-c-3','Martin Šulc','LL','hovc','active','C',NULL),('op-c-4','Tomáš Malý','RTR','hovc','active','C',NULL),('op-c-5','Michal Holý','LL','hovc','active','C',NULL),('op-c-6','Jakub Vydra','LL','hovc','active','C',NULL),('op-c-7','Lukáš Trojan','RTR','hovc','active','C',NULL),('op-c-8','David Sova','LL','hovc','active','C',NULL),('op-c-9','Filip Kohout','RTR','hovc','active','C',NULL),('op-c-10','Zdeněk Strnad','LL','hovc','active','C',NULL),('op-c-11','Václav Vlach','RTR','hovs','active','C',NULL),('op-c-12','Ondřej Klement','LL','hovs','active','C',NULL),('op-c-13','Roman Kvapil','RTR','hovs','active','C',NULL),('op-c-14','Aleš Macháček','LL','hovs','active','C',NULL),('op-c-15','Libor Pavlík','RTR','hovs','active','C',NULL),('op-c-16','Radim Votava','LL','hovs','active','C',NULL),('op-c-17','Viktor Chovanec','RTR','hovs','active','C',NULL),('op-c-18','Jan Vopálka','RTR','hovs','active','C','Team leader HOVS'),('op-c-19','Milan Trnka','LL','hovs','active','C',NULL),('op-c-20','Stanislav Pecha','RTR','hovs','active','C',NULL),('op-c-21','Daniel Klíma','LL','putaway','active','C',NULL),('op-c-22','Boris Heřman','RTR','putaway','active','C',NULL),('op-c-23','Emil Janeček','LL','putaway','active','C',NULL),('op-c-24','René Brož','RTR','putaway','active','C',NULL),('op-c-25','Patrik Lorenc','LL','putaway','active','C',NULL),('op-c-26','Richard Doubek','RTR','putaway','active','C',NULL),('op-c-27','Erik Šebesta','LL','putaway','active','C',NULL),('op-c-28','Robert Sláma','RTR','putaway','active','C','Putaway koordinátor'),('op-c-29','Marian Kubát','LL','putaway','active','C',NULL),('op-c-30','Vladislav Hladík','RTR','putaway','active','C',NULL),('op-c-31','Alena Černá','LL','vas','active','C',NULL),('op-c-32','Petra Veselá','LL','vas','active','C',NULL),('op-c-33','Kamil Vrzal','RTR','vas','active','C',NULL),('op-c-34','Jana Horáková','LL','vas','active','C',NULL),('op-c-35','Norbert Šťastný','RTR','vas','active','C',NULL),('op-c-36','Alexej Vít','LL','vas','active','C',NULL),('op-c-37','Denis Šrajer','LL','vas','active','C',NULL),('op-c-38','Ivan Šmarda','RTR','vas','active','C',NULL),('op-c-39','Věra Benešová','LL','vas','active','C',NULL),('op-c-40','Eduard Zouhar','RTR','obwf','active','C',NULL),('op-c-41','Gabriel Vodička','LL','obwf','active','C',NULL),('op-c-42','Igor Pelikán','RTR','obwf','active','C',NULL),('op-c-43','Marcel Šrámek','LL','obwf','active','C',NULL),('op-c-44','Oliver Vlk','RTR','obwf','active','C',NULL),('op-c-45','Sebastian Hanzl','LL','obwf','active','C',NULL),('op-c-46','Tadeáš Kroupa','RTR','obwf','active','C',NULL),('op-c-47','Adrian Louda','LL','obwf','active','C',NULL),('op-c-48','Bohumil Zítko','RTR','vna','active','C',NULL),('op-c-49','Cyril Hrdlička','RTR','vna','active','C','Team leader VNA'),('op-c-50','Dalibor Šmíd','RTR','vna','active','C',NULL),('op-c-51','František Žák','RTR','vna','active','C',NULL),('op-c-52','Gustav Cibulka','RTR','vna','active','C',NULL),('op-c-53','Hynek Křížek','RTR','vna','active','C',NULL),('op-c-54','Jan Veverka','RTR','vna','active','C',NULL),('op-c-55','Karel Vacek','LL','obwi','active','C',NULL),('op-c-56','Luboš Valenta','RTR','obwi','active','C',NULL),('op-c-57','Matěj Vrbka','LL','obwi','active','C',NULL),('op-c-58','Nikolas Zima','RTR','obwi','active','C',NULL),('op-c-59','Otakar Bednář','LL','obwi','active','C',NULL),('op-c-60','Pavel Horký','RTR','obwi','active','C',NULL)
ON CONFLICT (id) DO NOTHING;