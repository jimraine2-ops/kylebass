import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { SafePauseBanner } from "./SafePauseBanner";

describe("SafePauseBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Safe-Exit banner before KST 9:00", () => {
    // KST 07:30 = UTC 22:30 (previous day)
    vi.setSystemTime(new Date("2026-04-01T22:30:00Z")); // KST 07:30
    render(<SafePauseBanner />);
    expect(screen.getByText(/Safe-Exit/)).toBeInTheDocument();
    expect(screen.getByText(/재개까지/)).toBeInTheDocument();
  });

  it("shows Day-Break banner at KST 9:00~9:05", () => {
    // KST 09:02 = UTC 00:02
    vi.setSystemTime(new Date("2026-04-02T00:02:00Z")); // KST 09:02
    render(<SafePauseBanner />);
    expect(screen.getByText(/Day-Break/)).toBeInTheDocument();
  });

  it("shows only Zero-Loss banner after KST 9:05", () => {
    // KST 09:10 = UTC 00:10
    vi.setSystemTime(new Date("2026-04-02T00:10:00Z")); // KST 09:10
    render(<SafePauseBanner />);
    expect(screen.getByText(/Zero-Loss/)).toBeInTheDocument();
    expect(screen.queryByText(/Safe-Exit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Day-Break/)).not.toBeInTheDocument();
  });

  it("countdown shows correct remaining time", () => {
    // KST 07:00 = UTC 22:00 → 2시간 0분 remaining
    vi.setSystemTime(new Date("2026-04-01T22:00:00Z"));
    render(<SafePauseBanner />);
    expect(screen.getByText(/2시간 0분/)).toBeInTheDocument();
  });
});
