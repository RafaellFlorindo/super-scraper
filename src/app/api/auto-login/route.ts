import { createSession, currentUser, precisaInstalar, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * App single-user: em vez de pedir senha, loga como o admin existente.
 *
 * O middleware manda pra cá qualquer request sem cookie de sessão. Roda em
 * Node (o Prisma exige), diferente do middleware, que roda no edge.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const proximo = searchParams.get("proximo") || "/";
  // "//evil.com" e "/\evil.com" também passam em startsWith("/"), mas o
  // new URL(destino, origin) logo abaixo interpreta os dois como caminho
  // absoluto para OUTRO host (URL relativa a protocolo), não como rota
  // interna — sem essa checagem, ?proximo=//evil.com mandava a vítima para
  // fora do app depois do login. Só aceita caminho de verdade, começando
  // com uma única barra.
  const interno =
    proximo.startsWith("/") && !proximo.startsWith("//") && !proximo.startsWith("/\\");
  const destino = interno ? proximo : "/";

  if (await currentUser()) {
    return Response.redirect(new URL(destino, origin), 303);
  }

  if (await precisaInstalar()) {
    return Response.redirect(new URL("/instalar", origin), 303);
  }

  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    return Response.redirect(new URL("/instalar", origin), 303);
  }

  await setSessionCookie(await createSession(user.id));
  return Response.redirect(new URL(destino, origin), 303);
}
