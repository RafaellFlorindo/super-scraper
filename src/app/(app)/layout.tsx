import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";

export const dynamic = "force-dynamic";

/**
 * Área autenticada.
 *
 * A validação de verdade do token acontece aqui, não no middleware: o
 * middleware roda no edge, onde o Prisma não vai, então lá só dá para checar se
 * o cookie existe. Quem confirma que a sessão é válida e não expirou é este
 * layout, que roda em Node e cobre toda página filha.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* barra fina só para o menu do usuário, fixa no topo da área de conteúdo */}
        <header className="sticky top-0 z-40 flex justify-end border-b border-white/5 bg-ink-900/80 px-8 py-3 backdrop-blur">
          <UserMenu user={user} />
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
