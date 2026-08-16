import { notFound } from "next/navigation";
import { dadosDoPainel, podeVerTelemetria } from "@/server/actions/telemetria";
import { TelemetriaPainel } from "@/components/telemetria/painel";

export const metadata = { title: "Telemetria" };
export const dynamic = "force-dynamic";

export default async function TelemetriaPage({
  searchParams,
}: PageProps<"/telemetria">) {
  // mesma regra da caixa de feedback: quem não administra não descobre que a
  // página existe
  if (!(await podeVerTelemetria())) notFound();

  // o padrão é **sem** os dados de quem administra: enquanto o produto é novo,
  // quem mais usa é quem construiu, e isso distorce toda leitura
  const internos = (await searchParams).internos === "1";

  return (
    <TelemetriaPainel dados={await dadosDoPainel(internos)} internos={internos} />
  );
}
