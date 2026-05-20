import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet Overview — DFT ORG." },
      { name: "description", content: "Manage your DFT ORG. wallet: deposit via bKash or Nagad, withdraw winnings, and review transaction history." },
      { property: "og:title", content: "Wallet Overview — DFT ORG." },
      { property: "og:description", content: "Deposit, withdraw, and track every transaction in real time." },
      { property: "og:url", content: "https://dftorftour.lovable.app/wallet" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/wallet" }],
  }),
  component: WalletPage,
});

const depositSchema = z.object({
  amount: z.coerce.number().min(50, { message: "Minimum deposit is ৳50" }).max(1_000_000),
  method: z.enum(["bKash", "Nagad", "Rocket"]),
  phone: z.string().trim().min(6).max(20),
  transaction_id: z.string().trim().min(3).max(60).optional(),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().min(50, { message: "Minimum withdraw is ৳50" }).max(1_000_000),
  method: z.enum(["bKash", "Nagad", "Rocket"]),
  phone: z.string().trim().min(6).max(20),
});

function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
      return data;
    },
  });

  const { data: txns } = useQuery({
    queryKey: ["txns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: deposits } = useQuery({
    queryKey: ["deposits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const [submitting, setSubmitting] = useState(false);

  const handleDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = depositSchema.safeParse({
      amount: fd.get("amount"),
      method: fd.get("method"),
      phone: fd.get("phone"),
      transaction_id: fd.get("transaction_id"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!parsed.data.transaction_id) return toast.error("Transaction ID required");
    setSubmitting(true);
    const { error } = await supabase.from("deposits").insert({
      user_id: user!.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      phone: parsed.data.phone,
      transaction_id: parsed.data.transaction_id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit request sent for approval");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["deposits"] });
  };

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = withdrawSchema.safeParse({
      amount: fd.get("amount"),
      method: fd.get("method"),
      phone: fd.get("phone"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (parsed.data.amount > Number(wallet?.balance ?? 0)) return toast.error("Insufficient balance");
    setSubmitting(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user!.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      phone: parsed.data.phone,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal request submitted");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["withdrawals"] });
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border flex items-center justify-between rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet Overview</h1>
          <p className="mt-2 text-4xl font-bold text-gradient">৳ {Number(wallet?.balance ?? 0).toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Bonus: ৳ {Number(wallet?.bonus_balance ?? 0).toFixed(2)}</p>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--gradient-primary)] glow-primary">
          <WalletIcon className="h-6 w-6 text-primary-foreground" />
        </span>
      </div>

      <Tabs defaultValue="deposit" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit"><ArrowDownToLine className="mr-1 h-3 w-3" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw"><ArrowUpFromLine className="mr-1 h-3 w-3" /> Withdraw</TabsTrigger>
          <TabsTrigger value="history"><Clock className="mr-1 h-3 w-3" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <form onSubmit={handleDeposit} className="glass mt-4 space-y-3 rounded-xl p-5">
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
              Send money to <span className="font-bold text-foreground">01957941250 (bKash/Nagad)</span>, then submit details below. Minimum deposit ৳50. Admin approval required.
            </p>
            <Row>
              <Field name="amount" type="number" label="Amount (৳)" placeholder="50" />
              <SelectField name="method" label="Method" options={["bKash", "Nagad", "Rocket"]} />
            </Row>
            <Row>
              <Field name="phone" label="Sender phone" placeholder="01XXXXXXXXX" />
              <Field name="transaction_id" label="Transaction ID" placeholder="TXN1234" />
            </Row>
            <Button disabled={submitting} className="w-full bg-[var(--gradient-primary)] glow-primary">
              {submitting ? "Submitting…" : "Submit deposit"}
            </Button>
          </form>

          <List title="Your deposits" items={(deposits ?? []).map((d) => ({
            id: d.id, label: `${d.method} · ৳${d.amount}`, sub: d.transaction_id, status: d.status,
          }))} />
        </TabsContent>

        <TabsContent value="withdraw">
          <form onSubmit={handleWithdraw} className="glass mt-4 space-y-3 rounded-xl p-5">
            <Row>
              <Field name="amount" type="number" label="Amount (৳)" placeholder="50" />
              <SelectField name="method" label="Method" options={["bKash", "Nagad", "Rocket"]} />
            </Row>
            <Field name="phone" label="Receiver phone" placeholder="01XXXXXXXXX" />
            <Button disabled={submitting} className="w-full bg-[var(--gradient-primary)] glow-primary">
              {submitting ? "Submitting…" : "Request withdrawal"}
            </Button>
          </form>

          <List title="Your withdrawals" items={(withdrawals ?? []).map((w) => ({
            id: w.id, label: `${w.method} · ৳${w.amount}`, sub: w.phone, status: w.status,
          }))} />
        </TabsContent>

        <TabsContent value="history">
          <div className="glass mt-4 divide-y divide-border/60 rounded-xl">
            {(txns ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>}
            {(txns ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold capitalize">{t.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <p className={`font-bold ${Number(t.amount) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function Field({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required placeholder={placeholder} />
    </div>
  );
}
function SelectField({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function List({ title, items }: { title: string; items: { id: string; label: string; sub?: string | null; status: string }[] }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="glass divide-y divide-border/60 rounded-xl">
        {items.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Nothing yet.</p>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{i.label}</p>
              {i.sub && <p className="text-[11px] text-muted-foreground">{i.sub}</p>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              i.status === "approved" ? "bg-primary/20 text-primary" :
              i.status === "rejected" ? "bg-destructive/20 text-destructive" :
              "bg-muted text-muted-foreground"
            }`}>{i.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}