CREATE TABLE public.nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  score SMALLINT NOT NULL CHECK (score >= 0 AND score <= 10),
  atendimento TEXT NOT NULL,
  servicos TEXT NOT NULL,
  novidades TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.nps_responses TO anon;
GRANT SELECT, INSERT ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a response"
  ON public.nps_responses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Signed in team can read responses"
  ON public.nps_responses FOR SELECT TO authenticated USING (true);