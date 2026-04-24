import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Users, AlertTriangle, Search, X } from "lucide-react";

type AttendeeStatus = "going" | "interested" | "not_going";
type StatusFilter = "all" | AttendeeStatus;

interface ApiAttendee {
  event_id: string;
  user_id: string | number;
  display_name: string | null;
  status: AttendeeStatus;
  joined_at: string;
}

interface AttendeesResponse {
  event_id: string;
  attendee_count: number;
  attendees: ApiAttendee[];
}

type LoadState = "loading" | "ready" | "empty" | "not-found" | "error";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusLabel(status: AttendeeStatus): string {
  if (status === "going") return "Going";
  if (status === "interested") return "Interested";
  return "Not going";
}

// Label used in the filter chip UI — "Not going" is ungainly as a chip, so we
// surface it as "Declined" there (matches the Profile stats card copy).
function chipLabel(status: StatusFilter): string {
  if (status === "all") return "All";
  if (status === "going") return "Going";
  if (status === "interested") return "Interested";
  return "Declined";
}

const STATUS_CHIPS: StatusFilter[] = ["all", "going", "interested", "not_going"];

export default function Attendees() {
  const { id } = useParams();
  const [attendees, setAttendees] = useState<ApiAttendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");

  // Polish UI state — client-side only.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function fetchAttendees() {
      if (!id) {
        setState("not-found");
        return;
      }

      try {
        const res = await fetch(`/events/${id}/attendees`);

        if (res.status === 404) {
          if (!cancelled) setState("not-found");
          return;
        }

        if (!res.ok) {
          if (!cancelled) setState("error");
          return;
        }

        const data: AttendeesResponse = await res.json();
        if (cancelled) return;

        const list = Array.isArray(data.attendees) ? data.attendees : [];
        setAttendees(list);
        setAttendeeCount(
          typeof data.attendee_count === "number"
            ? data.attendee_count
            : list.length
        );
        setState(list.length === 0 ? "empty" : "ready");
      } catch (err) {
        console.error("Error fetching attendees:", err);
        if (!cancelled) setState("error");
      }
    }

    fetchAttendees();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Per-status counts computed once per attendees change so the chips can
  // show "(n)" without re-walking the list on every render.
  const statusCounts = useMemo(() => {
    const counts = { going: 0, interested: 0, not_going: 0 };
    for (const a of attendees) {
      if (a.status in counts) counts[a.status] += 1;
    }
    return counts;
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      // Match against the rendered name so users can search "Anonymous" and
      // find rows whose display_name is null.
      const name = (a.display_name || "Anonymous").toLowerCase();
      return name.includes(q);
    });
  }, [attendees, query, statusFilter]);

  const filtersActive = query.trim() !== "" || statusFilter !== "all";
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  const header = (
    <div className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link
          to={`/events/${id}`}
          aria-label="Back to event"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Attendees</h1>
          <p className="text-xs text-muted-foreground">
            {state === "ready" || state === "empty"
              ? `${attendeeCount} ${attendeeCount === 1 ? "person" : "people"} responded`
              : "Loading\u2026"}
          </p>
        </div>
      </div>
    </div>
  );

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div role="status" aria-live="polite" className="container py-6">
          <p className="sr-only">Loading attendees</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                data-testid="attendee-skeleton"
                className="flex animate-pulse items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="h-12 w-12 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-secondary" />
                  <div className="h-2 w-1/3 rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="container py-10">
          <div
            role="alert"
            className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive"
          >
            <AlertTriangle className="mb-2 h-6 w-6" />
            <p className="font-semibold">Could not load attendees</p>
            <p className="mt-1 text-sm">
              Something went wrong talking to the server. Please refresh the
              page or try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="container py-10">
          <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center">
            <Users className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">
              No one has responded yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to RSVP and attendees will show up here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ready ----------
  return (
    <div className="min-h-screen bg-background">
      {header}
      <div className="container py-6">
        <p className="mb-4 text-sm text-muted-foreground">
          {attendeeCount} {attendeeCount === 1 ? "person" : "people"} responded
        </p>

        {/* Filter bar */}
        <div
          data-testid="attendees-filter-bar"
          className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search attendees by name"
              placeholder="Search attendees"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by RSVP status"
            className="flex flex-wrap gap-2"
          >
            {STATUS_CHIPS.map((s) => {
              const active = statusFilter === s;
              const count =
                s === "all"
                  ? attendees.length
                  : statusCounts[s as AttendeeStatus];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={active}
                  data-testid={`chip-${s}`}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-surface-hover hover:text-foreground")
                  }
                >
                  {chipLabel(s)} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {filteredAttendees.length === 0 ? (
          <div
            data-testid="attendees-no-results"
            className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-border bg-card p-8 text-center"
          >
            <Users className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">No attendees match</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear the filters to see everyone.
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAttendees.map((a) => (
              <li
                key={`${a.event_id}-${a.user_id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-hover"
              >
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                >
                  {getInitials(a.display_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {a.display_name || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(a.status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
