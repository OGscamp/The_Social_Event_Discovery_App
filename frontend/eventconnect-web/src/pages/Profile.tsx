import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Calendar,
  Trash2,
  Edit3,
  CheckCircle2,
  Star,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface ApiUser {
  id: number | string;
  email: string;
  name: string;
  created_at: string;
}

interface RsvpSummary {
  going: number;
  interested: number;
  not_going: number;
}

interface MeResponse {
  ok: boolean;
  user: ApiUser;
  rsvp_summary: RsvpSummary;
}

type LoadState = "loading" | "not-logged-in" | "error" | "ready";

function formatJoined(isoDate: string): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [state, setState] = useState<LoadState>("loading");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [summary, setSummary] = useState<RsvpSummary>({
    going: 0,
    interested: 0,
    not_going: 0,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const token = localStorage.getItem("token");
      if (!token) {
        setState("not-logged-in");
        return;
      }

      try {
        const res = await fetch("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          if (!cancelled) setState("not-logged-in");
          return;
        }

        if (!res.ok) {
          if (!cancelled) setState("error");
          return;
        }

        const data: MeResponse = await res.json();
        if (cancelled) return;

        setUser(data.user);
        setSummary(
          data.rsvp_summary ?? { going: 0, interested: 0, not_going: 0 }
        );
        setState("ready");
      } catch (err) {
        console.error("Error loading profile:", err);
        if (!cancelled) setState("error");
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRsvps = summary.going + summary.interested + summary.not_going;

  const stats = [
    {
      label: "Going",
      count: summary.going,
      icon: CheckCircle2,
      color: "text-[hsl(var(--success))]",
      bg: "bg-[hsl(var(--success))]/15",
    },
    {
      label: "Interested",
      count: summary.interested,
      icon: Star,
      color: "text-[hsl(var(--warning))]",
      bg: "bg-[hsl(var(--warning))]/15",
    },
    {
      label: "Declined",
      count: summary.not_going,
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/15",
    },
  ];

  // ---------- Loading ----------
  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="profile-loading"
        className="min-h-screen bg-background"
      >
        <p className="sr-only">Loading profile</p>
        <div className="h-32 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="container -mt-16 pb-12">
          <div className="flex animate-pulse flex-col items-center sm:flex-row sm:items-end sm:gap-6">
            <div className="h-28 w-28 rounded-2xl bg-secondary" />
            <div className="mt-4 flex-1 space-y-2 sm:mt-0">
              <div className="h-5 w-40 rounded bg-secondary" />
              <div className="h-3 w-64 rounded bg-secondary" />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Not Logged In ----------
  if (state === "not-logged-in") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-xl font-bold text-foreground">
          Not logged in
        </h2>
        <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
          You must be logged in to view your profile.
        </p>
        <Button
          onClick={() => navigate("/login")}
          className="mt-6 rounded-xl px-8 py-3"
        >
          Log in
        </Button>
      </div>
    );
  }

  // ---------- Error ----------
  if (state === "error") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-10">
          <div
            role="alert"
            className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive"
          >
            <AlertTriangle className="mb-2 h-6 w-6" />
            <p className="font-semibold">Could not load your profile</p>
            <p className="mt-1 text-sm">
              Something went wrong talking to the server. Please refresh the
              page or try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ready ----------
  if (!user) return null; // type guard — state is "ready" implies user is set

  const openEdit = () => {
    setEditName(user.name);
    setEditError(null);
    setEditOpen(true);
  };

  // Saves the edited display name via PATCH /auth/me. Closes BUG-S3-006:
  // before this PR the modal saved optimistically to localStorage only and
  // was overwritten on the next /auth/me fetch.
  const saveEdit = async () => {
    if (editSaving) return;
    setEditError(null);

    const trimmed = editName.trim();
    if (trimmed.length === 0) {
      setEditError("Name cannot be empty");
      return;
    }
    if (trimmed === user.name) {
      // Nothing changed — close the modal without a request.
      setEditOpen(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setEditError("Your session has expired. Please log in again.");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch("/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        // Validation errors (400) come back with a server-side message we
        // can surface inline; everything else gets a generic toast so the
        // modal can stay open for the user to retry.
        let serverMessage: string | undefined;
        try {
          const body = await res.json();
          serverMessage = body?.error;
        } catch {
          // ignore JSON parse failures — we'll fall through to generic copy
        }

        if (res.status === 400 && serverMessage) {
          setEditError(serverMessage);
        } else {
          toast({
            title: "Couldn't save your changes",
            description:
              serverMessage ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      const data: { ok: boolean; user: ApiUser } = await res.json();
      setUser(data.user);

      // Keep localStorage in sync so other tabs / a page reload see the
      // updated name immediately, before the next /auth/me round-trip.
      try {
        const raw = localStorage.getItem("user");
        const stored = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          "user",
          JSON.stringify({ ...stored, name: data.user.name })
        );
      } catch {
        // storage full or parse error — ignore
      }

      setEditOpen(false);
      toast({
        title: "Profile updated",
        description: "Your name has been updated.",
      });
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({
        title: "Couldn't save your changes",
        description:
          "Network error. Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    toast({
      title: "Account deleted",
      description: "You have been logged out.",
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-32 bg-gradient-to-br from-primary/20 via-background to-background" />

      <div className="container -mt-16 pb-12">
        <div className="flex flex-col items-center sm:flex-row sm:items-end sm:gap-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-background bg-secondary shadow-xl">
            <User className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="mt-4 text-center sm:mt-0 sm:text-left">
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
              <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                <Mail className="h-3.5 w-3.5" /> {user.email}
              </span>
              <span className="flex items-center justify-center gap-1.5 sm:justify-start">
                <Calendar className="h-3.5 w-3.5" /> Joined{" "}
                {formatJoined(user.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 text-center"
            >
              <div
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${s.bg}`}
              >
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {s.count}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Account Summary
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {totalRsvps === 0
              ? "You haven't RSVP'd to any events yet. Start exploring to find your next happening!"
              : `You have RSVP'd to ${totalRsvps} ${
                  totalRsvps === 1 ? "event" : "events"
                }. Keep exploring to discover more happenings near you!`}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={openEdit}
          >
            <Edit3 className="h-4 w-4" /> Edit Profile
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Your profile and RSVP history
                  will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) setEditError(null);
          setEditOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your display name below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (editError) setEditError(null);
                }}
                placeholder="Your name"
                aria-invalid={editError ? true : undefined}
                aria-describedby={editError ? "edit-name-error" : undefined}
                disabled={editSaving}
              />
              {editError && (
                <p
                  id="edit-name-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {editError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={editSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
