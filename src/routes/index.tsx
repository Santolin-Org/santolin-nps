import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import logoFull from "@/assets/santolin-logo-full.png";
import { enviarRespostaParaCrm } from "@/lib/ghl-webhook.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pesquisa de Satisfação Santolin | Sua opinião importa" },
      {
        name: "description",
        content:
          "Responda em menos de 1 minuto: conte como foi sua experiência com a Santolin em seguros, contabilidade e serviços financeiros.",
      },
      { property: "og:title", content: "Pesquisa de Satisfação Santolin" },
      {
        property: "og:description",
        content: "Sua opinião ajuda a Santolin a melhorar cada vez mais. Leva menos de 1 minuto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Survey,
});

const OPCOES_ATENDIMENTO = ["5. Excelente", "4. Bom", "3. Regular", "2. Ruim", "1. Muito ruim"];
const OPCOES_SERVICOS = ["Não conheço", "Conheço alguns", "Sim, conheço"];

// O e-mail é a chave usada para vincular a resposta ao contato no CRM (GHL),
// por isso vale barrar endereços malformados antes do envio.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailValido(email: string) {
  return EMAIL_REGEX.test(email.trim());
}

// Nome completo: pelo menos nome e sobrenome.
function nomeValido(nome: string) {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  return partes.length >= 2 && nome.trim().length <= 120;
}

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

// Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 dígitos (celular, começando com 9).
function telefoneValido(telefone: string) {
  const d = apenasDigitos(telefone);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 10) return /^[1-9]{2}[2-5]/.test(d);
  if (d.length === 11) return d[2] === "9";
  return false;
}

// Aplica a máscara (00) 00000-0000 enquanto o cliente digita.
function formatarTelefone(valor: string) {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function inputClasses(comErro: boolean) {
  return cn(
    "w-full rounded-2xl border bg-background px-5 py-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2",
    comErro
      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
      : "border-border focus:border-primary focus:ring-primary/20",
  );
}

type Answers = {
  score: number | null;
  atendimento: string | null;
  servicos: string | null;
  nome: string;
  telefone: string;
  email: string;
};

function Logo({ className, imgClassName }: { className?: string; imgClassName?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[230px] items-center justify-center rounded-3xl border border-border bg-card px-6 py-5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <img
        src={logoFull}
        alt="Santolin — seguros, contabilidade e serviços financeiros"
        className={cn("h-auto w-32 object-contain", imgClassName)}
      />
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-5 py-4 text-left text-[15px] font-medium transition-all",
        selected
          ? "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft",
      )}
    >
      {label}
    </button>
  );
}

function Survey() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    score: null,
    atendimento: null,
    servicos: null,
    nome: "",
    telefone: "",
    email: "",
  });
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTocado, setEmailTocado] = useState(false);
  const [nomeTocado, setNomeTocado] = useState(false);
  const [telefoneTocado, setTelefoneTocado] = useState(false);

  const total = 4;
  const currentAnswered = [
    answers.score !== null,
    answers.atendimento !== null,
    answers.servicos !== null,
    nomeValido(answers.nome) && telefoneValido(answers.telefone) && emailValido(answers.email),
  ][step];
  const mostrarErroEmail = emailTocado && answers.email.length > 0 && !emailValido(answers.email);
  const mostrarErroNome = nomeTocado && answers.nome.length > 0 && !nomeValido(answers.nome);
  const mostrarErroTelefone =
    telefoneTocado && answers.telefone.length > 0 && !telefoneValido(answers.telefone);

  async function submit(final: Answers) {
    setSending(true);
    setError(null);
    const email = final.email.trim().toLowerCase();

    // O CRM é o único destino da resposta, então uma falha aqui significa perder o
    // feedback: o cliente precisa ver o erro e poder tentar de novo.
    try {
      const resultado = await enviarRespostaParaCrm({
        data: {
          nome: final.nome.trim().replace(/\s+/g, " "),
          telefone: apenasDigitos(final.telefone),
          email,
          score: final.score as number,
          atendimento: final.atendimento as string,
          servicos: final.servicos as string,
        },
      });

      if (!resultado.ok) {
        setSending(false);
        setError("Não conseguimos enviar sua resposta. Tente novamente.");
        return;
      }
    } catch (webhookError) {
      console.error("Falha ao enviar a resposta para o CRM:", webhookError);
      setSending(false);
      setError("Não conseguimos enviar sua resposta. Tente novamente.");
      return;
    }

    setSending(false);
    setDone(true);
  }

  function next() {
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    void submit(answers);
  }

  if (done) {
    return (
      <main className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[image:var(--gradient-page)] px-5 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[image:var(--glow-warm)]"
        />
        <div className="relative w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <Logo className="max-w-[180px] px-5 py-4" imgClassName="w-16" />
          <h1 className="mt-6 text-2xl font-semibold text-foreground">
            Obrigado por compartilhar sua opinião!
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Seu feedback é muito importante para a Santolin.
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-8 w-full rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
          >
            Finalizar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[image:var(--gradient-page)] px-5 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--glow-warm)]"
      />
      <div className="relative mx-auto w-full max-w-md">
        <header className="text-center">
          <Logo />
          <h1 className="mt-6 text-[26px] leading-tight font-semibold text-foreground">
            Sua opinião importa para a Santolin
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Queremos conhecer sua experiência e entender como podemos melhorar cada vez mais.
          </p>
        </header>

        <section className="mt-8 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="truncate text-sm font-medium text-primary">
              Pergunta {step + 1} de {total}
            </span>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all duration-300"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>

          {step === 0 && (
            <div className="mt-6">
              <h2 className="text-lg leading-snug font-semibold text-foreground">
                De 0 a 10, o quanto você recomendaria a Santolin para um amigo ou colega?
              </h2>
              <div className="mx-auto mt-5 grid max-w-[300px] grid-cols-6 gap-2">
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers({ ...answers, score: n })}
                    className={cn(
                      "aspect-square rounded-lg border text-[15px] font-semibold transition-all",
                      answers.score === n
                        ? "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>0 — De jeito nenhum</span>
                <span>10 — Com certeza</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6">
              <h2 className="text-lg leading-snug font-semibold text-foreground">
                Como você avalia o atendimento do seu consultor da Santolin?
              </h2>
              <div className="mt-5 space-y-3">
                {OPCOES_ATENDIMENTO.map((o) => (
                  <OptionButton
                    key={o}
                    label={o}
                    selected={answers.atendimento === o}
                    onClick={() => setAnswers({ ...answers, atendimento: o })}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6">
              <h2 className="text-lg leading-snug font-semibold text-foreground">
                Além do seu seguro atual, você conhece outras soluções e proteções que a Santolin
                oferece?
              </h2>
              <div className="mt-5 space-y-3">
                {OPCOES_SERVICOS.map((o) => (
                  <OptionButton
                    key={o}
                    label={o}
                    selected={answers.servicos === o}
                    onClick={() => setAnswers({ ...answers, servicos: o })}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6">
              <h2 className="text-lg leading-snug font-semibold text-foreground">
                Para concluir sua avaliação, informe seus dados abaixo e clique em ‘Enviar
                respostas’.😊
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="nome"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    type="text"
                    name="name"
                    autoComplete="name"
                    autoCapitalize="words"
                    maxLength={120}
                    required
                    value={answers.nome}
                    onChange={(event) => setAnswers({ ...answers, nome: event.target.value })}
                    onBlur={() => setNomeTocado(true)}
                    placeholder="Digite seu nome completo"
                    aria-invalid={mostrarErroNome}
                    aria-describedby={mostrarErroNome ? "nome-erro" : undefined}
                    className={inputClasses(mostrarErroNome)}
                  />
                  {mostrarErroNome && (
                    <p id="nome-erro" className="mt-2 text-sm text-destructive">
                      Informe seu nome e sobrenome
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="telefone"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Telefone com DDD
                  </label>
                  <input
                    id="telefone"
                    type="tel"
                    name="tel"
                    autoComplete="tel-national"
                    inputMode="tel"
                    maxLength={15}
                    required
                    value={answers.telefone}
                    onChange={(event) =>
                      setAnswers({ ...answers, telefone: formatarTelefone(event.target.value) })
                    }
                    onBlur={() => setTelefoneTocado(true)}
                    placeholder="(00) 00000-0000"
                    aria-invalid={mostrarErroTelefone}
                    aria-describedby={mostrarErroTelefone ? "telefone-erro" : undefined}
                    className={inputClasses(mostrarErroTelefone)}
                  />
                  {mostrarErroTelefone && (
                    <p id="telefone-erro" className="mt-2 text-sm text-destructive">
                      Digite um telefone válido com DDD, como (11) 91234-5678
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={255}
                    required
                    value={answers.email}
                    onChange={(event) => setAnswers({ ...answers, email: event.target.value })}
                    onBlur={() => setEmailTocado(true)}
                    placeholder="Digite seu melhor e-mail"
                    aria-invalid={mostrarErroEmail}
                    aria-describedby={mostrarErroEmail ? "email-erro" : undefined}
                    className={inputClasses(mostrarErroEmail)}
                  />
                  {mostrarErroEmail && (
                    <p id="email-erro" className="mt-2 text-sm text-destructive">
                      Digite um e-mail válido, como nome@empresa.com.br
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-5 text-sm text-destructive">{error}</p>}

          <button
            type="button"
            disabled={!currentAnswered || sending}
            onClick={next}
            className="mt-7 w-full rounded-2xl bg-[image:var(--gradient-brand)] px-6 py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:brightness-95 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {step === total - 1 ? (sending ? "Enviando..." : "Enviar respostas") : "Continuar"}
          </button>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Suas respostas são confidenciais e usadas apenas para melhorar nossos serviços.
        </p>
      </div>
    </main>
  );
}
