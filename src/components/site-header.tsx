import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Trophy, Wallet, User as UserIcon, Shield, LogOut, Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-primary)] glow-primary">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-lg">
            DFT <span className="text-gradient">ORG.</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {user && <NavLink to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />}
          <NavLink to="/tournaments" icon={<Trophy className="h-4 w-4" />} label="Tournaments" />
          {user && <NavLink to="/wallet" icon={<Wallet className="h-4 w-4" />} label="Wallet" />}
          {user && <NavLink to="/profile" icon={<UserIcon className="h-4 w-4" />} label="Profile" />}
          {isAdmin && <NavLink to="/admin" icon={<Shield className="h-4 w-4" />} label="Admin" />}
        </nav>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()} aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" className="bg-[var(--gradient-primary)] glow-primary">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "text-foreground bg-secondary" }}
    >
      {icon}
      {label}
    </Link>
  );
}