import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatThread({
  uid,
  kind,
  asAdmin,
}: { uid: string; kind: "support" | "chat"; asAdmin?: boolean }) {
  const { user } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const messagesCol = kind === "support" ? "support_messages" : "chat_messages";
  const threadsCol = kind === "support" ? "support_threads" : "chat_threads";

  useEffect(() => {
    if (!uid) return;
    const db = getDb();
    const q = query(collection(db, messagesCol, uid, "messages"), orderBy("created_at_ms", "asc"), limit(200));
    const unsub = onSnapshot(q, (s) => {
      setMessages(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, (err) => {
      toast.error(err?.message || "Chat load failed");
    });
    return () => unsub();
  }, [uid, messagesCol]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      const db = getDb();
      const now = Date.now();
      const fromAdmin = !!asAdmin;
      const senderName = userProfile?.username || userProfile?.name || user.email || "User";
      const body = text.trim();
      await setDoc(
        doc(db, threadsCol, uid),
        {
          user_id: uid,
          ...(fromAdmin ? {} : { username: senderName }),
          last_message: body,
          last_from_admin: fromAdmin,
          updated_at: serverTimestamp(),
          created_at_ms: now,
        },
        { merge: true },
      );

      await addDoc(collection(db, messagesCol, uid, "messages"), {
        text: body,
        from_admin: fromAdmin,
        sender_uid: user.id,
        sender_name: senderName,
        created_at: serverTimestamp(),
        created_at_ms: now,
      });
      setText("");
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/40 bg-background/40 p-3 max-h-[55vh]">
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground">No messages yet. Say hi 👋</p>}
        {messages.map((m) => {
          const mine = asAdmin ? m.from_admin : !m.from_admin;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-[var(--gradient-primary)] text-primary-foreground" : "bg-secondary text-foreground"}`}>
                <p className="text-[10px] opacity-80">
                  {m.from_admin ? "Admin" : (m.sender_name || "User")}
                  {!m.from_admin && asAdmin && <span className="ml-1 opacity-70">· UID {String(m.sender_uid || uid).slice(0, 12)}</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                <p className="text-[9px] opacity-60">{fmtWhen(m.created_at_ms || m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={asAdmin ? "Reply as admin…" : "Type your message…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button onClick={send} disabled={sending || !text.trim()} aria-label="Send message" className="bg-[var(--gradient-primary)] glow-primary">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

function fmtWhen(v: any): string {
  const ms = tsMs(v);
  return ms ? new Date(ms).toLocaleString() : "—";
}