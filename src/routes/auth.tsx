import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Gamepad2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — ArenaX" }] }),
  component: AuthPage,
});

// Phone-only auth: phone number becomes a synthetic email + deterministic password
// so users can both create an account AND sign back in later with just a number.
const phoneToEmail = (phone: string) => `p${phone}@arenax.gg`;
const phoneToPassword = (phone: string) => `arenax_${phone}_pw`;

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/tournaments" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) {
      return toast.error("Enter a valid phone number");
    }
    setLoading(true);
    const email = phoneToEmail(digits);
    const password = phoneToPassword(digits);

    // Try sign in first (existing player)
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error) {
      setLoading(false);
      toast.success("Welcome back, gamer!");
      navigate({ to: "/tournaments" });
      return;
    }

    // Otherwise create a new account
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: `player${digits.slice(-6)}`,
          country: "BD",
          gaming_uid: digits,
        },
      },
    });
    setLoading(false);
    if (signUp.error) return toast.error(signUp.error.message);
    toast.success("Account created! Entering arena…");
    navigate({ to: "/tournaments" });
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass neon-border rounded-2xl p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--gradient-primary)] glow-primary">
              <Gamepad2 className="h-6 w-6 text-primary-foreground" />
            </span>
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                Enter the <span className="text-gradient">Arena</span>
              </h1>
              <p className="text-xs text-muted-foreground">Just your number. That's it.</p>
            </div>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phone number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))}
                  required
                  className="h-12 pl-10 text-lg tracking-widest"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-[var(--gradient-primary)] text-base font-semibold glow-primary"
            >
              {loading ? "Loading…" : "Create account"}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              New numbers get an instant account. Existing players sign in automatically.
            </p>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Fair play only. <Link to="/" className="underline">Back home</Link>
        </p>
      </div>
    </div>
  );
}