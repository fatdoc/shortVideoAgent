import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID } from '../domain/constants';
import { demoWorkspace } from '../mocks/demoWorkspace';

describe('demo workspace contract', () => {
  it('uses unified demo project id', () => {
    expect(demoWorkspace.project.id).toBe(DEMO_PROJECT_ID);
    expect(demoWorkspace.brief.projectId).toBe(DEMO_PROJECT_ID);
  });

  it('contains C1-C8 brand facts', () => {
    const ids = demoWorkspace.brand.facts.map((fact) => fact.id);
    expect(ids).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
  });

  it('contains eight storyboard shots', () => {
    expect(demoWorkspace.storyboard).toHaveLength(8);
    expect(demoWorkspace.storyboard.map((shot) => shot.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
