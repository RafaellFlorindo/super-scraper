import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AGENTS, seedPrompt, type AgentId } from "@/lib/agents";
import { scaleLabel } from "@/lib/scale-score";
import AgentStudio from "@/components/AgentStudio";
import CreativeFactory from "@/components/CreativeFactory";
import OwnerOffer from "@/components/OwnerOffer";
import ProjectStatus from "@/components/ProjectStatus";
import { card, btnSecondary } from "@/lib/ui";

export const dynamic = "force-dynamic";

const media = (p: string) => `/api/media/${p.replaceAll("\\", "/")}`;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      conversations: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      savedAds: { include: { ad: { include: { advertiser: true } } } },
      creatives: {
        orderBy: { createdAt: "desc" },
        include: { renders: { orderBy: { createdAt: "desc" } } },
      },
      modeledAd: {
        include: { advertiser: true, creatives: true, funnel: true },
      },
    },
  });
  if (!project) notFound();

  const initial: Record<string, { id: string; role: string; content: string }[]> = {};
  const seeds: Record<string, string> = {};
  for (const agentId of Object.keys(AGENTS) as AgentId[]) {
    const conv = project.conversations.find((c) => c.agent === agentId);
    initial[agentId] =
      conv?.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })) ?? [];
    seeds[agentId] = seedPrompt(agentId);
  }

  const ad = project.modeledAd;
  const escala = ad ? scaleLabel(ad.scaleScore) : null;

  return (
    <div className="p-8">
      <Link
        href="/projetos"
        className="mb-4 inline-block text-sm text-zinc-500 transition duration-200 ease-spring hover:text-gold-400"
      >
        ← Projetos
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-100">{project.title}</h1>
        <ProjectStatus id={project.id} status={project.status} />
      </div>

      {ad && (
        <div className={`mb-5 flex flex-wrap items-center gap-4 ${card} p-4`}>
          {(() => {
            const thumb = ad.creatives.find((c) => c.localPath);
            if (!thumb?.localPath) return null;
            return thumb.kind === "video" ? (
              <video src={media(thumb.localPath)} className="h-20 w-32 rounded-xl object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media(thumb.localPath)} alt="" className="h-20 w-32 rounded-xl object-cover" />
            );
          })()}

          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-gold-500/70">
              Modelando
            </div>
            <div className="truncate font-medium text-zinc-100">
              {ad.headline ?? ad.advertiser.name}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>{ad.advertiser.name}</span>
              {escala && (
                <span className={escala.tone}>
                  escala {ad.scaleScore} · {escala.label}
                </span>
              )}
              {ad.variantCount > 1 && <span>{ad.variantCount}x variações</span>}
              {ad.funnel?.detectedPrice && <span>preço dele {ad.funnel.detectedPrice}</span>}
              {ad.creatives.some((c) => c.transcript) && (
                <span className="text-emerald-400">VSL transcrita</span>
              )}
            </div>
          </div>

          <Link
            href={`/ads/${ad.id}`}
            className={`${btnSecondary} !h-auto px-3 py-1.5 text-xs`}
          >
            ver anúncio
          </Link>
        </div>
      )}

      <div className="mb-5">
        <OwnerOffer projectId={project.id} initial={project.ownerOffer ?? ""} />
      </div>

      {/*
        Sem mais aba "Criativos" separada: agora ela é a Fábrica de Criativos
        em ação, aparecendo logo abaixo do chat dela mesma quando o agente é
        selecionado — "gerar criativos" é o que ESTE agente faz, não um
        destino à parte.
      */}
      <AgentStudio
        projectId={project.id}
        agents={Object.values(AGENTS).map((a) => ({
          id: a.id,
          name: a.name,
          tagline: a.tagline,
          icon: a.icon,
          greeting: a.greeting,
        }))}
        initial={initial}
        seeds={seeds}
        modeling={Boolean(ad)}
        savedCount={project.savedAds.length}
        factoryPanel={
          <CreativeFactory
            projectId={project.id}
            sources={(ad?.creatives ?? []).map((c) => ({
              id: c.id,
              kind: c.kind,
              localPath: c.localPath,
              hasTranscript: Boolean(c.transcript),
            }))}
            generated={project.creatives.map((g) => ({
              id: g.id,
              angle: g.angle,
              hook: g.hook,
              script: g.script,
              storyboard: g.storyboard,
              primaryText: g.primaryText,
              headline: g.headline,
              imagePrompt: g.imagePrompt,
              imagePath: g.imagePath,
              renders: g.renders.map((r) => ({
                id: r.id,
                status: r.status,
                localPath: r.localPath,
                durationSec: r.durationSec,
                error: r.error,
              })),
            }))}
          />
        }
      />
    </div>
  );
}
