import type { Metadata, Viewport } from "next";
import ThemeProvider from "@/components/theme/SkinProvider";
import { MusicProvider } from "@/lib/music/MusicContext";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = { title: "迷你兔", description: "个人数字花园", manifest: "/manifest.json", icons: { icon: "/favicon.ico" } };
export const viewport: Viewport = { themeColor: "#E8315B", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen antialiased pb-24 md:pb-0 transition-colors duration-300" style={{ backgroundColor: 'var(--skin-bg)', color: 'var(--skin-text)' }}>
        <ThemeProvider>
          <MusicProvider>
            <Nav />
            {children}
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
