import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import logo from "@/assets/santolin-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel NPS Santolin | Respostas da pesquisa" },
      {
        name: "description",
        content: "Área interna da Santolin para acompanhar as respostas da pesquisa e o NPS.",
      },
      { property: "og:title", content: "Painel NPS Santolin" },
      { property: "og:description", content: "Acompanhe as respostas da pesquisa e o NPS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Row = {
  id: string;
  score: number;
  atendimento: string;
  servicos: string;
  nome: string;
  email: string | null;
  created_at: string;
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(mode: "in" | "up") {
    setBusy(true);
    setMsg(null);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "up") setMsg("Conta criada. Verifique seu e-mail para confirmar o acesso.");
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[image:var(--gradient-surface)] px-5">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mx-auto flex w-40 items-center justify-center rounded-3xl border border-border bg-card px-6 py-5 shadow-[var(--shadow-soft)]">
          <img src={logo.url} alt="Santolin" className="h-auto w-20 object-contain" />
        </div>
        <h1 className="mt-6 text-center text-xl font-semibold">Painel Santolin</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Acesso restrito à equipe Santolin.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="mt-6 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        {msg && <p className="mt-4 text-sm text-destructive">{msg}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("in")}
          className="mt-5 w-full rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50"
        >
          Entrar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("up")}
          className="mt-3 w-full rounded-2xl border border-border px-6 py-3.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Criar acesso
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("nps_responses")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [session]);

  if (!ready) return null;
  if (!session) return <Login />;

  const total = rows.length;
  const promoters = rows.filter((r) => r.score >= 9).length;
  const passives = rows.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = rows.filter((r) => r.score <= 6).length;
  const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;

  return (
    <main className="min-h-[100dvh] bg-[image:var(--gradient-surface)] px-5 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card">
              <img src={logo.url} alt="Santolin" className="h-7 w-7 object-contain object-top" />
            </div>
            <h1 className="truncate text-xl font-semibold">Pesquisa NPS</h1>
          </div>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Sair
          </button>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="NPS" value={String(nps)} hint="Promotores − Detratores" />
          <Stat label="Respostas" value={String(total)} />
          <Stat label="Promotores" value={String(promoters)} hint="Notas 9 e 10" />
          <Stat label="Neutros" value={String(passives)} hint="Notas 7 e 8" />
          <Stat label="Detratores" value={String(detractors)} hint="Notas 0 a 6" />
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-card p-2 shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">Atendimento</th>
                <th className="px-4 py-3">Outros serviços</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.nome}</td>
                  <td className="px-4 py-3">
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                        {r.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{r.score}</td>
                  <td className="px-4 py-3">{r.atendimento}</td>
                  <td className="px-4 py-3">{r.servicos}</td>
                </tr>
              ))}
              {total === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Ainda não há respostas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
