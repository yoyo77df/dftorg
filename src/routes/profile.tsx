import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Target, Zap, TrendingUp, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — DFT ORG." }] }),
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
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: String(fd.get("username")).trim(),
      country: String(fd.get("country")).trim(),
      gaming_uid: String(fd.get("gaming_uid")).trim(),
      bio: String(fd.get("bio")).trim() || null,
    }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
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
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-sm text-muted-foreground">{profile.rank} · {profile.xp} XP</p>
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