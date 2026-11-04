import { createServerFn } from "@tanstack/react-start";

// O envio roda no servidor de propósito: a URL do webhook é um segredo (quem a tiver
// consegue criar contatos no CRM) e não pode ir para o bundle do navegador.
// Por isso a variável NÃO leva o prefixo VITE_.
export type RespostaCrm = {
  nome: string;
  /** Somente dígitos, com DDD (10 ou 11 dígitos). */
  telefone: string;
  email: string;
  score: number;
  atendimento: string;
  servicos: string;
};

function classificar(score: number) {
  if (score >= 9) return "Promotor";
  if (score >= 7) return "Neutro";
  return "Detrator";
}

export const enviarRespostaParaCrm = createServerFn({ method: "POST" })
  .validator((data: RespostaCrm) => data)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["GHL_WEBHOOK_URL"];

    if (!webhookUrl) {
      console.error("[GHL] GHL_WEBHOOK_URL não configurada — resposta não enviada ao CRM.");
      return { ok: false as const, motivo: "sem-url" };
    }

    const [primeiroNome, ...sobrenomes] = data.nome.split(" ");
    const telefone = `+55${data.telefone}`;

    // Além dos campos em português, enviamos as chaves padrão de contato do GHL
    // (name, first_name, last_name, phone, email), que o CRM reconhece com mais
    // facilidade ao mapear o webhook para o contato.
    const payload = {
      name: data.nome,
      first_name: primeiroNome,
      last_name: sobrenomes.join(" "),
      phone: telefone,
      email: data.email,
      nome_completo: data.nome,
      telefone,
      nps_score: data.score,
      nps_classificacao: classificar(data.score),
      avaliacao_atendimento: data.atendimento,
      conhece_outros_servicos: data.servicos,
      respondido_em: new Date().toISOString(),
      origem: "Pesquisa de Satisfação Santolin",
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.error(`[GHL] Webhook respondeu ${response.status}: ${await response.text()}`);
        return { ok: false as const, motivo: `http-${response.status}` };
      }

      return { ok: true as const };
    } catch (error) {
      console.error("[GHL] Falha ao chamar o webhook:", error);
      return { ok: false as const, motivo: "erro-rede" };
    }
  });
