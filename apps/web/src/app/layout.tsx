import type { Metadata, Viewport } from "next";
import { isRtl } from "@shotpilot/shared";
import { currentLocale } from "@/lib/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ShotPilot", template: "%s · ShotPilot" },
  description: "From the first idea to the final frame. One intelligent production workspace.",
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111317" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
