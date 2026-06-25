import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { Trophy, Wallet, User as UserIcon, Shield, Zap, Target, Award, TrendingUp } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Player Dashboard — DFT ORG." },
      { name: "description", content: "Your DFT ORG. player dashboard: rank, XP, wallet balance, and upcoming tournaments at a glance." },
      { property: "og:title", content: "Player Dashboard — DFT ORG." },
      { property: "og:description", content: "Your stats, wallet, and upcoming battles in one place." },
      { property: "og:url", content: "https://dftorftour.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/dashboard" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const q = query(collection(getDb(), "tournaments"), where("status", "in", ["upcoming", "live"]), limit(8));
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as any)
        .sort((a, b) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime())
        .slice(0, 4));
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  if (!user) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Redirecting to sign in…</div>;
  }

  const profile = userProfile;
  const balance = Number(profile?.balance ?? 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome banner */}
      <div className="glass neon-border rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Player Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back, <span className="text-gradient font-semibold">{profile?.username ?? profile?.name ?? user.displayName ?? "Player"}</span> — Rank: {profile?.rank ?? "Rookie"} · XP {profile?.xp ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--gradient-primary)] px-5 py-3 glow-primary">
            <p className="text-[10px] uppercase tracking-widest text-primary-foreground/80">Wallet</p>
            <p className="text-2xl font-bold text-primary-foreground">৳ {balance.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Trophy className="h-4 w-4" />} label="Wins" value={profile?.wins ?? 0} />
        <Stat icon={<Target className="h-4 w-4" />} label="Kills" value={profile?.total_kills ?? 0} />
        <Stat icon={<Zap className="h-4 w-4" />} label="Matches" value={profile?.matches_played ?? 0} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Earnings" value={`৳${Number(profile?.earnings ?? 0).toFixed(0)}`} />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickLink to="/tournaments" icon={<Trophy className="h-5 w-5" />} label="Tournaments" />
        <QuickLink to="/wallet" icon={<Wallet className="h-5 w-5" />} label="Wallet" />
        <QuickLink to="/profile" icon={<UserIcon className="h-5 w-5" />} label="Profile" />
        {isAdmin && <QuickLink to="/admin" icon={<Shield className="h-5 w-5" />} label="Admin" />}
      </div>

      {/* Upcoming tournaments */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Upcoming Battles</h2>
          <Link to="/tournaments" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(tournaments ?? []).map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="glass rounded-xl border border-border/60 p-4 transition-all hover:border-primary/60 hover:glow-primary"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {t.game}
                </span>
                <span className="text-xs text-muted-foreground">{t.joined_slots}/{t.total_slots}</span>
              </div>
              <h3 className="mt-2 font-semibold">{t.title}</h3>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Award className="h-3 w-3" /> ৳{Number(t.prize_pool).toFixed(0)}
                </span>
                <span className="text-muted-foreground">Entry ৳{Number(t.entry_fee).toFixed(0)}</span>
              </div>
            </Link>
          ))}
          {tournaments.length === 0 && (
            <div className="glass col-span-full rounded-xl p-8 text-center text-sm text-muted-foreground">
              No tournaments scheduled yet. Check back soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="glass flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-all hover:border-primary/60 hover:glow-primary"
    >
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground">
        {icon}
      </span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}