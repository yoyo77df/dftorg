import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Trophy, Zap, Users, Wallet, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Compete in Real-Money Esports Tournaments — DFT ORG." },
      { name: "description", content: "Join real-money Free Fire, PUBG, COD, and Valorant tournaments on DFT ORG. Track your rank, build your clan, and cash out wins." },
      { property: "og:title", content: "Compete in Real-Money Esports Tournaments — DFT ORG." },
      { property: "og:description", content: "Real-money esports tournaments across mobile games. Win, rank up, and cash out." },
      { property: "og:url", content: "https://dftorftour.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              <Zap className="h-3 w-3 text-accent" /> Live esports — DFT ORG.
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">
              Compete in <span className="text-gradient">Real-Money</span> Esports Tournaments
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Join real-money tournaments across Free Fire, PUBG, COD, Valorant and more.
              Track your rank, build your clan, and cash out your wins.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-[var(--gradient-primary)] glow-primary">
                <Link to="/tournaments">
                  <Trophy className="mr-2 h-5 w-5" /> Browse tournaments
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Create account</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Active players", value: "12.4K" },
              { label: "Tournaments", value: "320+" },
              { label: "Prize pool", value: "৳ 8.2M" },
              { label: "Games", value: "5" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-5 text-center">
                <div className="text-2xl font-bold text-gradient">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">Why DFT ORG.</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass group rounded-2xl p-6 transition-all hover:-translate-y-1 hover:glow-primary">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--gradient-primary)]">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const features = [
  { icon: Trophy, title: "Daily tournaments", desc: "Solo, Duo, Squad and Clan War formats running 24/7 across all major mobile games." },
  { icon: Wallet, title: "Instant wallet", desc: "Deposit via bKash & Nagad. Win, withdraw, and track every transaction in real time." },
  { icon: Users, title: "Clans & social", desc: "Create or join a clan, chat with teammates, and battle for the top of the global leaderboard." },
  { icon: Crown, title: "Rank & XP system", desc: "Climb from Bronze to Conqueror. Earn seasonal rewards and exclusive badges." },
  { icon: Shield, title: "Anti-cheat", desc: "Fair play enforced by automated detection and a dedicated review team." },
  { icon: Zap, title: "Live updates", desc: "Real-time match leaderboards, instant notifications, and live spectator mode." },
];
