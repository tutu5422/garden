'use client'

import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus } from 'lucide-react'
import { searchTags, getOrCreateTag } from '@/lib/db/tags-client'
import type { Tag } from '@/lib/types'

interface TagSelectorProps {
  selectedTags: Tag[]
  onChange: (tags: Tag[]) => void
}

export default function TagSelector({ selectedTags, onChange }: TagSelectorProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])

  const handleSearch = useCallback(async (query: string) => {
    setInput(query)
    if (query.trim()) {
      const results = await searchTags(query)
      setSuggestions(results || [])
    } else {
      setSuggestions([])
    }
  }, [])

  const handleAdd = async (tag: Tag) => {
    if (selectedTags.find((t) => t.id === tag.id)) return
    onChange([...selectedTags, tag])
    setInput('')
    setSuggestions([])
  }

  const handleCreate = async () => {
    const trimmed = input.trim()
    if (!trimmed) return
    try {
      const tag = await getOrCreateTag(trimmed)
      if (!selectedTags.find((t) => t.id === tag.id)) {
        onChange([...selectedTags, tag])
      }
      setInput('')
      setSuggestions([])
    } catch {
      // Ignore creation errors for MVP
    }
  }

  const handleRemove = (tagId: string) => {
    onChange(selectedTags.filter((t) => t.id !== tagId))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="gap-1">
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Input
          value={input}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索或新建标签..."
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        {input.trim() && suggestions.length === 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-auto py-1 text-xs"
            onClick={handleCreate}
          >
            <Plus className="size-3 mr-1" />
            创建标签 &ldquo;{input.trim()}&rdquo;
          </Button>
        )}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 border rounded-md bg-popover shadow-md">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => handleAdd(tag)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
