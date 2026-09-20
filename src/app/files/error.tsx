'use client';
import RouteError from '@/components/shared/RouteError';
export default function FilesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="文件" />;
}
