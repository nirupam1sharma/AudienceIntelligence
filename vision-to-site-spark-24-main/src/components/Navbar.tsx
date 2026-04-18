import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Audience Analysis", to: "/audience-analysis" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-surface-card-border shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="hover:opacity-80 transition-opacity flex-shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <span
            className="font-black tracking-tight leading-none select-none"
            style={{ fontSize: "clamp(1.25rem, 4vw, 2rem)", color: "#004638", letterSpacing: "-0.02em" }}
          >
            B<span style={{ textTransform: "lowercase" }}>i</span>G{" "}
            V<span style={{ textTransform: "lowercase" }}>i</span>LLAGE
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "px-5 py-2 rounded-md font-semibold transition-colors text-base",
                  active
                    ? "bg-[#004638]/10 text-[#004638]"
                    : "text-[#004638]/70 hover:text-[#004638] hover:bg-[#004638]/5"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop: Request Demo button */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <Button
            className="bg-[#004638] hover:bg-[#004638]/90 text-white font-semibold text-base px-6 h-10"
            onClick={() => navigate("/contact")}
          >
            Request Demo
          </Button>
        </div>

        {/* Mobile: hamburger button */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-[#004638] hover:bg-[#004638]/10 transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-card-border bg-white/98 backdrop-blur-xl px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-lg font-semibold text-base transition-colors",
                  active
                    ? "bg-[#004638]/10 text-[#004638]"
                    : "text-[#004638]/70 hover:text-[#004638] hover:bg-[#004638]/5"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-1 pb-1">
            <Button
              className="w-full bg-[#004638] hover:bg-[#004638]/90 text-white font-semibold"
              onClick={() => { navigate("/contact"); setMobileOpen(false); }}
            >
              Request Demo
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
