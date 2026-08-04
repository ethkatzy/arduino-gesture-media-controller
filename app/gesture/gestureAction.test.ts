import { isDebounced, resolveGestureAction } from './gestureAction';

describe('resolveGestureAction', () => {
  it('maps left to togglePlay', () => {
    expect(resolveGestureAction('left')).toBe('togglePlay');
  });

  it('maps up to volumeUp', () => {
    expect(resolveGestureAction('up')).toBe('volumeUp');
  });

  it('maps down to volumeDown', () => {
    expect(resolveGestureAction('down')).toBe('volumeDown');
  });

  it('maps right to nextTrack', () => {
    expect(resolveGestureAction('right')).toBe('nextTrack');
  });

  it('returns null for an unrecognized gesture', () => {
    expect(resolveGestureAction('none')).toBeNull();
    expect(resolveGestureAction('')).toBeNull();
    expect(resolveGestureAction('diagonal')).toBeNull();
  });
});

describe('isDebounced', () => {
  it('suppresses the same gesture repeated within the debounce window', () => {
    expect(isDebounced('left', 1000, 'left', 1200)).toBe(true); // 200ms later
  });

  it('allows the same gesture once the debounce window has passed', () => {
    expect(isDebounced('left', 1000, 'left', 1400)).toBe(false); // 400ms later
  });

  it('does not debounce a different gesture, even immediately after', () => {
    expect(isDebounced('left', 1000, 'right', 1010)).toBe(false);
  });

  it('respects a custom debounce window', () => {
    expect(isDebounced('up', 1000, 'up', 1100, 500)).toBe(true);
    expect(isDebounced('up', 1000, 'up', 1600, 500)).toBe(false);
  });

  it('treats exactly the debounce boundary as no longer debounced', () => {
    expect(isDebounced('down', 1000, 'down', 1350, 350)).toBe(false);
  });
});
