import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "./LandingPage";

afterEach(cleanup);

describe("Rocky landing page", () => {
  it("explains the product, audience, and 20-hour journey", () => {
    render(<LandingPage onOpenWorkspace={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "Practice for the interview you actually want.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The Journey of Rocky" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Students & freshers")).toBeInTheDocument();
    expect(screen.getByText("Working professionals")).toBeInTheDocument();
    expect(screen.getByText("Hour 18—20")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Watch demo" })[0],
    ).toHaveAttribute("href", "#demo-video");
  });

  it("opens the Rocky workspace from the primary call to action", async () => {
    const onOpenWorkspace = vi.fn();
    render(<LandingPage onOpenWorkspace={onOpenWorkspace} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Start practising" }),
    );

    expect(onOpenWorkspace).toHaveBeenCalledOnce();
  });
});
