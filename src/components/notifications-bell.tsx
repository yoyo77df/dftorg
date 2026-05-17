import { useEffect, useState, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
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

  // Ask for browser notification permission once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load existing + subscribe
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!cancelled && data) setItems(data as Notif[]);
    })();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notif;
          if (n.user_id && n.user_id !== user.id) return;
          setItems((prev) => [n, ...prev].slice(0, 30));
          // In-app toast
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link
              ? {
                  label: "View",
                  onClick: () => navigate({ to: n.link! }),
                }
              : undefined,
          });
          // Native browser/mobile notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible"
          ) {
            try {
              const native = new Notification(n.title, {
                body: n.body ?? "",
                icon: "/favicon.ico",
                tag: n.id,
              });
              native.onclick = () => {
                window.focus();
                if (n.link) navigate({ to: n.link });
              };
            } catch {}
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const unread = items.filter(
    (n) => new Date(n.created_at).getTime() > seenAtRef.current,
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
                  if (n.link) navigate({ to: n.link });
                }}
                className="block w-full border-b border-border/40 p-3 text-left text-sm transition hover:bg-secondary/50"
              >
                <p className="font-semibold">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
