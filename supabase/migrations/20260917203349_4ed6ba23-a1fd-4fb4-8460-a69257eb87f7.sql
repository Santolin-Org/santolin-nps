ALTER TABLE public.nps_responses
ADD COLUMN nome TEXT NOT NULL DEFAULT 'Não informado';

ALTER TABLE public.nps_responses
ADD CONSTRAINT nps_responses_nome_length CHECK (char_length(btrim(nome)) BETWEEN 1 AND 120);