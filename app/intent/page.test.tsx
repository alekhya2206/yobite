// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newSession, saveSession, getSession, saveGoal } from "@/lib/storage";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/intent" }));

import IntentPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  replace.mockClear();
});

describe("Per-meal intent", () => {
  it("classifies typed intent onto the session and routes to the verdict", async () => {
    const user = userEvent.setup();
    saveSession(newSession("Chili's", ["Grilled Chicken", "Dal Tadka"]));
    render(<IntentPage />);

    await user.type(screen.getByLabelText(/mood/i), "something light, trying to cut");
    await user.type(screen.getByLabelText(/eaten/i), "rice and dal at lunch");
    await user.click(screen.getByRole("button", { name: /find my pick/i }));

    const session = getSession();
    expect(session?.goal.id).toBe("fat-loss");
    expect(session?.ateToday).toBe("rice and dal at lunch");
    expect(session?.verdict).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/order");
  });

  it("skips to the universal goal when nothing is typed", async () => {
    const user = userEvent.setup();
    saveGoal({ id: "high-protein" });
    saveSession(newSession("Chili's", ["Grilled Chicken"]));
    render(<IntentPage />);

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(getSession()?.goal.id).toBe("high-protein");
    expect(push).toHaveBeenCalledWith("/order");
  });

  it("redirects home when there is no active session", () => {
    render(<IntentPage />);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
