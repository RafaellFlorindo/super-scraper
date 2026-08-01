/**
 * Autenticação por sessão em cookie.
 *
 * Sem dependência externa de propósito: são poucas primitivas e o `crypto` do
 * Node cobre todas com segurança.
 *
 * Decisões que importam:
 * - Senha com **scrypt** e sal por usuário. Nunca SHA direto, que é rápido
 *   demais e por isso fácil de quebrar em lote.
 * - Comparação em **tempo constante**, senão o tempo de resposta vaza o quanto
 *   do hash bateu.
 * - No banco fica o **hash do token de sessão**, não o token. Vazou o banco,
 *   ninguém entra com o que está lá.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "scrapper_session";
const DIAS = 30;

// ------------------------------------------------------------------ senha

export function hashPassword(senha: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(senha, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(senha: string, guardado: string): boolean {
  const [algo, saltHex, keyHex] = guardado.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;

  const key = crypto.scryptSync(senha, Buffer.from(saltHex, "hex"), 64);
  const esperado = Buffer.from(keyHex, "hex");
  if (key.length !== esperado.length) return false;
  return crypto.timingSafeEqual(key, esperado);
}

// ---------------------------------------------------------------- sessão

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

/** Cria a sessão e devolve o token que vai para o cookie. */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + DIAS * 86_400_000),
    },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, // JavaScript da página não lê, o que corta roubo por XSS
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 86_400,
  });
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Usuário da requisição atual, ou null. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { tokenHash: session.tokenHash } }).catch(() => {});
    return null;
  }

  const { id, email, name, role } = session.user;
  return { id, email, name, role };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

// ------------------------------------------------------------- instalação

/** Se ainda não existe usuário, o app está em modo instalação. */
export async function precisaInstalar(): Promise<boolean> {
  return (await db.user.count()) === 0;
}

export async function criarUsuario(opts: {
  email: string;
  name: string;
  senha: string;
  role?: string;
}) {
  return db.user.create({
    data: {
      email: opts.email.toLowerCase().trim(),
      name: opts.name.trim(),
      passwordHash: hashPassword(opts.senha),
      role: opts.role ?? "user",
    },
  });
}

export async function autenticar(email: string, senha: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // roda o scrypt mesmo sem usuário, para o tempo de resposta não denunciar
  // quais e-mails existem
  const hash = user?.passwordHash ?? hashPassword("placeholder");
  const ok = verifyPassword(senha, hash);
  return user && ok ? user : null;
}
