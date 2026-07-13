import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

type Announcement = {
  title?: string;
  message?: string;
  enabled?: boolean;
  updated_at_ms?: number;
};

const LS_KEY = "ffbpl_announcement_seen";

export function AnnouncementModal() {
  const [data, setData] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = onSnapshot(doc(getDb(), "app_settings", "announcement"), (snap) => {
      const d = (snap.data() as Announcement) || null;
      setData(d);
      if (!d || !d.enabled || !(d.message || "").trim()) {
        setOpen(false);
        return;
      }
      const seen = localStorage.getItem(LS_KEY);
      const stamp = String(d.updated_at_ms ?? 0);
      if (seen !== stamp) setOpen(true);
    });
    return () => unsub();
  }, []);

  const dismiss = () => {
    if (data?.updated_at_ms != null) {
      localStorage.setItem(LS_KEY, String(data.updated_at_ms));
    }
    setOpen(false);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? dismiss() : setOpen(true))}>
      <DialogContent className="glass neon-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {data.title?.trim() || "Announcement"}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-sm text-foreground/90">
            {data.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={dismiss} className="bg-[var(--gradient-primary)] glow-primary w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}