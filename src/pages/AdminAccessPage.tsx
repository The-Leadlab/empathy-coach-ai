import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Legacy route — admin access is granted via Supabase `user_roles`, not a client PIN. */
export default function AdminAccessPage() {
  return (
    <div className="container max-w-sm mx-auto px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <h1 className="font-display font-semibold text-lg text-foreground">Admin access</h1>
        <p className="text-sm text-muted-foreground">
          Admin features require an account with the <code className="text-xs">admin</code> role in Supabase.
          Sign in with your trainer account, then open the admin chat monitor.
        </p>
        <Button asChild className="w-full rounded-xl">
          <Link to="/testing/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link to="/admin">LLM live monitor</Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link to="/adminchat">Admin chat monitor</Link>
        </Button>
      </div>
    </div>
  );
}
