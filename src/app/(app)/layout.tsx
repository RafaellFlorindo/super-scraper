import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { computeAchievements } from "@/lib/achievements";
import Sidebar from "@/components/Sidebar";
import UserMenu from "@/components/UserMenu";
import AchievementsWidget from "@/components/AchievementsWidget";
import AppBackground from "@/components/AppBackground";

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
  if (!user) redirect("/api/auto-login");

  // calculado aqui e não num client fetch: é leitura simples do banco, e
  // evita mais uma rota de API só para preencher o cabeçalho
  const achievements = await computeAchievements();

  return (
    <div className="flex min-h-screen">
      <AppBackground />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra do caminho de vitórias e do menu do usuário.
            Sem fill próprio: só blur + um fio que some nas pontas. Um fundo
            sólido aqui criava uma emenda dura bem em cima do bloom violeta. */}
        <header className="sticky top-0 z-40 flex items-center justify-end gap-3 px-8 py-3.5 backdrop-blur-xl backdrop-saturate-150">
          <AchievementsWidget data={achievements} />
          <UserMenu user={user} />
          <div className="hairline absolute inset-x-0 bottom-0" />
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
