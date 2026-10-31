import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SEC = 60;

function isAdminDomainEmail(value: string) {
  return value.trim().toLowerCase().endsWith("@admin.com");
}

function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

function loginErrorMessage(err: unknown, email: string): string {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials") && isAdminDomainEmail(email)) {
    return (
      "Invalid email or password. For @admin.com accounts: do not use Sign up — use the password set in Supabase. " +
      "If unsure, ask your admin to reset it (scripts/reset-admin-password.js or Dashboard → Users → edit user)."
    );
  }
  if (
    (lower.includes("email not confirmed") || lower.includes("not confirmed")) &&
    isAdminDomainEmail(email)
  ) {
    return (
      "@admin.com addresses cannot receive verification mail. Run supabase/sql/CONFIRM_FAKE_ADMIN_EMAILS.sql in Supabase, then try again."
    );
  }
  return message;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkInboxEmail, setCheckInboxEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const redirectTo = (location.state as { from?: string } | null)?.from || "/testing/journeys";
  const emailRedirectTo = `${window.location.origin}/testing/journeys?confirmed=1`;

  useEffect(() => {
    if (searchParams.get("confirmed") === "1") {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          toast.success("Email confirmed — welcome to ShiftED AI");
          navigate("/testing/journeys", { replace: true });
        } else {
          toast.message("Email confirmed — please sign in.");
        }
      });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/testing/reset-password`,
      });
    } catch {
      // Swallow — generic message only
    } finally {
      toast.success("Check your inbox");
      setLoading(false);
      setIsReset(false);
    }
  };

  const handleResend = async () => {
    if (!checkInboxEmail || resendCooldown > 0) return;
    try {
      await supabase.auth.resend({
        type: "signup",
        email: checkInboxEmail,
        options: { emailRedirectTo },
      });
      toast.success("Confirmation email resent.");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend email.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    if (isSignUp && password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (isSignUp) {
        if (isAdminDomainEmail(normalizedEmail)) {
          toast.error(
            "@admin.com accounts are created by an administrator in Supabase — do not sign up here. Use Sign in with the password you were given.",
          );
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Email confirmed — welcome to ShiftED AI");
          navigate(redirectTo);
          return;
        }
        setCheckInboxEmail(normalizedEmail);
        setResendCooldown(RESEND_COOLDOWN_SEC);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Signed in.");
        navigate(redirectTo);
      }
    } catch (err: unknown) {
      toast.error(loginErrorMessage(err, normalizedEmail));
    } finally {
      setLoading(false);
    }
  };

  if (checkInboxEmail) {
    return (
      <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-sm px-4 py-12">
        <div className="space-y-4 py-2">
          <h1 className="font-display font-semibold text-lg text-foreground">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{checkInboxEmail}</strong>.
            Open it to activate your account, then sign in.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            disabled={resendCooldown > 0}
            onClick={() => void handleResend()}
          >
            {resendCooldown > 0 ? `Resend email (${resendCooldown}s)` : "Resend email"}
          </Button>
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center text-sm text-foreground"
            onClick={() => {
              setCheckInboxEmail(null);
              setIsSignUp(false);
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
    <div className="container mx-auto max-w-sm px-4 py-12">
      <div className="py-2">
        <h1 className="font-display font-semibold text-lg text-foreground mb-1">
          {isReset ? "Reset password" : isSignUp ? "Create account" : "Sign in"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isReset
            ? "We'll email a secure link if an account exists for that address."
            : isSignUp
              ? "Sign up to save your progress and survey responses."
              : "Sign in to access your saved data."}
        </p>
        <form onSubmit={isReset ? handleReset : handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              placeholder="you@example.com"
              required
            />
          </div>
          {!isReset ? (
            <>
              <div>
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="Your password"
                  minLength={isSignUp ? 8 : undefined}
                />
              </div>
              {isSignUp ? (
                <div>
                  <Label htmlFor="confirm-password" className="text-foreground">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5"
                    placeholder="Your password"
                    minLength={8}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading
              ? "Please wait…"
              : isReset
                ? "Send reset link"
                : isSignUp
                  ? "Sign up"
                  : "Sign in"}
          </Button>
        </form>
        {!isReset && !isSignUp ? (
          <button
            type="button"
            onClick={() => setIsReset(true)}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm text-foreground"
          >
            Forgot password?
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (isReset) {
              setIsReset(false);
              return;
            }
            setIsSignUp((v) => !v);
          }}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center text-sm text-foreground"
        >
          {isReset
            ? "Back to sign in"
            : isSignUp
              ? "Already have an account? Sign in"
              : "No account? Sign up"}
        </button>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="inline-flex min-h-11 items-center text-foreground">
            Back to main site
          </Link>
        </p>
      </div>
    </div>
    </div>
  );
}
