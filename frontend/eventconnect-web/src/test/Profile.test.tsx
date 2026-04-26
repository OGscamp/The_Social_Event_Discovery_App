import { render, screen, waitFor } from "@testing-library/react";
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
});
