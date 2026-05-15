import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, Clock, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Tournaments — DFT ORG." },
      { name: "description", content: "Browse live and upcoming esports tournaments across Free Fire, PUBG, COD, Valorant." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Tournaments</h1>
          <p className="mt-2 text-muted-foreground">Pick a battle. Pay the entry. Take the prize.</p>
        </div>
      </div>

      {isLoading && <SkeletonGrid />}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <div className="glass rounded-2xl p-16 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No tournaments yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">An admin needs to create the first tournament.</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((t) => (
          <Link key={t.id} to="/tournaments/$id" params={{ id: t.id }} className="group glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:glow-primary">
            <div className="mb-3 flex items-center justify-between">
              <Badge variant="outline" className="uppercase tracking-wider">{t.game}</Badge>
              <StatusBadge status={t.status} />
            </div>
            <h3 className="text-lg font-semibold leading-tight">{t.title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{t.mode} · {t.map ?? "TBA"}</div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Stat icon={<Coins className="h-3.5 w-3.5" />} label="Prize" value={`৳${Number(t.prize_pool).toLocaleString()}`} />
              <Stat icon={<Users className="h-3.5 w-3.5" />} label="Slots" value={`${t.joined_slots}/${t.total_slots}`} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Starts" value={new Date(t.start_time).toLocaleDateString()} />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-sm text-muted-foreground">Entry <span className="text-foreground font-semibold">৳{Number(t.entry_fee).toLocaleString()}</span></span>
              <Button size="sm" variant="ghost" className="group-hover:text-accent">View →</Button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    upcoming: "bg-accent/20 text-accent border-accent/40",
    live: "bg-destructive/20 text-destructive border-destructive/40 animate-pulse",
    full: "bg-warning/20 text-[oklch(0.82_0.17_85)] border-warning/40",
    completed: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${map[status] ?? map.upcoming}`}>{status}</span>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass h-56 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}