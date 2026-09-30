import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution until delayMs has elapsed', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 200);

    debounced('hello');
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('hello');
  });

  it('coalesces multiple calls and uses latest arguments', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 300);

    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(150);
    debounced('third');

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
  });

  it('cancels scheduled invocations when cancel() is called', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 200);

    debounced('test');
    vi.advanceTimersByTime(100);
    debounced.cancel();

    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it('immediately triggers pending invocation when flush() is called', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 500);

    debounced('immediate-test');
    expect(callback).not.toHaveBeenCalled();

    debounced.flush();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('immediate-test');

    // Subsequent timer expiry should not call it again
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
