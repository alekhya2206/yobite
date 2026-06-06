// components/Deck.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Deck } from "./Deck";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Deck", () => {
  it("renders the four tabs and the Scan FAB", () => {
    render(<Deck />);
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scan/i })).toHaveAttribute("href", "/scan");
  });

  it("marks the current tab as active", () => {
    render(<Deck />);
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("aria-current", "page");
  });
});
