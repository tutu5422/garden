'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Pagination from '@/components/shared/Pagination'

export default function ResourcesPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    router.push(`/resources?${params.toString()}`)
  }

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  )
}
