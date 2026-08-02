import { db } from "@/lib/db";
import { currentUser, hashPassword, verifyPassword, destroySession } from "@/lib/auth";

export const runtime = "nodejs";

/** Troca a própria senha. Exige a senha atual, e derruba a sessão ao final. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const { senhaAtual, novaSenha } = (await req.json()) as {
    senhaAtual: string;
    novaSenha: string;
  };

  if (!novaSenha || novaSenha.length < 8) {
    return Response.json({ error: "A nova senha precisa de pelo menos 8 caracteres." }, { status: 400 });
  }

  const registro = await db.user.findUnique({ where: { id: user.id } });
  if (!registro || !verifyPassword(senhaAtual, registro.passwordHash)) {
    return Response.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(novaSenha) },
  });

  // troca de senha invalida a sessão atual, igual ao fluxo por linha de comando
  await db.session.deleteMany({ where: { userId: user.id } });
  await destroySession();

  return Response.json({ ok: true });
}
