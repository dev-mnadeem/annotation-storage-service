import { describe, expect, it } from 'vitest';
import {
  IMAGE_ACTIONS,
  IMAGE_STATUSES,
  allowedActions,
  nextStatus,
} from '../../src/domain/imageLifecycle';

describe('image lifecycle', () => {
  it('claims an unassigned image when it is assigned', () => {
    expect(nextStatus('unassigned', 'assign')).toBe('in_progress');
  });

  it('lets a mask land on an image nobody claimed', () => {
    expect(nextStatus('unassigned', 'annotate')).toBe('annotated');
  });

  it('finishes an image that is in progress', () => {
    expect(nextStatus('in_progress', 'annotate')).toBe('annotated');
  });

  it('sends finished work back for review rather than unclaiming it', () => {
    expect(nextStatus('annotated', 'reopen')).toBe('in_progress');
    expect(nextStatus('annotated', 'release')).toBeNull();
  });

  it('refuses to reassign an image that is already claimed', () => {
    expect(nextStatus('in_progress', 'assign')).toBeNull();
  });

  it('refuses to release an image nobody holds', () => {
    expect(nextStatus('unassigned', 'release')).toBeNull();
  });

  it('lists only the actions legal from each status', () => {
    expect(allowedActions('unassigned').sort()).toEqual(['annotate', 'assign']);
    expect(allowedActions('in_progress').sort()).toEqual(['annotate', 'release']);
    expect(allowedActions('annotated')).toEqual(['reopen']);
  });

  it('never lands on a status outside the declared set', () => {
    for (const from of IMAGE_STATUSES) {
      for (const action of IMAGE_ACTIONS) {
        const to = nextStatus(from, action);
        if (to !== null) expect(IMAGE_STATUSES).toContain(to);
      }
    }
  });
});
