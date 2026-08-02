import { redirect } from "next/navigation";
import {
  autenticar,
  criarUsuario,
  createSession,
  setSessionCookie,
  precisaInstalar,
  currentUser,
} from "@/lib/auth";
import { db } from "@/lib/db";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

async function entrar(_prev: unknown, formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");
  const proximo = String(formData.get("proximo") ?? "/");

  const user = await autenticar(email, senha);
  // mensagem genérica de propósito: dizer "e-mail não existe" entrega quais
  // contas existem para quem estiver tentando adivinhar
  if (!user) return { erro: "E-mail ou senha incorretos." };

  await setSessionCookie(await createSession(user.id));
  redirect(proximo.startsWith("/") ? proximo : "/");
}

async function criarConta(_prev: unknown, formData: FormData) {
  "use server";
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const senha = String(formData.get("senha") ?? "");

  if (!nome) return { erro: "Diga seu nome." };
  if (senha.length < 8) return { erro: "A senha precisa de pelo menos 8 caracteres." };
  if (await db.user.findUnique({ where: { email } })) {
    return { erro: "Já existe uma conta com este e-mail — entre com ela." };
  }

  const user = await criarUsuario({ email, name: nome, senha });
  await setSessionCookie(await createSession(user.id));
  redirect("/");
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  if (await precisaInstalar()) redirect("/instalar");
  if (await currentUser()) redirect("/");

  const { proximo = "/", erro } = await searchParams;
  return (
    <LoginForm
      action={entrar}
      registerAction={criarConta}
      proximo={proximo}
      erroInicial={erro}
    />
  );
}
