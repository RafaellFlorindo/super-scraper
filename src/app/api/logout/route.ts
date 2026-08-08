import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await destroySession();
  // app single-user: sem página de login, o middleware reloga como o admin
  return Response.redirect(new URL("/", req.url), 303);
}
