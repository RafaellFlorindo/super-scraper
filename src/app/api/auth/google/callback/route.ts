import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleExchange, entrarComProvedor } from "@/lib/oauth";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const esperado = jar.get("oauth_state")?.value;
  jar.delete("oauth_state");

  if (!code || !state || state !== esperado) {
    redirect("/login?erro=" + encodeURIComponent("Login com Google não completou (estado inválido). Tente de novo."));
  }

  try {
    const perfil = await googleExchange(code);
    await setSessionCookie(await entrarComProvedor(perfil));
  } catch (e) {
    redirect("/login?erro=" + encodeURIComponent((e as Error).message));
  }
  redirect("/");
}
