/**
 * Login social (Google e X/Twitter) por cima da nossa sessão própria.
 *
 * Não usamos NextAuth de propósito: a sessão em cookie já existe e funciona;
 * aqui só precisamos do "authorization code flow" de cada provedor para
 * descobrir QUEM é a pessoa, e daí a conta segue o fluxo normal do app.
 *
 * As credenciais (Client ID/Secret) vêm das Configurações. Sem elas, as rotas
 * devolvem o usuário para /login com uma mensagem explicando o que falta.
 */
import crypto from "node:crypto";
import { db } from "./db";
import { getSetting } from "./settings";
import { createSession, hashPassword } from "./auth";

export async function appUrl(): Promise<string> {
  return (await getSetting("APP_URL")) || "http://localhost:3000";
}

/** Acha (ou cria) a conta e devolve o token de sessão pronto para o cookie. */
export async function entrarComProvedor(opts: {
  email: string;
  name: string;
}): Promise<string> {
  const email = opts.email.toLowerCase().trim();
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: opts.name.trim() || email.split("@")[0],
        // conta social não tem senha própria; um segredo aleatório mantém o
        // campo obrigatório sem abrir login por senha adivinhável
        passwordHash: hashPassword(crypto.randomBytes(32).toString("hex")),
        role: "user",
      },
    });
  }

  return createSession(user.id);
}

// ------------------------------------------------------------------ google

export async function googleAuthUrl(state: string): Promise<string | null> {
  const clientId = await getSetting("GOOGLE_CLIENT_ID");
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${await appUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function googleExchange(code: string): Promise<{ email: string; name: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: await getSetting("GOOGLE_CLIENT_ID"),
      client_secret: await getSetting("GOOGLE_CLIENT_SECRET"),
      redirect_uri: `${await appUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google recusou o código (${res.status}).`);
  const { access_token } = (await res.json()) as { access_token: string };

  const perfil = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!perfil.ok) throw new Error("Não consegui ler o perfil no Google.");
  const dados = (await perfil.json()) as { email?: string; name?: string };
  if (!dados.email) throw new Error("O Google não devolveu o e-mail da conta.");

  return { email: dados.email, name: dados.name ?? "" };
}

// ---------------------------------------------------------------- twitter

/** O X exige PKCE: o verifier fica num cookie até o callback. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function twitterAuthUrl(state: string, challenge: string): Promise<string | null> {
  const clientId = await getSetting("TWITTER_CLIENT_ID");
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${await appUrl()}/api/auth/twitter/callback`,
    response_type: "code",
    scope: "users.read tweet.read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://twitter.com/i/oauth2/authorize?${params}`;
}

export async function twitterExchange(
  code: string,
  verifier: string
): Promise<{ email: string; name: string }> {
  const clientId = await getSetting("TWITTER_CLIENT_ID");
  const clientSecret = await getSetting("TWITTER_CLIENT_SECRET");

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: `${await appUrl()}/api/auth/twitter/callback`,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`X recusou o código (${res.status}).`);
  const { access_token } = (await res.json()) as { access_token: string };

  const perfil = await fetch("https://api.twitter.com/2/users/me", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!perfil.ok) throw new Error("Não consegui ler o perfil no X.");
  const { data } = (await perfil.json()) as { data: { username: string; name: string } };

  // A API v2 do X não entrega e-mail sem permissão especial; o username vira
  // um e-mail sintético estável, que identifica a conta do mesmo jeito.
  return { email: `${data.username}@x.local`, name: data.name };
}
