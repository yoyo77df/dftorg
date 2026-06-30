import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Coins, Clock, MapPin, Award } from "lucide-react";
import { collection, doc, getDoc, increment, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { useFirebaseAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tournaments/$id")({
  ssr: false,
  loader: async ({ params }) => {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/dft-tournament-27a59/databases/(default)/documents/tournaments/${params.id}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return { tournament: null };
      const json: any = await res.json();
      const f = json.fields ?? {};
      const val = (x: any) =>
        x?.stringValue ?? x?.integerValue ?? x?.doubleValue ?? x?.timestampValue ?? x?.booleanValue ?? undefined;
      return {
        tournament: {
          name: val(f.name),
          game: val(f.game),
          mode: val(f.mode),
          prize_pool: Number(val(f.prize_pool) ?? 0),
          entry_fee: Number(val(f.entry_fee) ?? 0),
          start_time: val(f.start_time),
          status: val(f.status),
          max_participants: Number(val(f.max_participants) ?? 0),
        },
      };
    } catch {
      return { tournament: null };
    }
  },
  head: ({ params, loaderData }) => {
    const url = `https://dftorftour.lovable.app/tournaments/${params.id}`;
    const t = loaderData?.tournament;
    const title = t?.name ? `${t.name} — FFBPL MATCH Tournament` : "Tournament — FFBPL MATCH";
    const desc = t
      ? `${t.game ?? "Esports"} ${t.mode ?? ""} tournament with ৳${t.prize_pool} prize pool. Entry ৳${t.entry_fee}. Join now on FFBPL MATCH`.trim()
      : "Esports tournament details on FFBPL MATCH — view schedule, prize pool, entry fee, room credentials, and join the next match from your dashboard.";
    const scripts: Array<{ type: string; children: string }> = [];
    if (t) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: t.name,
          startDate: t.start_time,
          eventStatus:
            t.status === "live" || t.status === "ongoing"
              ? "https://schema.org/EventScheduled"
              : "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          location: {
            "@type": "VirtualLocation",
            url,
          },
          organizer: {
            "@type": "Organization",
            name: "FFBPL MATCH",
            url: "https://dftorftour.lovable.app",
          },
          offers: {
            "@type": "Offer",
            price: String(t.entry_fee ?? 0),
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            url,
          },
          description: desc,
        }),
      });
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://dftorftour.lovable.app/" },
            { "@type": "ListItem", position: 2, name: "Tournaments", item: "https://dftorftour.lovable.app/tournaments" },
            { "@type": "ListItem", position: 3, name: t.name ?? "Tournament", item: url },
          ],
        }),
      });
    }
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
      scripts,
    };
  },
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { userProfile } = useFirebaseAuth();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [t, setTournament] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [secret, setSecret] = useState<{ room_id?: string | null; room_password?: string | null } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(getDb(), "tournaments", id), (snap) => {
      setTournament(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!user) {
      setParticipants([]);
      return;
    }
    const q = query(collection(getDb(), "tournament_participants"), where("tournament_id", "==", id));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const profiles = await Promise.all(list.map(async (p: any) => {
        try {
          const ps = await getDoc(doc(getDb(), "users", p.user_id));
          return [p.user_id, ps.exists() ? ps.data() : null] as const;
        } catch {
          return [p.user_id, null] as const;
        }
      }));
      const profileMap = new Map(profiles);
      setParticipants(list
        .map((p: any) => ({ ...p, profile: profileMap.get(p.user_id) }))
        .sort((a, b) => tsMs(a.joined_at_ms ?? a.joined_at) - tsMs(b.joined_at_ms ?? b.joined_at)));
    }, () => setParticipants([]));
    return () => unsub();
  }, [id, user]);

  useEffect(() => {
    if (!user) {
      setJoined(false);
      return;
    }
    const unsub = onSnapshot(doc(getDb(), "tournament_participants", `${id}_${user.id}`), (snap) => setJoined(snap.exists()));
    return () => unsub();
  }, [id, user]);

  useEffect(() => {
    if (!user || !joined) { setSecret(null); return; }
    const unsub = onSnapshot(doc(getDb(), "tournament_secrets", id), (snap) => {
      setSecret(snap.exists() ? (snap.data() as any) : null);
    }, () => setSecret(null));
    return () => unsub();
  }, [id, user, joined]);

  const handleJoin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return navigate({ to: "/auth" });
    const status = String(t?.status ?? "").toLowerCase();
    if (status && status !== "upcoming") {
      return toast.error("Joining closed — tournament already started");
    }
    if (new Date(t?.start_time).getTime() <= Date.now()) {
      return toast.error("Joining closed — tournament already started");
    }
    const fd = new FormData(e.currentTarget);
    setJoining(true);
    try {
      const entryFee = Number(t?.entry_fee ?? 0);
      const balance = Number(userProfile?.balance ?? 0);
      if (balance < entryFee) {
        setJoining(false);
        return toast.error("Insufficient balance");
      }
      const teamName = String(fd.get("team_name") || "").trim();
      const iglName = String(fd.get("igl_name") || "").trim();
      const db = getDb();
      await runTransaction(db, async (tx) => {
        const tRef = doc(db, "tournaments", id);
        const uRef = doc(db, "users", user.id);
        const pRef = doc(db, "tournament_participants", `${id}_${user.id}`);
        const [tSnap, uSnap, pSnap] = await Promise.all([tx.get(tRef), tx.get(uRef), tx.get(pRef)]);
        if (!tSnap.exists()) throw new Error("Tournament not found");
        if (pSnap.exists()) throw new Error("Already joined");
        const tournament = tSnap.data() as any;
        const currentSlots = Number(tournament.joined_slots ?? 0);
        const totalSlots = Number(tournament.total_slots ?? 0);
        if (totalSlots > 0 && currentSlots >= totalSlots) throw new Error("Tournament is full");
        const latestFee = Number(tournament.entry_fee ?? entryFee);
        const latestBalance = Number((uSnap.data() as any)?.balance ?? balance);
        if (latestBalance < latestFee) throw new Error("Insufficient balance");
        tx.set(pRef, {
          tournament_id: id,
          user_id: user.id,
          team_name: teamName,
          igl_name: iglName,
          joined_at: serverTimestamp(),
          joined_at_ms: Date.now(),
        });
        tx.update(tRef, { joined_slots: increment(1), updated_at: serverTimestamp() });
        if (latestFee > 0) tx.update(uRef, { balance: increment(-latestFee) });
      });
      toast.success("Joined! Good luck 🔥");
    } catch (error: any) {
      toast.error(error?.message || "Join failed");
    } finally {
      setJoining(false);
    }
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

        <div className="mt-5 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            🔑 Room ID & Password
          </h3>
          {joined && secret?.room_id && secret?.room_password ? (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Room ID:</span>{" "}
                <b className="text-base">{secret.room_id}</b>
              </p>
              <p>
                <span className="text-muted-foreground">Password:</span>{" "}
                <b className="text-base">{secret.room_password}</b>
              </p>
            </div>
          ) : joined ? (
            <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
              রাত ৮ টায় এই ওয়েবসাইট এ রুম আইডি ও রুম পাসওয়ার্ড দেয়া হবে।
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              🔒 Join this tournament to see the room ID & password when released.
            </p>
          )}
        </div>

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
                  <code className="text-[10px] text-muted-foreground">UID: {p.profile?.gaming_uid || p.user_id}</code>
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
            <p className="mt-1 text-xs text-muted-foreground">Room ID & password are shown above when released.</p>
          </div>
      ) : (String(t.status ?? "").toLowerCase() !== "upcoming" && t.status) || new Date(t.start_time).getTime() <= Date.now() ? (
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">🔒 Joining closed</p>
          <p className="mt-1 text-xs text-muted-foreground">This tournament has already started or is no longer accepting entries.</p>
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

function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}