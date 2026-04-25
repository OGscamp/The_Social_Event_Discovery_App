import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Profile from "../pages/Profile";

// Mock global fetch, matching the pattern used in RSVPButton.test.tsx
// and Attendees.test.tsx.
global.fetch = vi.fn();

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
}

const buildMeResponse = (
  overrides: Partial<{
    user: {
      id: number | string;
      email: string;
      name: string;
      created_at: string;
    };
    rsvp_summary: { going: number; interested: number; not_going: number };
  }> = {}
) => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    user: {
      id: 1,
      email: "alice@test.com",
      name: "Alice Rivera",
      created_at: "2026-01-15T00:00:00Z",
      ...(overrides.user ?? {}),
    },
    rsvp_summary: overrides.rsvp_summary ?? {
      going: 4,
      interested: 2,
      not_going: 1,
    },
  }),
});

describe("Profile page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("shows the loading skeleton while /auth/me is in flight", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(buildMeResponse()), 100)
        )
    );

    renderProfile();

    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders real user data returned by the backend", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce(buildMeResponse());

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    // Locale-agnostic — just confirm the month/year were formatted in.
    expect(screen.getByText(/Joined .*January.*2026/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake-token",
        }),
      })
    );
  });

  it("renders real RSVP summary counts from the backend", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce(
      buildMeResponse({
        rsvp_summary: { going: 7, interested: 3, not_going: 2 },
      })
    );

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    });
    expect(screen.getByText("7")).toBeInTheDocument(); // going
    expect(screen.getByText("3")).toBeInTheDocument(); // interested
    expect(screen.getByText("2")).toBeInTheDocument(); // declined
    expect(screen.getByText(/RSVP'd to 12 events/)).toBeInTheDocument();
  });

  it("shows the not-logged-in state when no token is present", async () => {
    // no token in localStorage
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/not logged in/i)).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the not-logged-in state when /auth/me returns 401 (stale token)", async () => {
    localStorage.setItem("token", "expired-token");
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid token" }),
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/not logged in/i)).toBeInTheDocument();
    });
  });

  it("shows the error alert when /auth/me returns 500", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load your profile/i
      );
    });
  });

  it("shows the error alert when fetch rejects (network failure)", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockRejectedValueOnce(new Error("network down"));

    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("uses friendly copy when the user has zero RSVPs", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce(
      buildMeResponse({
        rsvp_summary: { going: 0, interested: 0, not_going: 0 },
      })
    );

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/haven't RSVP'd to any events yet/i)
    ).toBeInTheDocument();
  });

  it("uses singular grammar when the user has exactly 1 RSVP", async () => {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce(
      buildMeResponse({
        rsvp_summary: { going: 1, interested: 0, not_going: 0 },
      })
    );

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText(/RSVP'd to 1 event\b/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/RSVP'd to 1 events/)).not.toBeInTheDocument();
  });

  // ─── PR 4: Edit Profile → PATCH /auth/me ──────────────────────────────────

  // Open the Profile page in a "ready" state and then open the Edit Profile
  // dialog. Returns nothing — assertions live in the individual tests.
  async function loadAndOpenEditModal() {
    localStorage.setItem("token", "fake-token");
    (fetch as any).mockResolvedValueOnce(buildMeResponse());

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit profile/i }));

    // Dialog content is portaled — wait for it to mount.
    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    });
  }

  it("TC-PRF-018: Edit modal opens pre-filled with the current user name", async () => {
    await loadAndOpenEditModal();

    const input = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    expect(input.value).toBe("Alice Rivera");
  });

  it("TC-PRF-019: happy path — PATCH /auth/me is called and the displayed name updates", async () => {
    await loadAndOpenEditModal();

    // Mock the PATCH response. Backend returns the updated user record so
    // the client doesn't need a follow-up /auth/me round-trip.
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        user: {
          id: 1,
          email: "alice@test.com",
          name: "Alice Renamed",
          created_at: "2026-01-15T00:00:00Z",
        },
      }),
    });

    const input = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Alice Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    // Verify the PATCH call shape.
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/auth/me",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            Authorization: "Bearer fake-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ name: "Alice Renamed" }),
        })
      );
    });

    // The header should reflect the new name.
    await waitFor(() => {
      expect(screen.getByText("Alice Renamed")).toBeInTheDocument();
    });
    // …and the old name should be gone.
    expect(screen.queryByText("Alice Rivera")).not.toBeInTheDocument();
  });

  it("TC-PRF-020: PATCH 400 surfaces the server message inline; modal stays open", async () => {
    await loadAndOpenEditModal();

    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Name cannot be empty" }),
    });

    const input = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    // Change to a different (non-empty client-side, but server rejects) value
    // so the client validator doesn't short-circuit before hitting fetch.
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      // Inline error rendered with role="alert" so assistive tech announces it.
      const alerts = screen
        .getAllByRole("alert")
        .map((el) => el.textContent ?? "");
      expect(alerts.some((t) => /name cannot be empty/i.test(t))).toBe(true);
    });

    // The modal should still be open — the input is still in the document.
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    // Name in the header should NOT have changed.
    expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
  });

  it("TC-PRF-021: empty / whitespace-only input is caught client-side without firing PATCH", async () => {
    await loadAndOpenEditModal();

    const input = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });

    // Snapshot the call count — only the initial /auth/me load should
    // have happened.
    const callsBeforeSave = (fetch as any).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const alerts = screen
        .getAllByRole("alert")
        .map((el) => el.textContent ?? "");
      expect(alerts.some((t) => /cannot be empty/i.test(t))).toBe(true);
    });

    // No additional fetch was made — client validation short-circuited.
    expect((fetch as any).mock.calls.length).toBe(callsBeforeSave);
  });
});
