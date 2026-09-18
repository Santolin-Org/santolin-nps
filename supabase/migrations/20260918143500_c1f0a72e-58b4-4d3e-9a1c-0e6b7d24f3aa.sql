-- E-mail do cliente: chave de vinculação da resposta com o contato no CRM (GHL).
-- Nullable porque as respostas já gravadas não têm e-mail; o formulário exige o campo
-- em toda nova resposta.
ALTER TABLE public.nps_responses
ADD COLUMN email TEXT;

ALTER TABLE public.nps_responses
ADD CONSTRAINT nps_responses_email_formato CHECK (
  email IS NULL
  OR (char_length(email) <= 255 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
);

CREATE INDEX nps_responses_email_idx ON public.nps_responses (email);
