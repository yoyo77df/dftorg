import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Users, Coins, Clock, MapPin, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tournaments/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("tournaments")
      .select("id, title, game, mode, description, start_time, entry_fee, prize_pool")
      .eq("id", params.id)
      .maybeSingle();
    return { tournament: data };
  },
  head: ({ params, loaderData }) => {
    const t = loaderData?.tournament;
    const url = `https://dftorftour.lovable.app/tournaments/${params.id}`;
    const title = t ? `${t.title} — DFT ORG.` : "Tournament — DFT ORG.";
    const desc = t
      ? `${t.game} ${t.mode} tournament. Prize pool ৳${Number(t.prize_pool).toLocaleString()}, entry ৳${Number(t.entry_fee).toLocaleString()}. Join on DFT ORG.`
      : "Esports tournament details on DFT ORG.";
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 160) },
        { property: "og:type", content: "event" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: t
        ? [{
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Event",
              name: t.title,
              description: t.description ?? desc,
              startDate: t.start_time,
              eventStatus: "https://schema.org/EventScheduled",
              eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
              location: { "@type": "VirtualLocation", url },
              offers: {
                "@type": "Offer",
                price: Number(t.entry_fee),
                priceCurrency: "BDT",
                url,
                availability: "https://schema.org/InStock",
              },
              organizer: { "@type": "Organization", name: "DFT ORG.", url: "https://dftorftour.lovable.app" },
            }),
          }]
        : [],
    };
  },
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [joining, setJoining] = useState(false);

  const { data: t, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: joined } = useQuery({
    queryKey: ["joined", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("tournament_participants")
        .select("id").eq("tournament_id", id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["participants", id],
    queryFn: async () => {
      const { data } = await supabase.from("tournament_participants")
        .select("id, team_name, igl_name, user_id, joined_at")
        .eq("tournament_id", id)
        .order("joined_at");
      const list = data ?? [];
      if (list.length === 0) return [];
      const ids = list.map((p) => p.user_id);
      const { data: profs } = await supabase.from("profiles")
        .select("id, username, gaming_uid").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return list.map((p) => ({ ...p, profile: map.get(p.user_id) }));
    },
  });

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return navigate({ to: "/auth" });
    const fd = new FormData(e.currentTarget);
    setJoining(true);
    const { error } = await supabase.rpc("join_tournament", {
      _tournament_id: id,
      _team_name: String(fd.get("team_name")).trim(),
      _igl_name: String(fd.get("igl_name")).trim(),
    });
    setJoining(false);
    if (error) return toast.error(error.message);
    toast.success("Joined! Good luck 🔥");
    qc.invalidateQueries();
  };

  if (isLoading || !t) return <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link to="/tournaments" className="text-xs text-muted-foreground hover:text-primary">← All tournaments</Link>

      <div className="glass neon-border mt-3 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">{t.game}</span>
          <span className="text-xs text-muted-foreground">{t.joined_slots}/{t.total_slots} slots</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.mode} · {t.map ?? "TBA"}</p>

        <Countdown target={t.start_time} />

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Info icon={<Coins className="h-4 w-4" />} label="Prize Pool" value={`৳${Number(t.prize_pool).toLocaleString()}`} />
          <Info icon={<Trophy className="h-4 w-4" />} label="Entry" value={`৳${Number(t.entry_fee).toLocaleString()}`} />
          <Info icon={<Clock className="h-4 w-4" />} label="Starts" value={new Date(t.start_time).toLocaleString()} />
          <Info icon={<MapPin className="h-4 w-4" />} label="Status" value={t.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Prize rank="1st" amount={t.prize_first} />
          <Prize rank="2nd" amount={t.prize_second} />
          <Prize rank="3rd" amount={t.prize_third} />
        </div>

        {t.description && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Description</h3>
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{t.description}</p>
          </div>
        )}
      </div>

      <div className="glass mt-6 rounded-2xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Participants</h3>
          <span className="text-xs text-muted-foreground">{participants?.length ?? 0} / {t.total_slots}</span>
        </div>
        {(participants?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No teams have joined yet.</p>
        ) : (
          <div className="space-y-2">
            {participants!.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary">#{i + 1}</span>
                  <div>
                    <p className="font-semibold">{p.team_name}</p>
                    <p className="text-xs text-muted-foreground">IGL: {p.igl_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{p.profile?.username ?? "—"}</p>
                  <code className="text-[10px] text-muted-foreground">UID: {p.profile?.gaming_uid ?? p.user_id.slice(0, 8) + "…"}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass mt-6 rounded-2xl p-6">
        {!user ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Sign in to join this tournament.</p>
            <Button onClick={() => navigate({ to: "/auth" })} className="mt-3 bg-[var(--gradient-primary)] glow-primary">Sign in</Button>
          </div>
        ) : joined ? (
          <div className="text-center">
            <p className="text-lg font-bold text-primary">✓ You're in!</p>
            <p className="mt-1 text-xs text-muted-foreground">Room ID & password will appear before match starts.</p>
            {t.room_id && (
              <div className="mt-3 rounded-lg bg-primary/10 p-3 text-left text-sm">
                <p><span className="text-muted-foreground">Room:</span> <b>{t.room_id}</b></p>
                <p><span className="text-muted-foreground">Pass:</span> <b>{t.room_password}</b></p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-3">
            <h3 className="font-bold">Join tournament</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="team_name">Team name</Label>
                <Input id="team_name" name="team_name" required maxLength={40} placeholder="Phantom Squad" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="igl_name">IGL name</Label>
                <Input id="igl_name" name="igl_name" required maxLength={40} placeholder="Captain in-game name" />
              </div>
            </div>
            <Button disabled={joining} className="w-full bg-[var(--gradient-primary)] glow-primary">
              {joining ? "Joining…" : `Join · Pay ৳${Number(t.entry_fee).toLocaleString()}`}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">Entry fee deducted from your wallet on join.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 text-sm font-bold capitalize">{value}</p>
    </div>
  );
}
function Prize({ rank, amount }: { rank: string; amount: number }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
      <Award className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{rank}</p>
      <p className="text-sm font-bold">৳{Number(amount).toLocaleString()}</p>
    </div>
  );
}

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return (
      <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-center text-sm font-bold text-destructive animate-pulse">
        🔴 LIVE / Started
      </div>
    );
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      {[["Days", d], ["Hours", h], ["Min", m], ["Sec", s]].map(([l, v]) => (
        <div key={l as string} className="text-center">
          <p className="text-2xl font-bold text-primary tabular-nums">{String(v).padStart(2, "0")}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}