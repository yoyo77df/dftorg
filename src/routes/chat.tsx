import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";
import { ChatThread } from "@/components/chat-thread";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — FFPBL MATCH" },
      { name: "description", content: "Direct chat with the FFPBL MATCH team. Your messages are private." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user, loading } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="glass neon-border rounded-2xl p-6 flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-gradient font-semibold">{userProfile?.username || userProfile?.name || user.email}</span>
            {" · "}UID: <code className="text-foreground/70">{user.id.slice(0, 12)}…</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Only you and the admin can see this conversation.</p>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <ChatThread uid={user.id} kind="chat" />
      </div>
    </div>
  );
}