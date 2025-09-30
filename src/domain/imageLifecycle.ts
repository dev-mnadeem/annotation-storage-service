/**
 * An image moves through a small, explicit lifecycle. The table below is the only place a
 * status change is authorised: callers ask for an action, not for a target status, so an
 * illegal jump such as `annotated` straight back to `unassigned` has nowhere to be written.
 */
export const IMAGE_STATUSES = ['unassigned', 'in_progress', 'annotated'] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const IMAGE_ACTIONS = ['assign', 'release', 'annotate', 'reopen'] as const;
export type ImageAction = (typeof IMAGE_ACTIONS)[number];

/**
 * `annotate` is reachable from `unassigned` because a mask may arrive for an image nobody
 * formally claimed — the act of annotating claims it. `release` deliberately has no edge out
 * of `annotated`: finished work is reopened for review, not silently unclaimed.
 */
const TRANSITIONS: Record<ImageStatus, Partial<Record<ImageAction, ImageStatus>>> = {
  unassigned: { assign: 'in_progress', annotate: 'annotated' },
  in_progress: { release: 'unassigned', annotate: 'annotated' },
  annotated: { reopen: 'in_progress' },
};

export function allowedActions(from: ImageStatus): ImageAction[] {
  return Object.keys(TRANSITIONS[from]) as ImageAction[];
}

/** Returns the resulting status, or `null` when the action is not legal from `from`. */
export function nextStatus(from: ImageStatus, action: ImageAction): ImageStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

export function isTerminalFor(status: ImageStatus, action: ImageAction): boolean {
  return nextStatus(status, action) === status;
}
