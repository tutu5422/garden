import Navbar from './Navbar'
import Footer from './Footer'
import MobileBottomNav from './MobileBottomNav'
import MiniPlayerLoader from './MiniPlayerLoader'
import VisitorRecorder from '@/components/VisitorRecorder'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VisitorRecorder />
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <MiniPlayerLoader />
    </>
  )
}
