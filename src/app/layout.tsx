import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DesktopTitleBar } from "@/components/desktop-titlebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Beni — gestão de projetos e tarefas",
    template: "%s · Beni",
  },
  description:
    "Beni é um gerenciador de projetos, tarefas e backlog com visões de lista, quadro kanban e gráfico de Gantt.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // o app de macOS acrescenta um sufixo ao user agent
  const isDesktop = (await headers())
    .get("user-agent")
    ?.includes("BeniDesktop");

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-desktop={isDesktop ? "true" : undefined}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        {isDesktop && <DesktopTitleBar />}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
