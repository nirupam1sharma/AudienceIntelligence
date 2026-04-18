import Navbar from "@/components/Navbar";
import { useState } from "react";
import { MapPin, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", company: "",
    phone: "", subject: "", message: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-hero">
      <Navbar />
      <div className="pt-20">
        {/* Header */}
        <div className="bg-hero border-b border-surface-card-border py-10 sm:py-16 text-center">
          <div className="container mx-auto px-4 sm:px-6">
            <span className="inline-block px-3 py-1.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium bg-surface-card border border-glow mb-5 sm:mb-6 text-hero-muted">
              Get in Touch
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-hero-foreground mb-3 sm:mb-4">
              Contact Us
            </h1>
            <p className="text-hero-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Whether you're ready to request a demo, ask a question, or explore a partnership — we'd love to hear from you.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 sm:gap-12">

            {/* Left: Contact info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-hero-foreground mb-6">Big Village</h2>
                <p className="text-hero-muted text-sm leading-relaxed">
                  We're a research and data company helping brands understand people — not just demographics. Our Audience Intelligence Platform turns fragmented data into actionable insight.
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-card border border-surface-card-border flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-glow-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-hero-foreground uppercase tracking-wider mb-1">Address</p>
                    <p className="text-hero-muted text-sm">100 William Street<br />New York, NY 10038</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-card border border-surface-card-border flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-glow-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-hero-foreground uppercase tracking-wider mb-1">Email</p>
                    <a href="mailto:info@big-village.com" className="text-glow-primary text-sm hover:underline">info@big-village.com</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-card border border-surface-card-border flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4 text-glow-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-hero-foreground uppercase tracking-wider mb-1">Phone</p>
                    <a href="tel:+12125551234" className="text-hero-muted text-sm hover:text-hero-foreground">+1 (212) 555-1234</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-card border border-surface-card-border flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-glow-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-hero-foreground uppercase tracking-wider mb-1">Office Hours</p>
                    <p className="text-hero-muted text-sm">Monday – Friday<br />9:00 AM – 6:00 PM ET</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl bg-surface-card border border-surface-card-border p-4 sm:p-8">
                {submitted ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-glow-primary/10 border border-glow-primary/30 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-glow-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-hero-foreground">Message Sent!</h3>
                    <p className="text-hero-muted text-sm max-w-sm leading-relaxed">
                      Thank you for reaching out. A member of our team will be in touch within one business day.
                    </p>
                    <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ firstName: "", lastName: "", email: "", company: "", phone: "", subject: "", message: "" }); }}
                      className="mt-2 border-surface-card-border text-hero-muted hover:text-hero-foreground">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-hero-foreground mb-1">Send us a message</h2>
                      <p className="text-hero-muted text-sm">Fill in the form below and we'll get back to you shortly.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">First Name <span className="text-destructive">*</span></label>
                        <Input required value={form.firstName} onChange={set("firstName")} placeholder="Jane"
                          className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Last Name <span className="text-destructive">*</span></label>
                        <Input required value={form.lastName} onChange={set("lastName")} placeholder="Smith"
                          className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-10" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Email Address <span className="text-destructive">*</span></label>
                        <Input required type="email" value={form.email} onChange={set("email")} placeholder="jane@company.com"
                          className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Company</label>
                        <Input value={form.company} onChange={set("company")} placeholder="Acme Corp"
                          className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-10" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Phone</label>
                        <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 (555) 000-0000"
                          className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 h-10" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Subject <span className="text-destructive">*</span></label>
                        <select required value={form.subject} onChange={set("subject") as any}
                          className="w-full h-10 px-3 rounded-md border border-surface-card-border bg-hero text-hero-foreground text-sm focus:outline-none focus:ring-2 focus:ring-glow-primary/30">
                          <option value="" disabled>Select a subject…</option>
                          <option value="Request a Demo">Request a Demo</option>
                          <option value="Product Question">Product Question</option>
                          <option value="Partnership Inquiry">Partnership Inquiry</option>
                          <option value="Pricing">Pricing</option>
                          <option value="Support">Support</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-hero-muted uppercase tracking-wider">Message <span className="text-destructive">*</span></label>
                      <Textarea required value={form.message} onChange={set("message")}
                        placeholder="Tell us about your use case, what you're trying to achieve, or any questions you have…"
                        rows={5} className="bg-hero border-surface-card-border text-hero-foreground placeholder:text-hero-muted/50 resize-none" />
                    </div>

                    <Button type="submit" size="lg"
                      className="w-full bg-[#004638] hover:bg-[#004638]/90 text-white font-semibold h-11">
                      Send Message
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
