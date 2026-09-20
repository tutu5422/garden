'use client';
import RouteError from '@/components/shared/RouteError';
export default function ProfileError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} label="个人资料" />;
}
