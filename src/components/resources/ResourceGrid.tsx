'use client'

import type { Resource } from '@/lib/types'
import ResourceCard from './ResourceCard'

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export default function ResourceGrid({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) return null

  return (
    <>
      <style>{`
        .masonry { column-count: 2; column-gap: 0.75rem; }
        @media (min-width: 768px) { .masonry { column-count: 3; } }
      `}</style>
      <div className="masonry" style={{ columnFill: 'balance' }}>
        {resources.map((resource) => {
          const h = hashCode(resource.title)
          const heights = [80, 100, 90, 110, 85, 95, 105]
          const coverHeight = heights[h % heights.length]
          return (
            <div key={resource.id} style={{ breakInside: 'avoid', marginBottom: '0.75rem', contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}>
              <ResourceCard resource={resource} coverHeight={coverHeight} />
            </div>
          )
        })}
      </div>
    </>
  )
}
