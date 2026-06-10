// lib/useVoiceInput.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// OV-4: capture BOTH args (onResult + onEnd) so we can simulate the full lifecycle
const listeners: {
  onResult: (t: string, f: boolean) => void;
  onEnd: () => void;
} = {
  onResult: () => {},
  onEnd: () => {},
};

vi.mock("@/lib/voice", () => ({
  speechSupported: () => true,
  listenOnce: (onResult: (t: string, f: boolean) => void, onEnd: () => void) => {
    listeners.onResult = onResult;
    listeners.onEnd = onEnd;
    return { stop: () => {} };
  },
}));

import { useVoiceInput } from "./useVoiceInput";

describe("useVoiceInput", () => {
  it("starts listening and forwards a final transcript", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onFinal));
    expect(result.current.listening).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => listeners.onResult("grilled chicken", true));
    expect(onFinal).toHaveBeenCalledWith("grilled chicken");
  });

  it("ignores interim (non-final) results", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onFinal));
    act(() => result.current.start());
    act(() => listeners.onResult("grill", false));
    expect(onFinal).not.toHaveBeenCalled();
  });

  // OV-4: onEnd resets listening to false
  it("resets listening to false when speech ends", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onFinal));
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => listeners.onEnd());
    expect(result.current.listening).toBe(false);
  });
});
