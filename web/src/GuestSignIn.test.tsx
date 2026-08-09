import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuestSignIn } from "./GuestSignIn";

afterEach(cleanup);

describe("guest sign in", () => {
  it("presents a welcoming private-practice entry with the guest form", () => {
    render(<GuestSignIn onStarted={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "Bring the role. Rocky brings the rehearsal plan.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "A candidate preparing for an interview at home",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Tell us who you are" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start practising" }),
    ).toBeDisabled();
  });
});
