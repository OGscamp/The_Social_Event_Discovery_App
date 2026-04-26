import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Attendees from "../pages/Attendees";

// Mock global fetch, matching the pattern used in RSVPButton.test.tsx
global.fetch = vi.fn();

function renderAtEvent(eventId: string) {
  return render(
    <MemoryRouter initialEntries={[`/events/${eventId}/attendees`]}>
      <Routes>
        <Route path="/events/:id/attendees" element={<Attendees />} />
      </Routes>
    </MemoryRouter>
  );
}

const buildOkResponse = (attendees: any[], count?: number) => ({
  ok: true,
  status: 200,
  json: async () => ({
    event_id: "evt-1",
    attendee_count: count ?? attendees.length,
    attendees,
  }),
});

describe("Attendees page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loading skeleton while fetching", async () => {
    // Return a slow-resolving response so we can see the loading state
    (fetch as any).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(buildOkResponse([])), 100)
        )
    );

    renderAtEvent("evt-1");

    expect(screen.getAllByTestId("attendee-skeleton").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a real attendee list returned by the backend", async () => {
    (fetch as any).mockResolvedValueOnce(
      buildOkResponse([
        {
          event_id: "evt-1",
          user_id: 1,
          display_name: "Sofia Chen",
          status: "going",
          joined_at: "2026-04-01T00:00:00Z",
        },
        {
          event_id: "evt-1",
          user_id: 2,
          display_name: "Marcus Johnson",
          status: "interested",
          joined_at: "2026-04-02T00:00:00Z",
        },
      ])
    );

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(screen.getByText("Sofia Chen")).toBeInTheDocument();
    });
    expect(screen.getByText("Marcus Johnson")).toBeInTheDocument();
    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByText("Interested")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/events/evt-1/attendees");
  });

  it("renders initials from the display name when no avatar is returned", async () => {
    (fetch as any).mockResolvedValueOnce(
      buildOkResponse([
        {
          event_id: "evt-1",
          user_id: 9,
          display_name: "Aisha Patel",
          status: "going",
          joined_at: "2026-04-02T00:00:00Z",
        },
      ])
    );

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(screen.getByText("Aisha Patel")).toBeInTheDocument();
    });
    expect(screen.getByText("AP")).toBeInTheDocument();
  });

  it("falls back to 'Anonymous' when display_name is null", async () => {
    (fetch as any).mockResolvedValueOnce(
      buildOkResponse([
        {
          event_id: "evt-1",
          user_id: 7,
          display_name: null,
          status: "going",
          joined_at: "2026-04-02T00:00:00Z",
        },
      ])
    );

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(screen.getByText("Anonymous")).toBeInTheDocument();
    });
  });

  it("shows the empty state when the event has no attendees", async () => {
    (fetch as any).mockResolvedValueOnce(buildOkResponse([]));

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(
        screen.getByText(/no one has responded yet/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId("attendee-skeleton").length).toBe(0);
  });

  it("shows a not-found state when the backend returns 404", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Event not found" }),
    });

    renderAtEvent("evt-missing");

    await waitFor(() => {
      expect(screen.getByText(/event not found/i)).toBeInTheDocument();
    });
  });

  it("shows an error alert when the backend returns 500", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /could not load attendees/i
      );
    });
  });

  it("shows an error alert when fetch rejects (network failure)", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("network down"));

    renderAtEvent("evt-1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
