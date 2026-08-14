import { BeniLogo, BeniMascote } from "@/components/logo";
import { DesktopDownloadLink } from "@/components/desktop-download-link";
import { CheckCircle2 } from "lucide-react";

const highlights = [
  {
    title: "Lista, Quadro e Gantt",
    text: "Alterne entre visões sem perder o contexto do trabalho.",
  },
  {
    title: "Backlog e sprints",
    text: "Planeje ciclos, arraste itens e acompanhe a velocidade do time.",
  },
  {
    title: "Dependências e prazos",
    text: "Enxergue bloqueios antes que eles virem atraso.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <BeniLogo className="mb-10" />
          {children}
          <div className="mt-8">
            <DesktopDownloadLink />
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-linear-to-br from-amber-300 via-amber-400 to-orange-500 lg:block">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-center gap-10 px-14 text-amber-950">
          <div>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
              Tudo o que o time precisa entregar, num só lugar.
            </h2>
            <p className="mt-4 max-w-md text-amber-950/75">
              Beni junta o planejamento do backlog, a execução no quadro e a
              linha do tempo do projeto — sem trocar de ferramenta.
            </p>
          </div>

          <ul className="max-w-md space-y-5 xl:max-w-sm">
            {highlights.map((h) => (
              <li key={h.title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber-950/80" />
                <div>
                  <p className="font-medium">{h.title}</p>
                  <p className="text-sm text-amber-950/70">{h.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* o mascote encosta na borda de baixo em vez de flutuar no meio: assim
            ele pertence à cena, e o clarão atrás resolve o amarelo dele sumindo
            no amarelo do fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-6 bottom-0 hidden h-[min(48vh,27rem)] xl:block"
        >
          <div className="absolute inset-[-18%] rounded-full bg-white/25 blur-3xl" />
          <BeniMascote
            pose="apresentando"
            className="relative h-full w-auto drop-shadow-[0_18px_28px_rgba(120,53,15,0.28)]"
          />
        </div>
      </div>
    </div>
  );
}
