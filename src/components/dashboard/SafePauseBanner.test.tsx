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
    vi.setSystemTime(new Date("2026-04-01T22:30:00Z")); // KST 07:30
    const { getByText } = render(<SafePauseBanner />);
    expect(getByText(/Safe-Exit/)).toBeInTheDocument();
    expect(getByText(/재개까지/)).toBeInTheDocument();
  });

  it("shows Day-Break banner at KST 9:00~9:05", () => {
    vi.setSystemTime(new Date("2026-04-02T00:02:00Z")); // KST 09:02
    const { getByText } = render(<SafePauseBanner />);
    expect(getByText(/Day-Break/)).toBeInTheDocument();
  });

  it("shows only defense banner after KST 9:05", () => {
    vi.setSystemTime(new Date("2026-04-02T00:10:00Z")); // KST 09:10
    const { getByText, queryByText } = render(<SafePauseBanner />);
    expect(getByText(/복리 방어/)).toBeInTheDocument();
    expect(queryByText(/Safe-Exit/)).not.toBeInTheDocument();
    expect(queryByText(/Day-Break/)).not.toBeInTheDocument();
  });

  it("countdown shows correct remaining time", () => {
    vi.setSystemTime(new Date("2026-04-01T22:00:00Z")); // KST 07:00
    const { getByText } = render(<SafePauseBanner />);
    expect(getByText(/2시간 0분/)).toBeInTheDocument();
  });
});
