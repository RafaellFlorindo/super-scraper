"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  avatarUrl: string | null;
}

const INPUT =
  "w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-gold-500/50";

export default function ProfileForm({ name, email, cnpj, phone, avatarUrl }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile/update", {
      method: "POST",
      body: new FormData(e.currentTarget),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setMsg({ ok: false, texto: data.error });
    setMsg({ ok: true, texto: "Perfil atualizado." });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-gold-500/30 transition hover:ring-gold-500/60"
          title="Trocar foto"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gold-500/20 text-2xl font-semibold text-gold-300">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
            trocar
          </span>
        </button>
        <div className="min-w-0 text-xs text-zinc-500">
          Clique na foto para trocar.
          <br />
          JPG, PNG ou WebP, até 4 MB.
        </div>
        <input
          ref={fileRef}
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Nome</span>
        <input name="name" defaultValue={name} className={INPUT} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">E-mail</span>
        <input value={email} disabled className={`${INPUT} opacity-50`} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">CNPJ</span>
        <input name="cnpj" defaultValue={cnpj} placeholder="00.000.000/0001-00" className={INPUT} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Telefone</span>
        <input name="phone" defaultValue={phone} placeholder="(11) 99999-9999" className={INPUT} />
      </label>

      <button
        disabled={busy}
        className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-medium text-ink-900 transition hover:bg-gold-400 disabled:opacity-50"
      >
        {busy ? "Salvando..." : "Salvar"}
      </button>

      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.texto}</p>
      )}
    </form>
  );
}
