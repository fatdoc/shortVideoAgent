import { describe, expect, it } from 'vitest';
import { resolveSidebarNavigationTarget } from './sidebarNavigation';

describe('Sidebar StoryCanvas navigation', () => {
  it('routes the package-less StoryCanvas task to explicit Package selection', () => {
    expect(
      resolveSidebarNavigationTarget('/production/canvas/00b4826e-d2d9-58ca-9f88-999bc1013ccb'),
    ).toBe('/production/inbox/00b4826e-d2d9-58ca-9f88-999bc1013ccb?target=canvas');
  });

  it('leaves every other sidebar destination unchanged', () => {
    expect(resolveSidebarNavigationTarget('/projects/project-1/script')).toBe(
      '/projects/project-1/script',
    );
  });
});
