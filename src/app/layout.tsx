import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = { title: "迷你兔", description: "个人数字花园", manifest: "/manifest.json", icons: { icon: "/favicon.ico" } };
export const viewport: Viewport = { themeColor: "#f59e0b", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased pb-20 md:pt-14 md:pb-0">
        <Nav />
        {children}
      </body>
    </html>
  );
}
