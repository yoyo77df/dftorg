import { useEffect, useState, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Notif = {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  created_at?: string;
  created_at_ms?: number;
  read_at: string | null;
};

const SEEN_KEY = "dft_notifs_seen_at";

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const seenAtRef = useRef<number>(
    typeof window !== "undefined"
      ? Number(localStorage.getItem(SEEN_KEY) ?? 0)
      : 0,
  );

  // Firestore notifications: no browser permission prompt, no UUID mismatch.
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    const q = query(collection(getDb(), "notifications"), where("user_id", "in", [user.id, "all"]), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Notif)
        .sort((a, b) => notifMs(b) - notifMs(a));
      setItems((prev) => {
        const previousIds = new Set(prev.map((n) => n.id));
        next.forEach((n) => {
          if (!previousIds.has(n.id) && notifMs(n) > seenAtRef.current) {
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.link
                ? {
                    label: "View",
                    onClick: () => navigate({ to: n.link as any }),
                  }
                : undefined,
            });
          }
        });
        return next;
      });
    }, () => {
      setItems([]);
    });
    return () => unsub();
  }, [user, navigate]);

  const unread = items.filter(
    (n) => notifMs(n) > seenAtRef.current,
  ).length;

  const markAllSeen = () => {
    seenAtRef.current = Date.now();
    if (typeof window !== "undefined") {
      localStorage.setItem(SEEN_KEY, String(seenAtRef.current));
    }
    setItems((p) => [...p]);
  };

  if (!user) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) markAllSeen();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <h3 className="text-sm font-bold">Notifications</h3>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllSeen}>
              <Check className="mr-1 h-3 w-3" /> Mark read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  if (n.link) navigate({ to: n.link as any });
                }}
                className="block w-full border-b border-border/40 p-3 text-left text-sm transition hover:bg-secondary/50"
              >
                <p className="font-semibold">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {timeAgo(notifMs(n))}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function notifMs(n: Notif) {
  if (typeof n.created_at_ms === "number") return n.created_at_ms;
  if (n.created_at) return new Date(n.created_at).getTime();
  return 0;
}

function timeAgo(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
