import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import ThemeProvider from "@/components/theme/SkinProvider";
import { MusicProvider } from "@/lib/music/MusicContext";
import Nav from "@/components/Nav";
import MiniPlayerLoader from "@/components/layout/MiniPlayerLoader";
import SyncStatus from "@/components/shared/SyncStatus";
import { Toaster } from "@/components/ui/sonner";
import { THEME_NOFLASH_SCRIPT } from "@/lib/theme/noflash-script";
import "./globals.css";

export const metadata: Metadata = { title: "迷你兔", description: "个人数字花园", manifest: "/manifest.json", icons: { icon: "/favicon.ico" } };
export const viewport: Viewport = { themeColor: "#E8315B", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* P1-1: 阻塞式 inline script，在 hydration 前根据 localStorage + prefers-color-scheme
            注入 CSS 变量，避免主题 FOUC（首次加载闪烁） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_NOFLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased pb-14 md:pb-0 md:pt-14 transition-colors duration-300" style={{ backgroundColor: 'var(--skin-bg)', color: 'var(--skin-text)' }}>
        <AntdRegistry>
          <ThemeProvider>
            <MusicProvider>
              <Nav />
              {children}
              <MiniPlayerLoader />
              {/* Mobile floating sync badge (desktop shows it in the top nav) */}
              <div className="md:hidden fixed bottom-16 right-3 z-40">
                <SyncStatus />
              </div>
              <Toaster position="top-center" richColors />
            </MusicProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
