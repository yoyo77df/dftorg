import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Shield, Trophy, Wallet, Pencil, LifeBuoy, MessageSquare, Search, Minus, Receipt, Trash2, UserCircle2, Palette, Plus, Link as LinkIcon, Megaphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth, type Role } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, increment,
  limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { ALL_PRESETS, FAVORITE_PRESETS, applyTheme, setPublicTheme, type ThemePreset } from "@/lib/themes";
import { ChatThread } from "@/components/chat-thread";

// applyTheme re-exported from "@/lib/themes" via import above

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — FFBPL MATCH" },
      { name: "description", content: "FFBPL MATCH admin console for managing tournaments, deposits, withdrawals, and users." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const navigate = useNavigate();
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [canClaimAdmin, setCanClaimAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || !user || isAdmin) {
      setCheckingOwner(false);
      setCanClaimAdmin(false);
      return;
    }
    let alive = true;
    getDoc(doc(getDb(), "app_settings", "site_owner"))
      .then((snap) => {
        if (!alive) return;
        setCanClaimAdmin(!snap.exists());
        setCheckingOwner(false);
      })
      .catch(() => {
        if (!alive) return;
        setCanClaimAdmin(false);
        setCheckingOwner(false);
      });
    return () => { alive = false; };
  }, [loading, user, isAdmin]);

  const claimAdmin = async () => {
    if (!user) return;
    try {
      const db = getDb();
      await setDoc(doc(db, "users", user.id), { role: "admin" }, { merge: true });
      await setDoc(doc(db, "app_settings", "site_owner"), {
        owner_uid: user.id,
        owner_email: user.email ?? userProfile?.email ?? null,
        created_at: serverTimestamp(),
        created_at_ms: Date.now(),
      });
      await user.getIdToken(true);
      toast.success("Admin access enabled. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast.error(e?.message || "Admin setup failed");
    }
  };

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
      const amt = Number(d.amount);
      await runTransaction(db, async (tx) => {
        const depRef = doc(db, "deposits", d.id);
        const depSnap = await tx.get(depRef);
        if (!depSnap.exists()) throw new Error("Deposit not found");
        if ((depSnap.data() as any).status !== "pending") throw new Error("Already processed");
        tx.update(doc(db, "users", d.user_id), { balance: increment(amt) });
        tx.update(depRef, { status: "approved", reviewed_at: serverTimestamp() });
      });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: d.user_id, type: "deposit", amount: amt,
        description: `${d.method} deposit approved`, created_at: serverTimestamp(), created_at_ms: Date.now(),
      });
      await notifyUser(d.user_id, "Deposit approved", `৳${d.amount} added to your wallet`, "/wallet", "wallet");
      toast.success("Deposit approved");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };
  const approveWithdrawal = async (w: any) => {
    try {
      const db = getDb();
      const amt = Number(w.amount);
      const uref = doc(db, "users", w.user_id);
      const wref = doc(db, "withdrawals", w.id);
      await runTransaction(db, async (tx) => {
        const wSnap = await tx.get(wref);
        if (!wSnap.exists()) throw new Error("Withdrawal not found");
        if ((wSnap.data() as any).status !== "pending") throw new Error("Already processed");
        const uSnap = await tx.get(uref);
        const bal = Number((uSnap.data() as any)?.balance ?? 0);
        if (bal < amt) throw new Error("User has insufficient balance");
        tx.update(uref, { balance: increment(-amt) });
        tx.update(wref, { status: "approved", reviewed_at: serverTimestamp() });
      });
      await addDoc(collection(db, "wallet_transactions"), {
        user_id: w.user_id, type: "withdrawal", amount: -amt,
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
        start_time: bdLocalToISO(String(fd.get("start_time"))),
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

  if (loading || checkingOwner) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading admin…</div>;
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-md px-4 py-10">
        <div className="glass neon-border rounded-2xl p-6 text-center">
          <Shield className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Admin setup</h1>
          {canClaimAdmin ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">No site owner is set yet. Make this account the admin to unlock the panel.</p>
              <Button onClick={claimAdmin} className="mt-5 w-full bg-[var(--gradient-primary)] glow-primary">Make me admin</Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">This account does not have admin access.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border flex items-center gap-3 rounded-2xl p-5">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Console</h1>
      </div>

      <Tabs defaultValue="deposits" className="mt-6">
        <div className="grid grid-cols-[minmax(160px,220px)_1fr] gap-4">
          <aside className="space-y-3">
            <div>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wallet</div>
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="deposits"><Wallet className="mr-2 h-3 w-3" /> Deposits ({pendingDeposits?.length ?? 0})</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="withdrawals"><Wallet className="mr-2 h-3 w-3" /> Withdrawals ({pendingWithdrawals?.length ?? 0})</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="txns"><Receipt className="mr-2 h-3 w-3" /> Transactions</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="limits"><Wallet className="mr-2 h-3 w-3" /> Limits</TabsTrigger>
              </TabsList>
            </div>
            <div>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tournaments</div>
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="manage"><Trophy className="mr-2 h-3 w-3" /> Manage</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="new"><Trophy className="mr-2 h-3 w-3" /> New</TabsTrigger>
              </TabsList>
            </div>
            <div>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Community</div>
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="players"><UserCircle2 className="mr-2 h-3 w-3" /> Players</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="support"><LifeBuoy className="mr-2 h-3 w-3" /> Support</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="chat"><MessageSquare className="mr-2 h-3 w-3" /> Chat</TabsTrigger>
              </TabsList>
            </div>
            <div>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Appearance</div>
              <TabsList className="flex h-auto w-full flex-col gap-1 bg-transparent p-0">
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="theme"><Palette className="mr-2 h-3 w-3" /> Theme</TabsTrigger>
                <TabsTrigger className="w-full justify-start px-2 py-2 text-xs sm:text-sm" value="announcement"><Megaphone className="mr-2 h-3 w-3" /> Announcement</TabsTrigger>
              </TabsList>
            </div>
          </aside>
          <div className="min-w-0">

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

        <TabsContent value="announcement">
          <AnnouncementManager />
        </TabsContent>

        <TabsContent value="limits">
          <LimitsManager />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Sel name="game" label="Game" options={["Free Fire", "PUBG", "COD", "Valorant"]} />
              <Sel name="mode" label="Mode" options={["Solo", "Duo", "Squad"]} />
              <F name="map" label="Map" required={false} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
function Row({ title, sub, onApprove, onReject, onDelete }: { title: string; sub: string; onApprove: () => void; onReject: () => void; onDelete?: () => void }) {
  return (
    <div className="glass flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="break-words text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
        <Button size="sm" variant="outline" onClick={onReject} className="px-2">Reject</Button>
        <Button size="sm" onClick={onApprove} className="bg-[var(--gradient-primary)] px-2 glow-primary">Approve</Button>
        {onDelete && <Button size="sm" variant="destructive" onClick={onDelete} className="px-2"><Trash2 className="h-3 w-3" /></Button>}
      </div>
    </div>
  );
}

function AnnouncementManager() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(getDb(), "app_settings", "announcement"), (snap) => {
      const d = (snap.data() as any) || {};
      setTitle(d.title ?? "");
      setMessage(d.message ?? "");
      setEnabled(!!d.enabled);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const save = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      await setDoc(doc(getDb(), "app_settings", "announcement"), {
        title: title.trim() || null,
        message: message.trim(),
        enabled: nextEnabled && !!message.trim(),
        updated_at: serverTimestamp(),
        updated_at_ms: Date.now(),
      }, { merge: true });
      setEnabled(nextEnabled && !!message.trim());
      toast.success(nextEnabled ? "Announcement published" : "Announcement saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="glass mt-4 rounded-xl p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="glass mt-4 space-y-4 rounded-xl p-5">
      <div>
        <h2 className="text-lg font-semibold">Site Announcement</h2>
        <p className="text-xs text-muted-foreground">
          Shown as a popup the first time each visitor opens the site. Users see it again whenever you update the message.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ann_title">Title (optional)</Label>
        <Input id="ann_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New tournament live!" maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ann_message">Message</Label>
        <textarea
          id="ann_message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={800}
          placeholder="Write the announcement visitors should see…"
          className="flex w-full rounded-md border border-input bg-background p-2 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">{message.length}/800</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <p className="text-sm font-medium">Status</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Live — visitors will see this popup." : "Hidden — nothing will pop up."}
          </p>
        </div>
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {enabled ? "Live" : "Off"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save(false)}>
          {saving ? "Saving…" : "Save & hide"}
        </Button>
        <Button disabled={saving || !message.trim()} onClick={() => save(true)} className="bg-[var(--gradient-primary)] glow-primary">
          {saving ? "Saving…" : "Publish"}
        </Button>
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
  const [manualTeam, setManualTeam] = useState("");
  const [manualIgl, setManualIgl] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  const addManualParticipant = async () => {
    const team = manualTeam.trim();
    const igl = manualIgl.trim();
    if (!team || !igl) return toast.error("Team name and IGL name required");
    setAddingManual(true);
    try {
      const db = getDb();
      const manualId = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(db, "tournament_participants", `${t.id}_${manualId}`), {
        tournament_id: t.id,
        user_id: manualId,
        team_name: team,
        igl_name: igl,
        manual: true,
        added_by_admin: true,
        joined_at: serverTimestamp(),
        joined_at_ms: Date.now(),
      });
      await updateDoc(doc(db, "tournaments", t.id), {
        joined_slots: increment(1),
        updated_at: serverTimestamp(),
      });
      toast.success(`Added ${team} to the slot`);
      setManualTeam("");
      setManualIgl("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add participant");
    } finally {
      setAddingManual(false);
    }
  };

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
            {t.game} · {t.mode} · {t.joined_slots}/{t.total_slots} · {fmtBD(t.start_time)}
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

          <div className="mt-4 border-t border-border/60 pt-4 space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Add participant manually</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input value={manualTeam} onChange={(e) => setManualTeam(e.target.value)} placeholder="Team name" maxLength={40} />
              <Input value={manualIgl} onChange={(e) => setManualIgl(e.target.value)} placeholder="IGL name" maxLength={40} />
            </div>
            <Button size="sm" onClick={addManualParticipant} disabled={addingManual} variant="outline" className="w-full">
              <Plus className="mr-1 h-3 w-3" /> {addingManual ? "Adding…" : "Add to slot"}
            </Button>
            <p className="text-[11px] text-muted-foreground">Manually added entries occupy a slot but aren't tied to a wallet.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayersDirectory() {
  const { currentUser } = useFirebaseAuth();
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

  const changeRole = async (uid: string, role: Role) => {
    if (uid === currentUser?.uid && role !== "admin") {
      toast.error("You can't remove your own admin access");
      return;
    }
    try {
      await setDoc(doc(getDb(), "users", uid), { role }, { merge: true });
      toast.success(role === "admin" ? "User is now admin" : `Role changed to ${role}`);
    } catch (e: any) {
      toast.error(e?.message || "Role update failed");
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
                <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
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
              <select
                value={p.role || "user"}
                onChange={(e) => changeRole(p.id, e.target.value as Role)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="user">user</option>
                <option value="mod">mod</option>
                <option value="admin">admin</option>
              </select>
              {p.role !== "admin" && (
                <Button size="sm" variant="outline" onClick={() => changeRole(p.id, "admin")}>
                  <Shield className="mr-1 h-3 w-3" /> Make admin
                </Button>
              )}
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
  return ms ? fmtBD(ms) : "—";
}

// Convert a <input type="datetime-local"> value entered as Bangladesh time
// (Asia/Dhaka, UTC+6, no DST) into a correct UTC ISO string. Prevents wrong
// stored times when the admin's browser is not in BD.
function bdLocalToISO(local: string): string {
  if (!local) return new Date().toISOString();
  // Interpret the local string as if it were UTC, then shift back by +06:00.
  const asUtc = new Date(local + ":00Z").getTime();
  if (isNaN(asUtc)) return new Date(local).toISOString();
  return new Date(asUtc - 6 * 60 * 60 * 1000).toISOString();
}

// Bangladesh time (Asia/Dhaka), day-month-year order, 12-hour with AM/PM.
// e.g. "13 Jul 2026, 10:00 PM"
export function fmtBD(v: any): string {
  const ms = tsMs(v);
  if (!ms) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(new Date(ms));
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${g("day")} ${g("month")} ${g("year")}, ${g("hour")}:${g("minute")} ${g("dayPeriod").toUpperCase()}`;
  } catch {
    return new Date(ms).toISOString();
  }
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
  return <ThemeManagerInner />;
}

function LimitsManager() {
  const [minDeposit, setMinDeposit] = useState<string>("50");
  const [minWithdraw, setMinWithdraw] = useState<string>("50");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const db = getDb();
    const unsub = onSnapshot(doc(db, "app_settings", "limits"), (s) => {
      const d = (s.data() as any) || {};
      setMinDeposit(String(d.min_deposit ?? 50));
      setMinWithdraw(String(d.min_withdraw ?? 50));
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const save = async () => {
    const md = Number(minDeposit);
    const mw = Number(minWithdraw);
    if (!(md > 0)) return toast.error("Minimum deposit must be greater than 0");
    if (!(mw > 0)) return toast.error("Minimum withdraw must be greater than 0");
    setSaving(true);
    try {
      await setDoc(
        doc(getDb(), "app_settings", "limits"),
        { min_deposit: md, min_withdraw: mw, updated_at: serverTimestamp() },
        { merge: true },
      );
      toast.success("Limits updated — users can only deposit / withdraw at or above these amounts");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="glass neon-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Deposit &amp; Withdraw limits</h3>
          <p className="text-xs text-muted-foreground">
            Set the minimum amount a user can deposit or withdraw. Users cannot submit a
            request below these values.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="min_deposit">Minimum deposit (৳)</Label>
            <Input id="min_deposit" type="number" min="1" value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)} disabled={!loaded} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min_withdraw">Minimum withdraw (৳)</Label>
            <Input id="min_withdraw" type="number" min="1" value={minWithdraw}
              onChange={(e) => setMinWithdraw(e.target.value)} disabled={!loaded} />
          </div>
        </div>
        <Button onClick={save} disabled={saving || !loaded}
          className="bg-[var(--gradient-primary)] glow-primary">
          {saving ? "Saving…" : "Save limits"}
        </Button>
      </div>
    </div>
  );
}

function ThemeManagerInner() {
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
          <span style={{ color: swatch[2], fontWeight: 700 }}>FFBPL MATCH</span> sample card
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

