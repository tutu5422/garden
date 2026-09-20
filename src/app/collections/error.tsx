'use client';
import RouteError from '@/components/shared/RouteError';
export default function CollectionsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="合集" />;
}
