import fs from "node:fs";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { pathFor, absolute } from "@/lib/storage";

export const runtime = "nodejs";

const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Atualiza os dados do próprio perfil. multipart/form-data para aceitar a
 * foto junto com os campos de texto num envio só.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const cnpj = String(form.get("cnpj") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const avatar = form.get("avatar");

  if (!name) return Response.json({ error: "Nome não pode ficar vazio." }, { status: 400 });

  let avatarPath: string | undefined;
  if (avatar instanceof File && avatar.size > 0) {
    const ext = AVATAR_TYPES[avatar.type];
    if (!ext) {
      return Response.json({ error: "Foto precisa ser JPG, PNG ou WebP." }, { status: 400 });
    }
    if (avatar.size > 4 * 1024 * 1024) {
      return Response.json({ error: "Foto muito grande (máx. 4 MB)." }, { status: 400 });
    }
    const dest = pathFor("avatars", `${user.id}${ext}`);
    fs.writeFileSync(dest, Buffer.from(await avatar.arrayBuffer()));
    avatarPath = `avatars/${user.id}${ext}`;

    // se trocou a extensão (png -> jpg), apaga a foto antiga
    const antigo = await db.user.findUnique({ where: { id: user.id }, select: { avatarPath: true } });
    if (antigo?.avatarPath && antigo.avatarPath !== avatarPath) {
      fs.rmSync(absolute(antigo.avatarPath), { force: true });
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      name,
      cnpj: cnpj || null,
      phone: phone || null,
      ...(avatarPath ? { avatarPath } : {}),
    },
  });

  return Response.json({ ok: true });
}
