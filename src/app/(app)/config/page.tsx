import { getMaskedSettings } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function Config() {
  const settings = await getMaskedSettings();

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Configurações</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Chaves de API e comportamento da coleta. Vale para o app e para o worker, sem
        precisar mexer em arquivo nenhum.
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
