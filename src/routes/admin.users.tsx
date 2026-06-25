import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Search, ArrowLeft } from "lucide-react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { AdminRoute } from "@/components/AdminRoute";
import { useFirebaseAuth, type Role } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin · Users — FFBPL MATCH" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminRoute>
      <AdminUsersPage />
    </AdminRoute>
  ),
});

interface UserRow {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role;
}

function AdminUsersPage() {
  const { currentUser } = useFirebaseAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [savingUid, setSavingUid] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const rows: UserRow[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return { uid: d.id, email: data.email ?? null, name: data.name ?? null, role: (data.role as Role) ?? "user" };
      }).sort((a, b) => a.uid.localeCompare(b.uid));
      setUsers(rows);
    }, (err) => {
      console.error(err);
      toast.error("Failed to load users");
    });
    return () => unsub();
  }, []);

  const filtered = users.filter((u) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (u.email ?? "").toLowerCase().includes(s) || (u.name ?? "").toLowerCase().includes(s) || u.uid.toLowerCase().includes(s);
  });

  const changeRole = async (uid: string, role: Role) => {
    if (uid === currentUser?.uid && role !== "admin") {
      toast.error("You can't demote yourself.");
      return;
    }
    setSavingUid(uid);
    try {
      await updateDoc(doc(getDb(), "users", uid), { role });
      toast.success(`Role updated to ${role}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update role");
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gradient-primary)] glow-primary">
            <Users className="h-5 w-5 text-primary-foreground" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage user roles — admin / mod / user</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Admin</Link>
        </Button>
      </div>

      <div className="glass mb-4 rounded-xl border border-border/60 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or UID…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="glass rounded-xl border border-border/60 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-border/60 bg-secondary/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-4">User</div>
          <div className="col-span-5">UID</div>
          <div className="col-span-3 text-right">Role</div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No users found.</div>
        ) : (
          filtered.map((u) => (
            <div key={u.uid} className="grid grid-cols-12 items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
              <div className="col-span-4 min-w-0">
                <div className="truncate font-medium">{u.name || "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{u.email || "—"}</div>
              </div>
              <div className="col-span-5 truncate font-mono text-xs text-muted-foreground">{u.uid}</div>
              <div className="col-span-3 flex justify-end">
                <Select value={u.role} onValueChange={(v) => changeRole(u.uid, v as Role)} disabled={savingUid === u.uid}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="mod">mod</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}