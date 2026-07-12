import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import {
  addDoc, collection, doc, limit, onSnapshot, query, serverTimestamp, where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet Overview — FFBPL MATCH" },
      { name: "description", content: "Manage your FFBPL MATCH wallet: deposit via bKash or Nagad, withdraw winnings, and review transaction history." },
      { property: "og:title", content: "Wallet Overview — FFBPL MATCH" },
      { property: "og:description", content: "Deposit, withdraw, and track every transaction in real time." },
      { property: "og:url", content: "https://dftorftour.lovable.app/wallet" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/wallet" }],
  }),
  component: WalletPage,
});

const baseDepositSchema = z.object({
  amount: z.coerce.number().max(1_000_000),
  method: z.enum(["bKash", "Nagad", "Rocket"]),
  phone: z.string().trim().min(6).max(20),
  transaction_id: z.string().trim().min(3).max(60).optional(),
});
const baseWithdrawSchema = z.object({
  amount: z.coerce.number().max(1_000_000),
  method: z.enum(["bKash", "Nagad", "Rocket"]),
  phone: z.string().trim().min(6).max(20),
});

function WalletPage() {
  const { user, loading } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [minDeposit, setMinDeposit] = useState<number>(50);
  const [minWithdraw, setMinWithdraw] = useState<number>(50);

  useEffect(() => {
    const db = getDb();
    return onSnapshot(doc(db, "app_settings", "limits"), (s) => {
      const d = (s.data() as any) || {};
      setMinDeposit(Number(d.min_deposit ?? 50) || 50);
      setMinWithdraw(Number(d.min_withdraw ?? 50) || 50);
    }, () => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const db = getDb();
    const subs: Array<() => void> = [];
    subs.push(onSnapshot(
      query(collection(db, "deposits"), where("user_id", "==", user.id), limit(20)),
      (s) => setDeposits(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc)),
      () => setDeposits([]),
    ));
    subs.push(onSnapshot(
      query(collection(db, "withdrawals"), where("user_id", "==", user.id), limit(20)),
      (s) => setWithdrawals(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc)),
      () => setWithdrawals([]),
    ));
    subs.push(onSnapshot(
      query(collection(db, "wallet_transactions"), where("user_id", "==", user.id), limit(40)),
      (s) => setTxns(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreatedDesc)),
      () => setTxns([]),
    ));
    return () => subs.forEach((u) => u());
  }, [user]);

  const balance = Number(userProfile?.balance ?? 0);

  const [submitting, setSubmitting] = useState(false);

  const handleDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = baseDepositSchema.safeParse({
      amount: fd.get("amount"),
      method: fd.get("method"),
      phone: fd.get("phone"),
      transaction_id: fd.get("transaction_id"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (parsed.data.amount < minDeposit) return toast.error(`Minimum deposit is ৳${minDeposit}`);
    if (!parsed.data.transaction_id) return toast.error("Transaction ID required");
    setSubmitting(true);
    try {
      await addDoc(collection(getDb(), "deposits"), {
        user_id: user!.id,
        username: userProfile?.username || userProfile?.name || user!.email || "user",
        amount: parsed.data.amount,
        method: parsed.data.method,
        phone: parsed.data.phone,
        transaction_id: parsed.data.transaction_id,
        status: "pending",
        created_at: serverTimestamp(),
        created_at_ms: Date.now(),
      });
      toast.success("Deposit request sent for approval");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = baseWithdrawSchema.safeParse({
      amount: fd.get("amount"),
      method: fd.get("method"),
      phone: fd.get("phone"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (parsed.data.amount < minWithdraw) return toast.error(`Minimum withdraw is ৳${minWithdraw}`);
    if (parsed.data.amount > balance) return toast.error("Insufficient balance");
    setSubmitting(true);
    try {
      await addDoc(collection(getDb(), "withdrawals"), {
        user_id: user!.id,
        username: userProfile?.username || userProfile?.name || user!.email || "user",
        amount: parsed.data.amount,
        method: parsed.data.method,
        phone: parsed.data.phone,
        status: "pending",
        created_at: serverTimestamp(),
        created_at_ms: Date.now(),
      });
      toast.success("Withdrawal request submitted");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border flex items-center justify-between rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet Overview</h1>
          <p className="mt-2 text-4xl font-bold text-gradient">৳ {balance.toFixed(2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Live balance</p>
        </div>
        <span className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--gradient-primary)] glow-primary">
          <WalletIcon className="h-6 w-6 text-primary-foreground" />
        </span>
      </div>

      <Tabs defaultValue="deposit" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger className="px-1.5 py-2 text-xs sm:text-sm" value="deposit"><ArrowDownToLine className="mr-1 h-3 w-3" /> Deposit</TabsTrigger>
          <TabsTrigger className="px-1.5 py-2 text-xs sm:text-sm" value="withdraw"><ArrowUpFromLine className="mr-1 h-3 w-3" /> Withdraw</TabsTrigger>
          <TabsTrigger className="px-1.5 py-2 text-xs sm:text-sm" value="history"><Clock className="mr-1 h-3 w-3" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit">
          <form onSubmit={handleDeposit} className="glass mt-4 space-y-3 rounded-xl p-5">
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
              Send money to <span className="font-bold text-foreground">01957941250 (bKash/Nagad)</span>, then submit details below. Minimum deposit <span className="font-bold text-foreground">৳{minDeposit}</span>. Admin approval required.
            </p>
            <Row>
              <Field name="amount" type="number" label={`Amount (৳) — min ৳${minDeposit}`} placeholder={String(minDeposit)} />
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

          <List title="Your deposits" items={deposits.map((d) => ({
            id: d.id,
            label: `${d.method} · ৳${d.amount}`,
            sub: `${d.transaction_id ?? ""}${d.transaction_id ? " · " : ""}${fmtWhen(d.created_at_ms ?? d.created_at)}`,
            status: d.status,
          }))} />
        </TabsContent>

        <TabsContent value="withdraw">
          <form onSubmit={handleWithdraw} className="glass mt-4 space-y-3 rounded-xl p-5">
            <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
              Minimum withdraw <span className="font-bold text-foreground">৳{minWithdraw}</span>. Admin approval required.
            </p>
            <Row>
              <Field name="amount" type="number" label={`Amount (৳) — min ৳${minWithdraw}`} placeholder={String(minWithdraw)} />
              <SelectField name="method" label="Method" options={["bKash", "Nagad", "Rocket"]} />
            </Row>
            <Field name="phone" label="Receiver phone" placeholder="01XXXXXXXXX" />
            <Button disabled={submitting} className="w-full bg-[var(--gradient-primary)] glow-primary">
              {submitting ? "Submitting…" : "Request withdrawal"}
            </Button>
          </form>

          <List title="Your withdrawals" items={withdrawals.map((w) => ({
            id: w.id,
            label: `${w.method} · ৳${w.amount}`,
            sub: `${w.phone} · ${fmtWhen(w.created_at_ms ?? w.created_at)}`,
            status: w.status,
          }))} />
        </TabsContent>

        <TabsContent value="history">
          <div className="glass mt-4 divide-y divide-border/60 rounded-xl">
            {txns.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>}
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold capitalize">{String(t.type || "").replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtWhen(t.created_at_ms ?? t.created_at)}</p>
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

function byCreatedDesc(a: any, b: any) {
  return Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0);
}

function fmtWhen(v: any): string {
  if (!v) return "";
  const ms = typeof v === "number" ? v
    : typeof v?.toMillis === "function" ? v.toMillis()
    : typeof v?.seconds === "number" ? v.seconds * 1000
    : new Date(v).getTime();
  if (!ms || isNaN(ms)) return "";
  return new Date(ms).toLocaleString();
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
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