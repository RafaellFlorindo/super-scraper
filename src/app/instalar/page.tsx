import { redirect } from "next/navigation";
import { criarUsuario, createSession, setSessionCookie, precisaInstalar } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

async function instalar(_prev: unknown, formData: FormData) {
  "use server";

  // revalida no servidor: sem isto, qualquer um poderia criar um admin depois
  // que o app já está instalado
  if (!(await precisaInstalar())) redirect("/");

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!nome || !email) return { erro: "Preencha nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha precisa de pelo menos 8 caracteres." };

  const user = await criarUsuario({ email, name: nome, senha, role: "admin" });
  await setSessionCookie(await createSession(user.id));
  redirect("/");
}

export default async function Instalar() {
  if (!(await precisaInstalar())) redirect("/");
  return <LoginForm action={instalar} />;
}
