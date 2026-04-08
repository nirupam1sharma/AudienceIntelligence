import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAuthenticated, logout } from "@/components/LoginGate";

const Navbar = () => {
  const navigate = useNavigate();
  const authed = isAuthenticated();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-surface-card-border shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="font-black text-xl tracking-tight text-hero-foreground uppercase">Big Village</span>
          <span className="hidden sm:block text-hero-muted text-xs font-medium border-l border-surface-card-border pl-3 uppercase tracking-widest">Audience Intelligence</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-hero-muted">
          <a href="/#features" className="hover:text-hero-foreground transition-colors">Capabilities</a>
          <a href="/#journey" className="hover:text-hero-foreground transition-colors">Journey</a>
          <a href="/#architecture" className="hover:text-hero-foreground transition-colors">Architecture</a>
          <Link to="/audience-analysis" className="hover:text-hero-foreground transition-colors font-medium text-glow-primary">Audience Analysis</Link>
        </div>
        <div className="flex items-center gap-2">
          {authed && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="border-surface-card-border text-hero-muted hover:text-destructive hover:border-destructive/40 gap-1.5 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          )}
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Request Demo
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
