import { notFound } from "next/navigation";
import { dadosDoPainel, podeVerTelemetria } from "@/server/actions/telemetria";
import { TelemetriaPainel } from "@/components/telemetria/painel";

export const metadata = { title: "Telemetria" };
export const dynamic = "force-dynamic";

export default async function TelemetriaPage() {
  // mesma regra da caixa de feedback: quem não administra não descobre que a
  // página existe
  if (!(await podeVerTelemetria())) notFound();
  return <TelemetriaPainel dados={await dadosDoPainel()} />;
}
