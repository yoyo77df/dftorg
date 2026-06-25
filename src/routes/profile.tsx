import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Target, Zap, TrendingUp, User as UserIcon } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { getDb } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "User Profile — FFBPL MATCH" },
      { name: "description", content: "View and edit your FFBPL MATCH player profile: username, country, gaming UID, and bio." },
      { property: "og:title", content: "User Profile — FFBPL MATCH" },
      { property: "og:description", content: "Manage your gamer profile, stats, and account info." },
      { property: "og:url", content: "https://dftorftour.lovable.app/profile" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/profile" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const db = getDb();
      const ref = doc(db, "users", user!.id);
      const snap = await getDoc(ref);
      const fallbackName = user!.displayName || user!.email?.split("@")[0] || "Player";
      if (!snap.exists()) {
        const created = defaultProfile(user!.id, user!.email ?? null, fallbackName, user!.photoURL ?? null);
        await setDoc(ref, { ...created, createdAt: serverTimestamp() }, { merge: true });
        return created;
      }
      return normalizeProfile(user!.id, user!.email ?? null, fallbackName, user!.photoURL ?? null, snap.data());
    },
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const username = String(fd.get("username")).trim();
      await setDoc(doc(getDb(), "users", user!.id), {
        name: username,
        username,
        country: String(fd.get("country")).trim(),
        gaming_uid: String(fd.get("gaming_uid")).trim(),
        bio: String(fd.get("bio")).trim() || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (error: any) {
      toast.error(error?.message ?? "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) return <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass neon-border rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--gradient-primary)] glow-primary">
            <UserIcon className="h-8 w-8 text-primary-foreground" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-sm text-muted-foreground">{profile.username} · {profile.rank} · {profile.xp} XP</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Trophy className="h-4 w-4" />} label="Wins" value={profile.wins} />
        <Stat icon={<Target className="h-4 w-4" />} label="Kills" value={profile.total_kills} />
        <Stat icon={<Zap className="h-4 w-4" />} label="Matches" value={profile.matches_played} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Earnings" value={`৳${Number(profile.earnings).toFixed(0)}`} />
      </div>

      <form onSubmit={handleSave} className="glass mt-6 space-y-4 rounded-2xl p-6">
        <h2 className="text-lg font-bold">Edit profile</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <F name="username" label="Username" defaultValue={profile.username} />
          <F name="country" label="Country" defaultValue={profile.country ?? ""} />
          <F name="gaming_uid" label="Gaming UID" defaultValue={profile.gaming_uid ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} placeholder="Pro Free Fire player from Dhaka…" maxLength={300} />
        </div>
        <Button disabled={saving} className="bg-[var(--gradient-primary)] glow-primary">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

function defaultProfile(uid: string, email: string | null, name: string, photoURL: string | null) {
  return {
    uid,
    email,
    name,
    username: name,
    photoURL,
    role: "user",
    country: "",
    gaming_uid: "",
    bio: null,
    rank: "Rookie",
    xp: 0,
    wins: 0,
    total_kills: 0,
    matches_played: 0,
    earnings: 0,
  };
}

function normalizeProfile(uid: string, email: string | null, name: string, photoURL: string | null, data: Record<string, any>) {
  const base = defaultProfile(uid, email, name, photoURL);
  return {
    ...base,
    ...data,
    uid,
    email: data.email ?? email,
    name: data.name ?? data.username ?? name,
    username: data.username ?? data.name ?? name,
    photoURL: data.photoURL ?? photoURL,
    rank: data.rank ?? "Rookie",
    xp: Number(data.xp ?? 0),
    wins: Number(data.wins ?? 0),
    total_kills: Number(data.total_kills ?? 0),
    matches_played: Number(data.matches_played ?? 0),
    earnings: Number(data.earnings ?? 0),
  };
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
function F({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} required />
    </div>
  );
}