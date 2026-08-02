import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { twitterAuthUrl, pkcePair } from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const { verifier, challenge } = pkcePair();

  const url = await twitterAuthUrl(state, challenge);
  if (!url) {
    redirect("/login?erro=" + encodeURIComponent("Login com X ainda não configurado: adicione o Twitter Client ID e Secret em Configurações."));
  }

  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  jar.set("oauth_state", state, opts);
  jar.set("oauth_verifier", verifier, opts);
  redirect(url);
}
