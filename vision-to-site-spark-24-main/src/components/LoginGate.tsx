import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "bv_auth";
const VALID_USER = import.meta.env.VITE_AUTH_USERNAME || "bigvillage";
const VALID_PASS = import.meta.env.VITE_AUTH_PASSWORD || "audience2026";

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

interface Props {
  children: React.ReactNode;
}

const LoginGate = ({ children }: Props) => {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    if (username === VALID_USER && password === VALID_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
    } else {
      setError("Invalid username or password.");
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-hero flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-black text-2xl tracking-tight text-hero-foreground uppercase">Big Village</span>
          <p className="text-hero-muted text-xs uppercase tracking-widest mt-1">Audience Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-card-border bg-surface-card p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-glow-primary/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-glow-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-hero-foreground">Sign in</h1>
              <p className="text-xs text-hero-muted">Access requires authentication</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-hero-muted uppercase tracking-wider">Username</label>
              <Input
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter username"
                className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-hero-muted uppercase tracking-wider">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter password"
                  className="bg-surface-dark border-surface-card-border text-hero-foreground placeholder:text-hero-muted pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hero-muted hover:text-hero-foreground"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            onClick={handleLogin}
            disabled={!username.trim() || !password.trim()}
            className="w-full bg-glow-primary text-white hover:bg-glow-primary/90 font-semibold"
          >
            Sign In
          </Button>
        </div>

        <p className="text-center text-xs text-hero-muted mt-6">
          © {new Date().getFullYear()} Big Village. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginGate;
