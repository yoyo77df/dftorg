import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trophy, Wallet, Pencil, Users, Ban, Gift, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
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

  const { data: pendingDeposits } = useQuery({
    queryKey: ["admin-deposits"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("deposits").select("*").eq("status", "pending").order("created_at");
      return data ?? [];
    },
  });

  const { data: pendingWithdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("withdrawals").select("*").eq("status", "pending").order("created_at");
      return data ?? [];
    },
  });

  const { data: allTournaments } = useQuery({
    queryKey: ["admin-tournaments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("tournaments").select("*").order("start_time", { ascending: false });
      return data ?? [];
    },
  });

  const approveDeposit = async (id: string) => {
    const { error } = await supabase.rpc("approve_deposit", { _deposit_id: id });
    if (error) return toast.error(error.message);
    toast.success("Deposit approved");
    qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  };
  const approveWithdrawal = async (id: string) => {
    const { error } = await supabase.rpc("approve_withdrawal", { _withdrawal_id: id });
    if (error) return toast.error(error.message);
    toast.success("Withdrawal approved");
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  };
  const rejectDeposit = async (id: string) => {
    const { error } = await supabase.from("deposits").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  };
  const rejectWithdrawal = async (id: string) => {
    const { error } = await supabase.from("withdrawals").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
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
      created_by: user!.id,
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="deposits"><Wallet className="mr-1 h-3 w-3" /> Deposits ({pendingDeposits?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="withdrawals"><Wallet className="mr-1 h-3 w-3" /> Withdrawals ({pendingWithdrawals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="manage"><Trophy className="mr-1 h-3 w-3" /> Manage</TabsTrigger>
          <TabsTrigger value="new"><Trophy className="mr-1 h-3 w-3" /> New</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-1 h-3 w-3" /> Users</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4 space-y-2">
          {(pendingDeposits ?? []).length === 0 && <Empty msg="No pending deposits." />}
          {(pendingDeposits ?? []).map((d) => (
            <Row key={d.id}
              title={`৳${d.amount} via ${d.method}`}
              sub={`${d.phone} · TXN: ${d.transaction_id}`}
              onApprove={() => approveDeposit(d.id)}
              onReject={() => rejectDeposit(d.id)} />
          ))}
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4 space-y-2">
          {(pendingWithdrawals ?? []).length === 0 && <Empty msg="No pending withdrawals." />}
          {(pendingWithdrawals ?? []).map((w) => (
            <Row key={w.id}
              title={`৳${w.amount} via ${w.method}`}
              sub={`Send to ${w.phone}`}
              onApprove={() => approveWithdrawal(w.id)}
              onReject={() => rejectWithdrawal(w.id)} />
          ))}
        </TabsContent>

        <TabsContent value="manage" className="mt-4 space-y-2">
          {(allTournaments ?? []).length === 0 && <Empty msg="No tournaments yet." />}
          {(allTournaments ?? []).map((t) => (
            <TournamentRow key={t.id} t={t} qc={qc} />
          ))}
        </TabsContent>

        <TabsContent value="users">
          <UserManager />
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
function Row({ title, sub, onApprove, onReject }: { title: string; sub: string; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="glass flex items-center justify-between rounded-xl p-4">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
        <Button size="sm" onClick={onApprove} className="bg-[var(--gradient-primary)] glow-primary">Approve</Button>
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

function UserManager() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [prize, setPrize] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    const term = q.trim();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, gaming_uid, country, earnings, is_banned, wins, matches_played")
      .or(`gaming_uid.ilike.%${term}%,username.ilike.%${term}%,id.eq.${isUuid(term) ? term : "00000000-0000-0000-0000-000000000000"}`)
      .limit(20);
    setResults(data ?? []);
    setSearching(false);
  };

  const loadWallet = async (uid: string) => {
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", uid).maybeSingle();
    return data?.balance ?? 0;
  };

  const [bal, setBal] = useState<number | null>(null);
  useEffect(() => {
    if (selected) loadWallet(selected.id).then(setBal);
    else setBal(null);
  }, [selected]);

  const addPrize = async () => {
    const amt = Number(prize);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.rpc("admin_add_prize", { _user_id: selected.id, _amount: amt, _note: "Prize money" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`৳${amt} prize added`);
    setPrize("");
    loadWallet(selected.id).then(setBal);
    qc.invalidateQueries();
  };

  const toggleBan = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_ban", { _user_id: selected.id, _banned: !selected.is_banned });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(selected.is_banned ? "Account unbanned" : "Account banned");
    setSelected({ ...selected, is_banned: !selected.is_banned });
    setResults((r) => r.map((u) => (u.id === selected.id ? { ...u, is_banned: !selected.is_banned } : u)));
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="glass rounded-xl p-4">
        <Label>Search by Gaming UID, username, or User ID</Label>
        <div className="mt-2 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 1234567890 or playername"
            onKeyDown={(e) => e.key === "Enter" && search()} />
          <Button onClick={search} disabled={searching} className="bg-[var(--gradient-primary)] glow-primary">
            <Search className="mr-1 h-3 w-3" /> {searching ? "…" : "Search"}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((u) => (
            <button key={u.id} onClick={() => setSelected(u)}
              className={`glass w-full rounded-xl p-3 text-left transition hover:glow-primary ${selected?.id === u.id ? "neon-border" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{u.username} {u.is_banned && <span className="ml-1 text-xs text-destructive">[BANNED]</span>}</p>
                  <p className="text-xs text-muted-foreground">UID: {u.gaming_uid ?? "—"} · {u.wins}W / {u.matches_played}M · ৳{Number(u.earnings).toLocaleString()}</p>
                </div>
                <code className="text-[10px] text-muted-foreground">{u.id.slice(0, 8)}…</code>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="glass neon-border rounded-xl p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Selected user</p>
            <p className="font-bold">{selected.username}</p>
            <p className="text-xs">Wallet: <b>৳{Number(bal ?? 0).toLocaleString()}</b> · Earnings: ৳{Number(selected.earnings).toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Gift className="h-3 w-3" /> Add prize money</Label>
            <div className="flex gap-2">
              <Input type="number" min="1" value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="৳ amount" />
              <Button onClick={addPrize} disabled={busy} className="bg-[var(--gradient-primary)] glow-primary">Credit</Button>
            </div>
          </div>

          <Button variant={selected.is_banned ? "outline" : "destructive"} onClick={toggleBan} disabled={busy} className="w-full">
            <Ban className="mr-1 h-3 w-3" /> {selected.is_banned ? "Unban account" : "Ban account"}
          </Button>
        </div>
      )}
    </div>
  );
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}