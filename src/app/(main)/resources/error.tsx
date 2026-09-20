'use client';
import RouteError from '@/components/shared/RouteError';
export default function ResourcesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="资源库" />;
}
