// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  it("stores the raw mood on the session and routes to the verdict", async () => {
    const user = userEvent.setup();
    saveSession(newSession("Chili's", ["Grilled Chicken", "Dal Tadka"]));
    render(<IntentPage />);

    await user.type(screen.getByLabelText(/mood/i), "I want something high in carbs");
    await user.type(screen.getByLabelText(/eaten/i), "2 eggs at breakfast");
    await user.click(screen.getByRole("button", { name: /find my pick/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/order"));
    const session = getSession();
    expect(session?.mood).toBe("I want something high in carbs");
    expect(session?.ateToday).toBe("2 eggs at breakfast");
    expect(session?.verdict).toBeUndefined();
  });

  it("skip stores the universal goal phrased as a mood", async () => {
    const user = userEvent.setup();
    saveGoal({ id: "high-protein" });
    saveSession(newSession("Chili's", ["Grilled Chicken"]));
    render(<IntentPage />);

    await user.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/order"));
    expect(getSession()?.mood).toMatch(/protein/i);
  });

  it("redirects home when there is no active session", () => {
    render(<IntentPage />);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
