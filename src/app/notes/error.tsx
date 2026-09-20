'use client';
import RouteError from '@/components/shared/RouteError';
export default function NotesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="笔记" />;
}
