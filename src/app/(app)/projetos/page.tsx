import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import ProjectCard from "@/components/ProjectCard";
import { campo, btnPrimary } from "@/lib/ui";

export const dynamic = "force-dynamic";

async function createProject(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const project = await db.project.create({ data: { title } });
  revalidatePath("/projetos");
  redirect(`/projetos/${project.id}`);
}

const FILTROS = [
  { id: "abertos", label: "Em aberto" },
  { id: "concluido", label: "Concluídos" },
  { id: "todos", label: "Todos" },
];

export default async function Projetos({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "abertos" } = await searchParams;

  const projects = await db.project.findMany({
    where:
      filtro === "concluido"
        ? { status: "concluido" }
        : filtro === "abertos"
        ? { status: { not: "concluido" } }
        : {},
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { savedAds: true, conversations: true, creatives: true } },
    },
  });

  const concluidos = await db.project.count({ where: { status: "concluido" } });

  return (
    <div className="px-10 py-9">
      <h1 className="mb-1 font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-50">Projetos</h1>
      <p className="mb-6 text-[13px] text-zinc-500">
        Cada projeto junta o anúncio modelado, as conversas com os agentes e os criativos
        gerados.
      </p>

      <form action={createProject} className="mb-5 flex gap-2">
        <input
          name="title"
          placeholder="Nome do projeto, ex: Bolos Caseiros VSL"
          className={`min-w-64 flex-1 ${campo} placeholder:text-zinc-600`}
        />
        <button className={btnPrimary}>Criar projeto</button>
      </form>

      <div className="mb-5 flex gap-1">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={`/projetos?filtro=${f.id}`}
            className={`rounded-xl px-3 py-1.5 text-sm transition duration-200 ease-spring active:scale-[0.97] ${
              filtro === f.id
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
          >
            {f.label}
            {f.id === "concluido" && concluidos > 0 && (
              <span className="ml-1 text-zinc-600">{concluidos}</span>
            )}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center text-zinc-500">
          {filtro === "concluido"
            ? "Nenhum projeto concluído ainda."
            : "Nenhum projeto. Modele um anúncio no Banco de Anúncios para começar."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              title={p.title}
              status={p.status}
              savedCount={p._count.savedAds}
              conversationCount={p._count.conversations}
              creativeCount={p._count.creatives}
            />
          ))}
        </div>
      )}
    </div>
  );
}
