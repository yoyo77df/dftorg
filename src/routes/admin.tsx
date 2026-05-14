import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trophy, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ArenaX" }] }),
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposits"><Wallet className="mr-1 h-3 w-3" /> Deposits ({pendingDeposits?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="withdrawals"><Wallet className="mr-1 h-3 w-3" /> Withdrawals ({pendingWithdrawals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tournaments"><Trophy className="mr-1 h-3 w-3" /> New Tournament</TabsTrigger>
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

        <TabsContent value="tournaments">
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