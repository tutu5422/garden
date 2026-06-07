import Footer from './Footer'
import VisitorRecorder from '@/components/VisitorRecorder'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisitorRecorder />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
    </>
  )
}
