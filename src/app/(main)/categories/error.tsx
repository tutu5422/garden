'use client';
import RouteError from '@/components/shared/RouteError';
export default function CategoriesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="分类" />;
}
