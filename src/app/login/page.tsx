import { redirect } from "next/navigation";
import { autenticar, createSession, setSessionCookie, precisaInstalar, currentUser } from "@/lib/auth";
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

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  if (await precisaInstalar()) redirect("/instalar");
  if (await currentUser()) redirect("/");

  const { proximo = "/" } = await searchParams;
  return <LoginForm action={entrar} proximo={proximo} />;
}
