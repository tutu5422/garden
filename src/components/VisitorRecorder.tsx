'use client'

import { useEffect } from 'react'
import { recordVisit } from '@/lib/visitor'

export default function VisitorRecorder() {
  useEffect(() => { recordVisit() }, [])
  return null
}
