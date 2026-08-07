// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toDataURL } = vi.hoisted(() => ({ toDataURL: vi.fn() }));

vi.mock("qrcode", () => ({ default: { toDataURL } }));
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

import { EnrollmentSetupPanel } from "./enrollment-setup-panel";

describe("EnrollmentSetupPanel", () => {
  beforeEach(() => {
    toDataURL.mockResolvedValue("data:image/png;base64,qr");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        setupUrl: "https://app.example.test/kiosk/setup?token=redacted-test-value",
        expiresAt: "2026-08-05T12:00:00.000Z",
        sessionId: "00000000-0000-4000-8000-000000000000",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { state: "issued" } }), { status: 200 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("creates and encodes a setup link only after explicit action", async () => {
    render(<EnrollmentSetupPanel kioskId="00000000-0000-4000-8000-000000000000" kioskName="Lobby" open onClose={vi.fn()} />);

    await screen.findByText("Create setup link");
    fireEvent.click(screen.getByRole("button", { name: "Create setup link" }));

    await waitFor(() => expect(toDataURL).toHaveBeenCalledWith(
      "https://app.example.test/kiosk/setup?token=redacted-test-value",
      { width: 360, margin: 2, errorCorrectionLevel: "M" },
    ));
    expect(await screen.findByRole("img", { name: "QR code for this kiosk setup link" })).toBeTruthy();
    expect(screen.getByText(/only time this setup link is shown/i)).toBeTruthy();
  });
});