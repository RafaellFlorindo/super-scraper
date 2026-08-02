import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { twitterExchange, entrarComProvedor } from "@/lib/oauth";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const esperado = jar.get("oauth_state")?.value;
  const verifier = jar.get("oauth_verifier")?.value;
  jar.delete("oauth_state");
  jar.delete("oauth_verifier");

  if (!code || !state || state !== esperado || !verifier) {
    redirect("/login?erro=" + encodeURIComponent("Login com X não completou (estado inválido). Tente de novo."));
  }

  try {
    const perfil = await twitterExchange(code, verifier);
    await setSessionCookie(await entrarComProvedor(perfil));
  } catch (e) {
    redirect("/login?erro=" + encodeURIComponent((e as Error).message));
  }
  redirect("/");
}
