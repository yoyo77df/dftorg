import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useFirebaseAuth, mapFirebaseError } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in or Create Account — DFT ORG." },
      { name: "description", content: "Sign in to DFT ORG. or create your gamer account to join real-money esports tournaments." },
      { property: "og:title", content: "Sign in or Create Account — DFT ORG." },
      { property: "og:description", content: "Sign in or create your DFT ORG. gamer account to start competing." },
      { property: "og:url", content: "https://dftorftour.lovable.app/auth" },
    ],
    links: [{ rel: "canonical", href: "https://dftorftour.lovable.app/auth" }],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  username: z.string().trim().min(3).max(24),
});

function AuthPage() {
  const navigate = useNavigate();
  const { currentUser, login, register, logout } = useFirebaseAuth();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await login(String(fd.get("email")), String(fd.get("password")));
      toast.success("Welcome back!");
      navigate({ to: "/profile" });
    } catch (err: any) {
      toast.error(mapFirebaseError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      username: fd.get("username"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      await register(parsed.data.email, parsed.data.password, parsed.data.username);
      toast.success("Account created! Welcome to DFT ORG.…");
      navigate({ to: "/profile" });
    } catch (err: any) {
      toast.error(mapFirebaseError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 neon-border">
          <h1 className="text-2xl font-bold">Welcome to <span className="text-gradient">DFT ORG.</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create your gamer account.</p>

          {currentUser && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">{currentUser.email}</span>
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/profile" })}>
                  Profile
                </Button>
                <Button size="sm" variant="outline" onClick={() => logout()}>
                  Sign out
                </Button>
              </div>
            </div>
          )}

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-3" onSubmit={handleSignIn}>
                <Field name="email" type="email" label="Gmail" />
                <Field name="password" type="password" label="Password" />
                <Button type="submit" disabled={loading} className="w-full bg-[var(--gradient-primary)] glow-primary">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-3" onSubmit={handleSignUp}>
                <Field name="username" label="Username" placeholder="proplayer123" />
                <Field name="email" type="email" label="Gmail" />
                <Field name="password" type="password" label="Password" />
                <Button type="submit" disabled={loading} className="w-full bg-[var(--gradient-primary)] glow-primary">
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to fair play. <Link to="/" className="underline">Back home</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required placeholder={placeholder} />
    </div>
  );
}