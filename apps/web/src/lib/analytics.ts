import posthog from 'posthog-js';
import { useAuthStore } from '@/stores/auth.store';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function capture(event: string, properties: AnalyticsProperties = {}) {
  if (typeof window === 'undefined' || !posthog) {
    return;
  }

  // Ensure user is identified if logged in
  const user = useAuthStore.getState().user;
  if (user && user.id) {
    const currentId = posthog.get_distinct_id();
    if (currentId !== user.id) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }

  posthog.capture(event, properties);
}
