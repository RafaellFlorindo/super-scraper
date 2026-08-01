import { db } from "@/lib/db";
import ClonePanel from "@/components/ClonePanel";

export const dynamic = "force-dynamic";

export default async function Clones() {
  const [clones, beat] = await Promise.all([
    db.clonedPage.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.workerHeartbeat.findUnique({ where: { id: "singleton" } }),
  ]);

  const workerOnline = Boolean(beat && Date.now() - beat.beatAt.getTime() < 15_000);

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Páginas Clonadas</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Clone a página de vendas do concorrente para estudar a estrutura, já sem os
        rastreadores dele.
      </p>

      <ClonePanel
        workerOnline={workerOnline}
        initial={clones.map((c) => ({
          id: c.id,
          sourceUrl: c.sourceUrl,
          slug: c.slug,
          title: c.title,
          status: c.status,
          error: c.error,
          bytes: c.bytes,
          files: c.files,
          strippedTrackers: c.strippedTrackers,
          localDir: c.localDir,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
