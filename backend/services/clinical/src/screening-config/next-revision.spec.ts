import { nextRevision } from './screening-config.service';

describe('nextRevision (RN08)', () => {
  it.each([
    ['2026.1-demo', '2026.1-demo.r2'],
    ['2026.1-demo.r2', '2026.1-demo.r3'],
    ['2026.1-demo.r9', '2026.1-demo.r10'],
  ])('%s → %s', (current, next) => {
    expect(nextRevision(current)).toBe(next);
  });
});
