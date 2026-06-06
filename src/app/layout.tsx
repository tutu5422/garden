import type { Metadata, Viewport } from 'next'
import SkinProvider from '@/components/theme/SkinProvider'
import { Toaster } from '@/components/ui/sonner'
import ErrorCatcher from '@/components/ErrorCatcher'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import SWRegister from '@/components/pwa/SWRegister'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#47709B',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: { default: '秘密花园', template: '%s | 秘密花园' },
  description: '记录兴趣爱好，整理灵感，打造个人知识花园',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '秘密花园' },
  icons: { icon: '/favicon.ico', apple: [{ url: '/icon-192.png', sizes: '192x192' }] },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head><meta name="apple-mobile-web-app-capable" content="yes" /></head>
      <body className="min-h-full flex flex-col font-sans" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <ErrorCatcher>
          <SkinProvider>
            {children}
            <Toaster position="bottom-center" richColors closeButton />
            <InstallPrompt />
          </SkinProvider>
        </ErrorCatcher>
        <SWRegister />
      </body>
    </html>
  )
}
