import Footer from './Footer'
import VisitorRecorder from '@/components/VisitorRecorder'
import CloudSyncProvider from '@/components/CloudSyncProvider'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CloudSyncProvider>
      <VisitorRecorder />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
    </CloudSyncProvider>
  )
}
