import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LifeBuoy, ExternalLink } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { ChatThread } from "@/components/chat-thread";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — FFPBL MATCH" },
      { name: "description", content: "Get help from the FFPBL MATCH team. Live chat with admin and find official support links." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    const unsub = onSnapshot(doc(getDb(), "app_settings", "support"), (s) => {
      setLinks(((s.data() as any)?.links as any[]) || []);
    });
    return () => unsub();
  }, []);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="glass neon-border rounded-2xl p-6 flex items-center gap-3">
        <LifeBuoy className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">Chat with our team — replies are private to you.</p>
        </div>
      </div>

      {links.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Official links</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass flex items-center justify-between rounded-lg border border-border/40 p-3 transition hover:border-primary hover:glow-primary"
              >
                <span className="font-medium">{l.label}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Live chat with admin</h2>
        <ChatThread uid={user.id} kind="support" />
      </div>
    </div>
  );
}