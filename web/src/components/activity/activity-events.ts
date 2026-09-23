export type ActivityPhase = 'start' | 'success' | 'error';

export type ActivityEvent = {
  phase: ActivityPhase;
  id: string;
  title: string;
  detail?: string;
};

const EVENT_NAME = 'xiding:activity';

export function emitActivity(event: ActivityEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ActivityEvent>(EVENT_NAME, { detail: event }));
}

export function activityEventName(): string {
  return EVENT_NAME;
}
