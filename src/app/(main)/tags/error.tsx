'use client';
import RouteError from '@/components/shared/RouteError';
export default function TagsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="标签" />;
}
