-- Create reusable function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create law types table
CREATE TABLE public.law_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create lawyers table
CREATE TABLE public.lawyers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  bio text,
  image_url text,
  years_experience integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create junction table for lawyer specialties
CREATE TABLE public.lawyer_specialties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lawyer_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  law_type_id uuid NOT NULL REFERENCES public.law_types(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(lawyer_id, law_type_id)
);

-- Enable RLS
ALTER TABLE public.law_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_specialties ENABLE ROW LEVEL SECURITY;

-- Public read access for directory browsing
CREATE POLICY "Anyone can view law types"
  ON public.law_types
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view lawyers"
  ON public.lawyers
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view lawyer specialties"
  ON public.lawyer_specialties
  FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_lawyers_updated_at
  BEFORE UPDATE ON public.lawyers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample law types
INSERT INTO public.law_types (name, description) VALUES
  ('Family Law', 'Divorce, custody, adoption, and domestic matters'),
  ('Criminal Defense', 'Representation in criminal cases and investigations'),
  ('Real Estate', 'Property transactions, landlord-tenant disputes'),
  ('Personal Injury', 'Accidents, medical malpractice, wrongful death'),
  ('Business Law', 'Contracts, corporate formation, commercial disputes'),
  ('Immigration', 'Visa applications, citizenship, deportation defense'),
  ('Employment Law', 'Workplace disputes, discrimination, wrongful termination'),
  ('Estate Planning', 'Wills, trusts, probate, and inheritance matters');

-- Insert sample lawyers
INSERT INTO public.lawyers (name, email, phone, bio, years_experience) VALUES
  ('Sarah Johnson', 'sarah.johnson@lawfirm.com', '555-0101', 'Experienced family law attorney specializing in custody and divorce cases.', 15),
  ('Michael Chen', 'michael.chen@lawfirm.com', '555-0102', 'Criminal defense lawyer with a track record of successful cases.', 12),
  ('Emily Rodriguez', 'emily.rodriguez@lawfirm.com', '555-0103', 'Real estate attorney handling residential and commercial transactions.', 8),
  ('David Thompson', 'david.thompson@lawfirm.com', '555-0104', 'Personal injury lawyer dedicated to securing fair compensation.', 20),
  ('Jennifer Lee', 'jennifer.lee@lawfirm.com', '555-0105', 'Business law specialist helping startups and established companies.', 10);

-- Link lawyers to their specialties
INSERT INTO public.lawyer_specialties (lawyer_id, law_type_id)
SELECT l.id, lt.id
FROM public.lawyers l
CROSS JOIN public.law_types lt
WHERE 
  (l.name = 'Sarah Johnson' AND lt.name IN ('Family Law', 'Estate Planning')) OR
  (l.name = 'Michael Chen' AND lt.name = 'Criminal Defense') OR
  (l.name = 'Emily Rodriguez' AND lt.name IN ('Real Estate', 'Business Law')) OR
  (l.name = 'David Thompson' AND lt.name = 'Personal Injury') OR
  (l.name = 'Jennifer Lee' AND lt.name IN ('Business Law', 'Employment Law'));