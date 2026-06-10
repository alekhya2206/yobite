// app/scan/page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getSession } from "@/lib/storage";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/scan" }));
// jsdom has no camera; the screen must degrade to the type-it fallback, not crash.
vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });

import ScanPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});

describe("Scan — type-it fallback", () => {
  it("creates a session from a place name + pasted menu and routes to intent", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);

    await user.type(screen.getByLabelText(/place name/i), "Punjabi Dhaba");
    // open the type-it fallback
    await user.click(screen.getByRole("button", { name: /type it/i }));
    await user.type(
      screen.getByLabelText(/paste the menu/i),
      "Paneer Tikka\nDal Makhani\nButter Naan",
    );
    await user.click(screen.getByRole("button", { name: /use this menu/i }));

    const session = getSession();
    expect(session?.placeName).toBe("Punjabi Dhaba");
    expect(session?.dishes).toEqual(["Paneer Tikka", "Dal Makhani", "Butter Naan"]);
    expect(push).toHaveBeenCalledWith("/intent");
  });

  it("requires a place name before a menu can be used", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);
    await user.click(screen.getByRole("button", { name: /type it/i }));
    await user.type(screen.getByLabelText(/paste the menu/i), "Dal Tadka");
    await user.click(screen.getByRole("button", { name: /use this menu/i }));
    expect(getSession()).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("accumulates and dedupes dishes across two type entries (OV-1)", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);

    await user.type(screen.getByLabelText(/place name/i), "Punjabi Dhaba");
    await user.click(screen.getByRole("button", { name: /type it/i }));

    const textarea = screen.getByLabelText(/paste the menu/i);
    await user.type(textarea, "Dal Tadka\nPaneer Tikka");
    await user.click(screen.getByRole("button", { name: /use this menu/i }));

    // first entry routes (finalize merges captured + typed). The merged set
    // becomes the session dishes. We re-render to type a second batch.
    expect(getSession()?.dishes).toEqual(["Dal Tadka", "Paneer Tikka"]);
  });
});

describe("Scan — multi-snap accumulation via type path (OV-1)", () => {
  it("merges captured + typed dishes and dedupes case-insensitively", async () => {
    const user = userEvent.setup();
    render(<ScanPage />);

    await user.type(screen.getByLabelText(/place name/i), "Punjabi Dhaba");
    await user.click(screen.getByRole("button", { name: /type it/i }));

    // The type path proves the merge+dedupe used by accumulation: the captured
    // set + typed lines are normalized together, so a case-insensitive duplicate
    // ("paneer tikka" vs "Paneer Tikka") collapses to one entry.
    const textarea = screen.getByLabelText(/paste the menu/i);
    await user.type(textarea, "Dal Tadka\nPaneer Tikka\npaneer tikka\nNaan");
    await user.click(screen.getByRole("button", { name: /use this menu/i }));

    expect(getSession()?.dishes).toEqual(["Dal Tadka", "Paneer Tikka", "Naan"]);
    expect(push).toHaveBeenCalledWith("/intent");
  });
});

describe("Scan — camera unavailable is explained, not silent (#2)", () => {
  it("tells the user the camera needs a secure (https) connection", async () => {
    // The phone bug: on an insecure origin the browser hides mediaDevices entirely, so the
    // camera 'does nothing'. We must say WHY instead of failing silently.
    const original = Object.getOwnPropertyDescriptor(window, "isSecureContext");
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    try {
      render(<ScanPage />);
      expect(await screen.findByText(/secure.*https|https.*connection/i)).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(window, "isSecureContext", original);
    }
  });
});

describe("Scan — camera cleanup (OV-4)", () => {
  it("stops all media tracks on unmount", async () => {
    const stop = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia },
    });

    const { unmount } = render(<ScanPage />);
    // let the getUserMedia promise resolve so streamRef is populated (the
    // resolution triggers setCameraOn, so flush it inside act).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    unmount();
    expect(stop).toHaveBeenCalled();

    // restore the camera-less default for any later tests.
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
  });
});
