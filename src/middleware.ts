import { NextResponse, type NextRequest } from "next/server";

/**
 * Porteiro do app.
 *
 * Só checa a PRESENÇA do cookie: o middleware roda no edge runtime, onde o
 * Prisma não vai. A validação real do token acontece no layout, que roda em
 * Node. Aqui o objetivo é só evitar renderizar página protegida para quem
 * chegou sem cookie nenhum.
 */
const PUBLICAS = ["/login", "/instalar"];

/**
 * Rotas que precisam ficar abertas mesmo sem sessão:
 * - webhook: quem chama é a plataforma de checkout, não o navegador
 * - /p/: são as páginas clonadas, servidas para o público
 */
const SEM_SESSAO = ["/api/webhook", "/p/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLICAS.some((r) => pathname.startsWith(r)) ||
    SEM_SESSAO.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.next();
  }

  if (!req.cookies.get("scrapper_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // volta para onde a pessoa queria ir depois de entrar
    url.searchParams.set("proximo", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // tudo, menos estáticos do Next e o ícone
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
