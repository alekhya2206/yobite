// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveGoal, saveSession, newSession, upsertPlace, getSession, completeOnboarding } from "@/lib/storage";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace }),
}));

import Home from "./page";

beforeEach(() => {
  localStorage.clear();
  // Home gates on onboarding; mark onboarded so it renders for these tests.
  completeOnboarding([]);
  push.mockClear();
  replace.mockClear();
});

describe("Home", () => {
  it("redirects to onboarding on first run (not onboarded)", () => {
    localStorage.clear(); // wipe the onboarded flag seeded in beforeEach
    render(<Home />);
    expect(replace).toHaveBeenCalledWith("/onboarding");
    expect(screen.queryByText(/hungry/i)).not.toBeInTheDocument();
  });

  it("shows the universal goal label on the goal card", () => {
    saveGoal({ id: "high-protein" });
    render(<Home />);
    expect(screen.getByText(/high protein/i)).toBeInTheDocument();
  });

  it("shows no active-session card when there is no session", () => {
    render(<Home />);
    expect(screen.queryByText(/dining now/i)).not.toBeInTheDocument();
  });

  it("shows the active dining card when a session exists", () => {
    saveSession(newSession("Chili's", ["Grilled Chicken", "Dal Tadka"]));
    render(<Home />);
    expect(screen.getByText(/dining now/i)).toBeInTheDocument();
    expect(screen.getByText(/chili's/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to your picks/i })).toHaveAttribute("href", "/order");
  });

  it("shows 'New here?' hint when storage is empty (first-run state)", () => {
    render(<Home />);
    expect(screen.getByText(/new here/i)).toBeInTheDocument();
  });

  it("hides the first-run hint once a place exists", () => {
    upsertPlace({ name: "Punjabi Dhaba", dishes: ["Paneer Tikka"], lastVisited: 1 });
    render(<Home />);
    expect(screen.queryByText(/new here/i)).not.toBeInTheDocument();
  });

  it("hides the first-run hint when a session is active", () => {
    saveSession(newSession("Chili's", ["Grilled Chicken"]));
    render(<Home />);
    expect(screen.queryByText(/new here/i)).not.toBeInTheDocument();
  });

  it("revisits the last place without re-scanning and routes to intent", async () => {
    const user = userEvent.setup();
    upsertPlace({ name: "Punjabi Dhaba", dishes: ["Paneer Tikka", "Dal Makhani"], lastVisited: 1 });
    render(<Home />);
    await user.click(screen.getByRole("button", { name: /punjabi dhaba/i }));
    expect(getSession()?.dishes).toEqual(["Paneer Tikka", "Dal Makhani"]);
    expect(push).toHaveBeenCalledWith("/intent");
  });
});
