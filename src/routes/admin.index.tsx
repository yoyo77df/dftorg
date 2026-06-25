import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trophy, Wallet, Pencil, LifeBuoy, MessageSquare, Search, Minus, Receipt, Trash2, UserCircle2, Palette, Plus, Send, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, increment,
  limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { ALL_PRESETS, FAVORITE_PRESETS, applyTheme, setPublicTheme, type ThemePreset } from "@/lib/themes";

// applyTheme re-exported from "@/lib/themes" via import above

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — DFT ORG." },
      { name: "description", content: "DFT ORG. admin console for managing tournaments, deposits, withdrawals, and users." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/dashboard" });
  }, [user, isAdmin, loading, navigate]);

  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const db = getDb();
    const u1 = onSnapshot(query(collection(db, "deposits"), where("status", "==", "pending")), (s) =>
      setPendingDeposits(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedAsc)));
    const u2 = onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (s) =>
      setPendingWithdrawals(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedAsc)));
    const u3 = onSnapshot(query(collection(db, "wallet_transactions"), limit(500)), (s) =>
      setAllTxns(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc)));
    return () => { u1(); u2(); u3(); };
  }, [isAdmin]);

  const { data: allTournaments } = useQuery({
    queryKey: ["admin-tournaments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("*").order("start_time", { ascending: false });
      return data ?? [];
    },
  });

  const approveDeposit = async (d: any) => {
    try {
      const db = getDb();
      await updateDoc(doc(db, "users", d.user_id), { balance: increment(Number(d.amount)) });
      await updateDoc(doc(db, "deposits", d.id), { status: "approved", reviewed_at: serverTimestamp() });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: d.user_id, type: "deposit", amount: Number(d.amount),
        description: `${d.method} deposit approved`, created_at: serverTimestamp(), created_at_ms: Date.now(),
      });
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
      toast.success("Withdrawal approved");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const rejectDeposit = async (id: string) => {
    try { await updateDoc(doc(getDb(), "deposits", id), { status: "rejected", reviewed_at: serverTimestamp() }); toast.success("Rejected"); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const rejectWithdrawal = async (id: string) => {
    try { await updateDoc(doc(getDb(), "withdrawals", id), { status: "rejected", reviewed_at: serverTimestamp() }); toast.success("Rejected"); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const [creating, setCreating] = useState(false);
  const handleCreateTournament = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCreating(true);
    const { error } = await supabase.from("tournaments").insert({
      title: String(fd.get("title")),
      game: String(fd.get("game")),
      mode: String(fd.get("mode")),
      map: String(fd.get("map")) || null,
      entry_fee: Number(fd.get("entry_fee")),
      prize_pool: Number(fd.get("prize_pool")),
      prize_first: Number(fd.get("prize_first")),
      prize_second: Number(fd.get("prize_second")),
      prize_third: Number(fd.get("prize_third")),
      total_slots: Number(fd.get("total_slots")),
      start_time: new Date(String(fd.get("start_time"))).toISOString(),
      description: String(fd.get("description")) || null,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Tournament created");
    (e.target as HTMLFormElement).reset();
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border flex items-center gap-3 rounded-2xl p-5">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Console</h1>
      </div>

      <Tabs defaultValue="deposits" className="mt-6">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="deposits"><Wallet className="mr-1 h-3 w-3" /> Deposits ({pendingDeposits?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="withdrawals"><Wallet className="mr-1 h-3 w-3" /> Withdrawals ({pendingWithdrawals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="manage"><Trophy className="mr-1 h-3 w-3" /> Manage</TabsTrigger>
          <TabsTrigger value="new"><Trophy className="mr-1 h-3 w-3" /> New</TabsTrigger>
          <TabsTrigger value="support"><LifeBuoy className="mr-1 h-3 w-3" /> Support</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="mr-1 h-3 w-3" /> Chat</TabsTrigger>
          <TabsTrigger value="players"><UserCircle2 className="mr-1 h-3 w-3" /> Players</TabsTrigger>
          <TabsTrigger value="txns"><Receipt className="mr-1 h-3 w-3" /> Transactions</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="mr-1 h-3 w-3" /> Theme</TabsTrigger>
        </TabsList>

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
          {(allTournaments ?? []).length === 0 && <Empty msg="No tournaments yet." />}
          {(allTournaments ?? []).map((t) => (
            <TournamentRow key={t.id} t={t} qc={qc} />
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

function TournamentRow({ t, qc }: { t: any; qc: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState(t.room_id ?? "");
  const [pwd, setPwd] = useState(t.room_password ?? "");
  const [status, setStatus] = useState(t.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("tournaments").update({
      room_id: roomId || null,
      room_password: pwd || null,
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", t.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Updated — visible to joined players");
    qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
    qc.invalidateQueries({ queryKey: ["tournament", t.id] });
    setOpen(false);
  };

  const remove = async () => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
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
    let unsub: (() => void) | null = null;
    try {
      const qref = query(collection(db, "users"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qref, (snap) => {
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, () => {
        // fallback if no createdAt index
        const qref2 = collection(db, "users");
        unsub = onSnapshot(qref2, (snap) => {
          setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      });
    } catch {
      setLoading(false);
    }
    return () => { if (unsub) unsub(); };
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
      await updateDoc(doc(getDb(), "users", uid), { balance: increment(delta) });
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
