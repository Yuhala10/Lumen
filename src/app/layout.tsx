import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Kalam } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import { SiteHeader } from "@/components/shell/site-header";
import { getServerDict } from "@/lib/i18n/server";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const hand = Kalam({ variable: "--font-hand-kalam", subsets: ["latin"], weight: ["400", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDict();
  return {
    title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0c110f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getServerDict();
  return (
    <html
      lang={locale}
      className={`${sans.variable} ${mono.variable} ${display.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="paper-grain flex min-h-full flex-col">
        <Providers locale={locale}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
