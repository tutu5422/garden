'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const isLocal = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder')
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLocal()) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // 获取当前用户
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (isLocal()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, isLocal: isLocal(), signOut }
}
