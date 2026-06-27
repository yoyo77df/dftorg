import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Trophy, Wallet, User as UserIcon, Shield, LogOut, Gamepad2, LifeBuoy, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const links = [
    ...(user ? [{ to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" }] : []),
    { to: "/tournaments", icon: <Trophy className="h-4 w-4" />, label: "Tournaments" },
    ...(user ? [
      { to: "/wallet", icon: <Wallet className="h-4 w-4" />, label: "Wallet" },
      { to: "/profile", icon: <UserIcon className="h-4 w-4" />, label: "Profile" },
      { to: "/support", icon: <LifeBuoy className="h-4 w-4" />, label: "Support" },
      { to: "/chat", icon: <MessageSquare className="h-4 w-4" />, label: "Chat" },
    ] : []),
    ...(isAdmin ? [{ to: "/admin", icon: <Shield className="h-4 w-4" />, label: "Admin" }] : []),
  ];
  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-primary)] glow-primary">
            <Gamepad2 className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-lg">
            <span className="text-gradient">FFBPL MATCH</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => <NavLink key={link.to} {...link} />)}
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
      <nav className="container mx-auto grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3 md:hidden">
        {links.map((link) => <NavLink key={link.to} {...link} compact />)}
      </nav>
    </header>
  );
}

function NavLink({ to, icon, label, compact = false }: { to: string; icon: React.ReactNode; label: string; compact?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex shrink-0 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${compact ? "px-2.5 py-2" : "px-3 py-2"}`}
      activeProps={{ className: "text-foreground bg-secondary" }}
    >
      {icon}
      {label}
    </Link>
  );
}