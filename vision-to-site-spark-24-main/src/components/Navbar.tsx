import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Audience Analysis", to: "/audience-analysis" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-surface-card-border shadow-sm">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo — matches BiG ViLLAGE brand style */}
        <Link to="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
          <span
            className="font-black tracking-tight leading-none select-none"
            style={{ fontSize: "2rem", color: "#004638", letterSpacing: "-0.02em" }}
          >
            B<span style={{ textTransform: "lowercase" }}>i</span>G V<span style={{ textTransform: "lowercase" }}>i</span>LLAGE
          </span>
        </Link>

        {/* Nav links */}
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

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            className="bg-[#004638] hover:bg-[#004638]/90 text-white font-semibold text-base px-6 h-10"
            onClick={() => navigate("/contact")}
          >
            Request Demo
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
