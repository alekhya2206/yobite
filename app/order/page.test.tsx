// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newSession, saveSession, getSession, clearSession } from "@/lib/storage";
import { rank } from "@/lib/ranker";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/order" }));

import OrderPage from "./page";

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  replace.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function seedSession() {
  saveSession({
    ...newSession("Chili's", ["Grilled Chicken Tikka", "Butter Chicken", "Gulab Jamun"]),
    goal: { id: "high-protein" },
  });
}

describe("Verdict poster", () => {
  it("ranks the session dishes and renders the hero pick", async () => {
    seedSession();
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken\nGulab Jamun", goal: { id: "high-protein" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));

    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    expect(screen.getByText(result.best!.name)).toBeInTheDocument();
  });

  it("End clears the session and routes home", async () => {
    seedSession();
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken", goal: { id: "high-protein" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));
    const user = userEvent.setup();

    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /end/i }));

    expect(getSession()).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects home when there is no active session", () => {
    render(<OrderPage />);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("renders the cached verdict instantly without calling the API", async () => {
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken", goal: { id: "high-protein" } });
    saveSession({ ...newSession("Chili's", ["Grilled Chicken Tikka", "Butter Chicken"]), goal: { id: "high-protein" }, verdict: result });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(result.best!.name)).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows an error with a working retry when ranking fails", async () => {
    seedSession();
    const fetchFn = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response);
    vi.stubGlobal("fetch", fetchFn);
    const user = userEvent.setup();
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/couldn.t rank/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("sends the diner's raw mood to the ranker (Architecture B)", async () => {
    saveSession({
      ...newSession("Chili's", ["Grilled Chicken", "Chicken Chow Mein"]),
      mood: "high carb, more rice",
    });
    const result = rank({ menuText: "Grilled Chicken\nChicken Chow Mein", goal: { id: "balanced" } });
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response);
    vi.stubGlobal("fetch", fetchFn);

    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.mood).toBe("high carb, more rice");
  });

  it("does not resurrect a session that was ended while the rank call was in flight", async () => {
    seedSession();
    const result = rank({ menuText: "Grilled Chicken Tikka\nButter Chicken", goal: { id: "high-protein" } });
    let resolveFetch: () => void = () => {};
    const fetchFn = vi.fn(
      () => new Promise<Response>((r) => { resolveFetch = () => r({ ok: true, json: async () => result } as unknown as Response); }),
    );
    vi.stubGlobal("fetch", fetchFn);

    render(<OrderPage />);
    await waitFor(() => expect(fetchFn).toHaveBeenCalled()); // request in flight
    clearSession(); // user tapped "End" before the response arrived
    resolveFetch();
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());

    // the resolved verdict must NOT write the cleared session back to storage
    expect(getSession()).toBeNull();
  });

  it("opens the Plan a full meal sheet with courses", async () => {
    seedSession();
    const result = rank({ menuText: "Paneer Tikka\nButter Chicken\nGulab Jamun", goal: { id: "balanced" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => result }) as unknown as Response));
    const user = userEvent.setup();
    render(<OrderPage />);
    await waitFor(() => expect(screen.getByText(/order this/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /plan a full meal/i }));
    expect(screen.getByRole("dialog", { name: /plan a full meal/i })).toBeInTheDocument();
    expect(screen.getByText(/dessert/i)).toBeInTheDocument();
  });
});
