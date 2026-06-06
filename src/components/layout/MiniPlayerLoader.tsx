'use client'

import dynamic from 'next/dynamic'

const MiniPlayer = dynamic(() => import('@/components/music/MiniPlayer'), { ssr: false })

export default function MiniPlayerLoader() {
  return <MiniPlayer />
}
