import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Shield, Trophy, Wallet, Pencil, LifeBuoy, MessageSquare, Search, Minus, Receipt, Trash2, UserCircle2, Palette, Plus, Link as LinkIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, increment,
  limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { ALL_PRESETS, FAVORITE_PRESETS, applyTheme, setPublicTheme, type ThemePreset } from "@/lib/themes";
import { ChatThread } from "@/components/chat-thread";

// applyTheme re-exported from "@/lib/themes" via import above

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — FFPBL MATCH" },
      { name: "description", content: "FFPBL MATCH admin console for managing tournaments, deposits, withdrawals, and users." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/dashboard" });
  }, [user, isAdmin, loading, navigate]);

  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [allTournaments, setAllTournaments] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const db = getDb();
    const u1 = onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending")), (s) =>
      setPendingDeposits(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedAsc)));
    const u2 = onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (s) =>
      setPendingWithdrawals(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedAsc)));
    const u3 = onSnapshot(query(collection(db, "wallet_transactions"), limit(500)), (s) =>
      setAllTxns(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc)));
    const u4 = onSnapshot(collection(db, "tournaments"), (s) =>
      setAllTournaments(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byTournamentDesc)));
    return () => { u1(); u2(); u3(); u4(); };
  }, [isAdmin]);

  const approveDeposit = async (d: any) => {
    try {
      const db = getDb();
      await updateDoc(doc(db, "users", d.user_id), { balance: increment(Number(d.amount)) });
      await updateDoc(doc(db, "deposits", d.id), { status: "approved", reviewed_at: serverTimestamp() });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: d.user_id, type: "deposit", amount: Number(d.amount),
        description: `${d.method} deposit approved`, created_at: serverTimestamp(), created_at_ms: Date.now(),
      });
      await notifyUser(d.user_id, "Deposit approved", `৳${d.amount} added to your wallet`, "/wallet", "wallet");
      toast.success("Deposit approved");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const approveWithdrawal = async (w: any) => {
    try {
      const db = getDb();
      const uref = doc(db, "users", w.user_id);
      const snap = await getDoc(uref);
      const bal = Number((snap.data() as any)?.balance ?? 0);
      if (bal < Number(w.amount)) return toast.error("User has insufficient balance");
      await updateDoc(uref, { balance: increment(-Number(w.amount)) });
      await updateDoc(doc(db, "withdrawals", w.id), { status: "approved", reviewed_at: serverTimestamp() });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: w.user_id, type: "withdrawal", amount: -Number(w.amount),
        description: `${w.method} withdrawal to ${w.phone}`, created_at: serverTimestamp(), created_at_ms: Date.now(),
      });
      await notifyUser(w.user_id, "Withdrawal approved", `৳${w.amount} withdrawal approved`, "/wallet", "wallet");
      toast.success("Withdrawal approved");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const rejectDeposit = async (id: string) => {
    try {
      const db = getDb();
      const snap = await getDoc(doc(db, "deposits", id));
      await updateDoc(doc(db, "deposits", id), { status: "rejected", reviewed_at: serverTimestamp() });
      const d = snap.data() as any;
      if (d?.user_id) await notifyUser(d.user_id, "Deposit rejected", `৳${d.amount} deposit was rejected`, "/wallet", "wallet");
      toast.success("Rejected");
    }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const rejectWithdrawal = async (id: string) => {
    try {
      const db = getDb();
      const snap = await getDoc(doc(db, "withdrawals", id));
      await updateDoc(doc(db, "withdrawals", id), { status: "rejected", reviewed_at: serverTimestamp() });
      const w = snap.data() as any;
      if (w?.user_id) await notifyUser(w.user_id, "Withdrawal rejected", `৳${w.amount} withdrawal was rejected`, "/wallet", "wallet");
      toast.success("Rejected");
    }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const [creating, setCreating] = useState(false);
  const handleCreateTournament = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCreating(true);
    try {
      await addDoc(collection(getDb(), "tournaments"), {
        title: String(fd.get("title") || "Untitled tournament"),
        game: String(fd.get("game") || "Free Fire"),
        mode: String(fd.get("mode") || "Solo"),
        map: String(fd.get("map") || "") || null,
        entry_fee: Number(fd.get("entry_fee") || 0),
        prize_pool: Number(fd.get("prize_pool") || 0),
        prize_first: Number(fd.get("prize_first") || 0),
        prize_second: Number(fd.get("prize_second") || 0),
        prize_third: Number(fd.get("prize_third") || 0),
        total_slots: Number(fd.get("total_slots") || 0),
        joined_slots: 0,
        start_time: new Date(String(fd.get("start_time"))).toISOString(),
        description: String(fd.get("description") || "") || null,
        status: "upcoming",
        has_room: false,
        created_at: serverTimestamp(),
        created_at_ms: Date.now(),
        updated_at: serverTimestamp(),
      });
      toast.success("Tournament created");
      (e.target as HTMLFormElement).reset();
    } catch (e: any) {
      toast.error(e?.message || "Tournament create failed");
    } finally {
      setCreating(false);
    }
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border flex items-center gap-3 rounded-2xl p-5">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Console</h1>
      </div>

      <Tabs defaultValue="deposits" className="mt-6">
        <div className="space-y-3">
          <div>
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wallet</div>
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="deposits"><Wallet className="mr-1 h-3 w-3" /> Deposits ({pendingDeposits?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="withdrawals"><Wallet className="mr-1 h-3 w-3" /> Withdrawals ({pendingWithdrawals?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="txns"><Receipt className="mr-1 h-3 w-3" /> Transactions</TabsTrigger>
            </TabsList>
          </div>
          <div>
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tournaments</div>
            <TabsList className="grid w-full grid-cols-2 gap-1">
              <TabsTrigger value="manage"><Trophy className="mr-1 h-3 w-3" /> Manage</TabsTrigger>
              <TabsTrigger value="new"><Trophy className="mr-1 h-3 w-3" /> New</TabsTrigger>
            </TabsList>
          </div>
          <div>
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Community</div>
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="players"><UserCircle2 className="mr-1 h-3 w-3" /> Players</TabsTrigger>
              <TabsTrigger value="support"><LifeBuoy className="mr-1 h-3 w-3" /> Support</TabsTrigger>
              <TabsTrigger value="chat"><MessageSquare className="mr-1 h-3 w-3" /> Chat</TabsTrigger>
            </TabsList>
          </div>
          <div>
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Appearance</div>
            <TabsList className="grid w-full grid-cols-1 gap-1">
              <TabsTrigger value="theme"><Palette className="mr-1 h-3 w-3" /> Theme</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="deposits" className="mt-4 space-y-2">
          {(pendingDeposits ?? []).length === 0 && <Empty msg="No pending deposits." />}
          {(pendingDeposits ?? []).map((d) => (
            <Row key={d.id}
              title={`৳${d.amount} via ${d.method}`}
              sub={`${d.username || ""} · ${d.phone} · TXN: ${d.transaction_id}`}
              onApprove={() => approveDeposit(d)}
              onReject={() => rejectDeposit(d.id)}
              onDelete={async () => {
                if (!confirm("Delete this deposit record?")) return;
                try { await deleteDoc(doc(getDb(), "deposits", d.id)); toast.success("Deleted"); }
                catch (e: any) { toast.error(e?.message || "Failed"); }
              }} />
          ))}
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4 space-y-2">
          {(pendingWithdrawals ?? []).length === 0 && <Empty msg="No pending withdrawals." />}
          {(pendingWithdrawals ?? []).map((w) => (
            <Row key={w.id}
              title={`৳${w.amount} via ${w.method}`}
              sub={`${w.username || ""} · Send to ${w.phone}`}
              onApprove={() => approveWithdrawal(w)}
              onReject={() => rejectWithdrawal(w.id)}
              onDelete={async () => {
                if (!confirm("Delete this withdrawal record?")) return;
                try { await deleteDoc(doc(getDb(), "withdrawals", w.id)); toast.success("Deleted"); }
                catch (e: any) { toast.error(e?.message || "Failed"); }
              }} />
          ))}
        </TabsContent>

        <TabsContent value="manage" className="mt-4 space-y-2">
          {allTournaments.length === 0 && <Empty msg="No tournaments yet." />}
          {allTournaments.map((t) => (
            <TournamentRow key={t.id} t={t} />
          ))}
        </TabsContent>

        <TabsContent value="support">
          <SupportAdmin />
        </TabsContent>

        <TabsContent value="chat">
          <ChatAdmin />
        </TabsContent>

        <TabsContent value="players">
          <PlayersDirectory />
        </TabsContent>

        <TabsContent value="theme">
          <ThemeManager />
        </TabsContent>

        <TabsContent value="txns" className="mt-4 space-y-2">
          {(allTxns ?? []).length === 0 && <Empty msg="No transactions yet." />}
          {(allTxns ?? []).map((t) => {
            const positive = Number(t.amount) >= 0;
            return (
              <div key={t.id} className="glass flex items-center justify-between gap-3 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{String(t.type || "").replace(/_/g, " ")}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.description ?? "—"}</p>
                  <code className="text-[10px] text-muted-foreground">UID: {t.user_id}</code>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className={`font-bold ${positive ? "text-primary" : "text-destructive"}`}>
                      {positive ? "+" : ""}৳{Number(t.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtWhen(t.created_at_ms || t.created_at)}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Delete this transaction record?")) return;
                    try { await deleteDoc(doc(getDb(), "wallet_transactions", t.id)); toast.success("Deleted"); }
                    catch (e: any) { toast.error(e?.message || "Failed"); }
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="new">
          <form onSubmit={handleCreateTournament} className="glass mt-4 space-y-3 rounded-xl p-5">
            <F name="title" label="Title" />
            <div className="grid grid-cols-3 gap-3">
              <Sel name="game" label="Game" options={["Free Fire", "PUBG", "COD", "Valorant"]} />
              <Sel name="mode" label="Mode" options={["Solo", "Duo", "Squad"]} />
              <F name="map" label="Map" required={false} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F name="entry_fee" label="Entry fee (৳)" type="number" />
              <F name="prize_pool" label="Prize pool (৳)" type="number" />
              <F name="prize_first" label="1st prize" type="number" />
              <F name="prize_second" label="2nd prize" type="number" />
              <F name="prize_third" label="3rd prize" type="number" />
              <F name="total_slots" label="Total slots" type="number" />
            </div>
            <F name="start_time" label="Start time" type="datetime-local" />
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" name="description" rows={3} className="flex w-full rounded-md border border-input bg-background p-2 text-sm" />
            </div>
            <Button disabled={creating} className="w-full bg-[var(--gradient-primary)] glow-primary">
              {creating ? "Creating…" : "Create tournament"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
function Row({ title, sub, onApprove, onReject, onDelete }: { title: string; sub: string; onApprove: () => void; onReject: () => void; onDelete?: () => void }) {
  return (
    <div className="glass flex items-center justify-between rounded-xl p-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
        <Button size="sm" onClick={onApprove} className="bg-[var(--gradient-primary)] glow-primary">Approve</Button>
        {onDelete && <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
      </div>
    </div>
  );
}
function F({ name, label, type = "text", required = true }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}
function Sel({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TournamentRow({ t }: { t: any }) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [pwd, setPwd] = useState("");
  const [status, setStatus] = useState(t.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getDoc(doc(getDb(), "tournament_secrets", t.id)).then((s) => {
      if (cancelled) return;
      const d = s.data() as any;
      setRoomId(d?.room_id ?? "");
      setPwd(d?.room_password ?? "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, t.id]);

  const save = async () => {
    setSaving(true);
    try {
      const db = getDb();
      await setDoc(doc(db, "tournament_secrets", t.id), {
        room_id: roomId || null,
        room_password: pwd || null,
        updated_at: serverTimestamp(),
      }, { merge: true });
      await updateDoc(doc(getDb(), "tournaments", t.id), {
        status,
        has_room: !!(roomId && pwd),
        updated_at: serverTimestamp(),
      });
      toast.success("Updated — visible to joined players");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try {
      await deleteDoc(doc(getDb(), "tournaments", t.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{t.title}</p>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">{t.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.game} · {t.mode} · {t.joined_slots}/{t.total_slots} · {new Date(t.start_time).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/tournaments/$id" params={{ id: t.id }}>
            <Button size="sm" variant="ghost">View</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Room ID</Label>
              <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="e.g. 12345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Room Password</Label>
              <Input value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="e.g. arena123" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {["upcoming", "live", "full", "completed", "cancelled"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="bg-[var(--gradient-primary)] glow-primary flex-1">
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button size="sm" variant="destructive" onClick={remove}>Delete</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Room ID & password automatically appear to joined participants on the tournament page.</p>
        </div>
      )}
    </div>
  );
}

function PlayersDirectory() {
  const [players, setPlayers] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    const db = getDb();
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc));
      setLoading(false);
    }, (err) => {
      toast.error(err?.message || "Failed to load users");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = players.filter((p) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      (p.username || "").toLowerCase().includes(t) ||
      (p.name || "").toLowerCase().includes(t) ||
      (p.email || "").toLowerCase().includes(t) ||
      (p.uid || p.id || "").toLowerCase().includes(t) ||
      (p.gaming_uid || "").toLowerCase().includes(t)
    );
  });

  const remove = async (uid: string, name: string) => {
    if (!confirm(`Delete player profile "${name}" from directory? (Auth account not deleted)`)) return;
    try {
      await deleteDoc(doc(getDb(), "users", uid));
      toast.success("Player removed from directory");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const adjust = async (uid: string, name: string, delta: number) => {
    if (!delta) return toast.error("Enter an amount");
    if (delta < 0 && !confirm(`Remove ৳${Math.abs(delta)} from ${name}?`)) return;
    try {
      const db = getDb();
      await setDoc(doc(db, "users", uid), { balance: increment(delta) }, { merge: true });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: uid,
        type: delta > 0 ? "admin_credit" : "admin_debit",
        amount: delta,
        description: delta > 0 ? `Admin added ৳${delta}` : `Admin removed ৳${Math.abs(delta)}`,
        created_at: serverTimestamp(),
        created_at_ms: Date.now(),
      });
      await notifyUser(
        uid,
        delta > 0 ? "Money added" : "Money removed",
        delta > 0 ? `Admin added ৳${delta} to your wallet` : `Admin removed ৳${Math.abs(delta)} from your wallet`,
        "/wallet",
        "wallet",
      );
      toast.success(delta > 0 ? `+৳${delta} credited` : `-৳${Math.abs(delta)} debited`);
      setAmounts((a) => ({ ...a, [uid]: "" }));
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="glass rounded-xl p-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username, email, or UID" />
        <span className="text-xs text-muted-foreground shrink-0">{filtered.length} / {players.length}</span>
      </div>

      {loading && <Empty msg="Loading players…" />}
      {!loading && filtered.length === 0 && <Empty msg="No players registered yet." />}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{p.username || p.name || "Unnamed"}</p>
                  {p.role && p.role !== "user" && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">{p.role}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.email || "—"}</p>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>Auto UID: <code className="text-foreground/80">{p.uid || p.id}</code></span>
                  <span>Gaming UID: <code className="text-foreground/80">{p.gaming_uid || "—"}</code></span>
                  <span>Rank: {p.rank || "Rookie"}</span>
                  <span>Balance: ৳{Number(p.balance || 0).toLocaleString()}</span>
                  <span>Wins: {p.wins ?? 0}</span>
                  <span>Matches: {p.matches_played ?? 0}</span>
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={() => remove(p.id, p.username || p.name || "player")}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
              <Input
                type="number"
                min="1"
                value={amounts[p.id] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))}
                placeholder="৳ amount"
                className="h-8 w-32"
              />
              <Button size="sm" className="bg-[var(--gradient-primary)] glow-primary"
                onClick={() => adjust(p.id, p.username || p.name || "player", Number(amounts[p.id] || 0))}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => adjust(p.id, p.username || p.name || "player", -Number(amounts[p.id] || 0))}>
                <Minus className="mr-1 h-3 w-3" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}
function byCreatedDesc(a: any, b: any) {
  return tsMs(b.created_at_ms ?? b.created_at) - tsMs(a.created_at_ms ?? a.created_at);
}
function byTournamentDesc(a: any, b: any) {
  return new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime();
}
function byCreatedAsc(a: any, b: any) {
  return tsMs(a.created_at_ms ?? a.created_at) - tsMs(b.created_at_ms ?? b.created_at);
}
function fmtWhen(v: any): string {
  const ms = tsMs(v);
  return ms ? new Date(ms).toLocaleString() : "—";
}

async function notifyUser(userId: string, title: string, body: string, link: string, type: string) {
  try {
    await addDoc(collection(getDb(), "notifications"), {
      user_id: userId,
      title,
      body,
      link,
      type,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });
  } catch {
    // Notification failure should never block admin actions.
  }
}

/* ---------- Theme Manager (public, broadcast to all users) ---------- */

function ThemeManager() {
  const [active, setActive] = useState<string>("none");
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getDb();
    const unsub = onSnapshot(doc(db, "app_settings", "theme"), (s) => {
      const id = (s.data() as any)?.id;
      setActive(id || "none");
    });
    return () => unsub();
  }, []);

  const pick = async (id: string) => {
    setSaving(true);
    try {
      await setPublicTheme(id === "none" ? null : id);
      setActive(id);
      toast.success(id === "none" ? "Default theme restored for everyone" : `Theme broadcast to all users`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save theme");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ALL_PRESETS;
    return ALL_PRESETS.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [filter]);

  return (
    <div className="mt-4 space-y-4">
      <div className="glass neon-border rounded-xl p-4 space-y-2">
        <p className="text-sm">
          Pick a theme — it will instantly recolor the website <b>for every visitor</b>.
          Choose <b>None</b> to restore the original Cyber Violet look.
        </p>
        <p className="text-xs text-muted-foreground">{ALL_PRESETS.length} themes available · {FAVORITE_PRESETS.length} favorites pinned at top</p>
        <div className="flex gap-2">
          <Input placeholder="Filter themes (e.g. neon, dark, blue)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Button variant="outline" disabled={saving} onClick={() => pick("none")}>Reset to default</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ThemeCard
          active={active === "none"}
          onClick={() => pick("none")}
          name="None (Default)"
          subtitle="Cyber Violet — original"
          swatch={["#1a0d2e", "#7c3aed", "#22d3ee", "#f5f3ff"]}
        />
        {filtered.map((p) => (
          <ThemeCard
            key={p.id}
            active={active === p.id}
            onClick={() => pick(p.id)}
            name={p.name}
            subtitle={p.id}
            swatch={p.swatch}
            preset={p}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  active, onClick, name, subtitle, swatch, preset,
}: { active: boolean; onClick: () => void; name: string; subtitle: string; swatch: string[]; preset?: ThemePreset }) {
  return (
    <button
      onClick={onClick}
      className={`glass rounded-xl p-4 text-left transition hover:glow-primary ${active ? "neon-border" : ""}`}
    >
      <p className="font-semibold truncate">{name}</p>
      <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
      <div className="mt-3 flex h-10 overflow-hidden rounded-lg">
        {swatch.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      {preset && (
        <div
          className="mt-3 rounded-lg p-3 text-xs"
          style={{
            background: swatch[1],
            color: swatch[3],
            border: `1px solid ${swatch[2]}`,
          }}
        >
          <span style={{ color: swatch[2], fontWeight: 700 }}>FFPBL MATCH</span> sample card
        </div>
      )}
    </button>
  );
}

/* ---------- Support (admin): manage links + 1-to-1 chat threads ---------- */

function SupportAdmin() {
  const [link, setLink] = useState("");
  const [label, setLabel] = useState("");
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [openUid, setOpenUid] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    const u1 = onSnapshot(doc(db, "app_settings", "support"), (s) => {
      setLinks(((s.data() as any)?.links as any[]) || []);
    });
    const u2 = onSnapshot(collection(db, "support_threads"), (s) => {
      setThreads(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc));
    });
    return () => { u1(); u2(); };
  }, []);

  const addLink = async () => {
    if (!link.trim()) return toast.error("Enter a URL");
    try {
      await setDoc(
        doc(getDb(), "app_settings", "support"),
        { links: arrayUnion({ label: label.trim() || link.trim(), url: link.trim() }) },
        { merge: true },
      );
      setLink(""); setLabel("");
      toast.success("Link added — visible to all users");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const removeLink = async (l: { label: string; url: string }) => {
    try {
      await setDoc(doc(getDb(), "app_settings", "support"), { links: arrayRemove(l) }, { merge: true });
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Support links</h3>
        </div>
        <p className="text-xs text-muted-foreground">Links shown to every user on their Support page (Facebook, WhatsApp, Telegram, etc.).</p>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Label (e.g. WhatsApp)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="col-span-2" placeholder="https://wa.me/8801957941250" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        <Button onClick={addLink} className="bg-[var(--gradient-primary)] glow-primary"><Plus className="mr-1 h-3 w-3" /> Add link</Button>
        <div className="space-y-1">
          {links.length === 0 && <p className="text-xs text-muted-foreground">No links yet.</p>}
          {links.map((l, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{l.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{l.url}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeLink(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </div>

      <ThreadList
        title="Support conversations"
        threads={threads}
        openUid={openUid}
        onOpen={setOpenUid}
        kind="support"
      />
    </div>
  );
}

/* ---------- Chat (admin): public chat threads ---------- */

function ChatAdmin() {
  const [threads, setThreads] = useState<any[]>([]);
  const [openUid, setOpenUid] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    const u = onSnapshot(collection(db, "chat_threads"), (s) => {
      setThreads(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc));
    });
    return () => u();
  }, []);

  return (
    <div className="mt-4">
      <ThreadList
        title="User chat threads"
        threads={threads}
        openUid={openUid}
        onOpen={setOpenUid}
        kind="chat"
      />
    </div>
  );
}

function ThreadList({
  title, threads, openUid, onOpen, kind,
}: { title: string; threads: any[]; openUid: string | null; onOpen: (uid: string | null) => void; kind: "support" | "chat" }) {
  return (
    <div className="grid gap-3 md:grid-cols-[280px,1fr]">
      <div className="glass rounded-xl p-3 space-y-1 max-h-[60vh] overflow-y-auto">
        <h3 className="px-1 pb-2 text-sm font-semibold text-muted-foreground">{title} ({threads.length})</h3>
        {threads.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>}
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t.user_id || t.id)}
            className={`w-full rounded-md px-3 py-2 text-left transition hover:bg-secondary ${openUid === (t.user_id || t.id) ? "bg-secondary" : ""}`}
          >
            <p className="text-sm font-medium truncate">{t.username || "user"}</p>
            <p className="text-[10px] text-muted-foreground truncate">UID: {t.user_id || t.id}</p>
            {t.last_message && <p className="mt-1 truncate text-xs text-muted-foreground">{t.last_message}</p>}
          </button>
        ))}
      </div>
      <div className="glass rounded-xl p-3 min-h-[60vh] flex flex-col">
        {openUid ? (
          <ChatThread uid={openUid} kind={kind} asAdmin />
        ) : (
          <div className="m-auto text-sm text-muted-foreground">Select a conversation to read & reply.</div>
        )}
      </div>
    </div>
  );
}

