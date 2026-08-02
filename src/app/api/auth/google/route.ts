import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleAuthUrl } from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const url = await googleAuthUrl(state);
  if (!url) {
    redirect("/login?erro=" + encodeURIComponent("Login com Google ainda não configurado: adicione o Google Client ID e Secret em Configurações."));
  }

  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  redirect(url);
}
