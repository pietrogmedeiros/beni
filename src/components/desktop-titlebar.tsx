/**
 * Barra superior exclusiva do app de macOS.
 *
 * O app usa `titleBarStyle: hiddenInset`, então os botões de semáforo do
 * sistema ficam sobre o conteúdo. Esta faixa reserva o espaço deles e serve
 * de área de arraste da janela.
 */
export function DesktopTitleBar() {
  return (
    <div
      data-titlebar
      className="fixed inset-x-0 top-0 z-100 flex h-(--titlebar-h) items-center border-b bg-sidebar/95 pl-[86px] pr-3 backdrop-blur"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="text-[12px] font-medium tracking-tight text-muted-foreground">
        Beni
      </span>
    </div>
  );
}
