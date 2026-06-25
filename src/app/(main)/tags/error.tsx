'use client';
import RouteError from '@/components/shared/RouteError';
export default (props: { error: Error & { digest?: string }; reset: () => void }) =>
  <RouteError {...props} label="标签" />;
