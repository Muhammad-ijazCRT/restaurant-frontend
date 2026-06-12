import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@/lib/wouter-compat";
import { Menu, X } from "lucide-react";
import { RodexBrandLink } from "@/components/shared/rodex-brand";
import "@/styles/landing.css";

function useScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".landing-page .rodex-reveal");
    if (!nodes.length) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

type MarketingLayoutProps = {
  title: string;
  children: ReactNode;
};

export default function MarketingLayout({ title, children }: MarketingLayoutProps) {
  useScrollReveal();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.title = title;
    const root = document.getElementById("root");
    document.documentElement.classList.add("landing-scroll");
    document.body.classList.add("landing-scroll");
    root?.classList.add("landing-scroll");

    return () => {
      document.documentElement.classList.remove("landing-scroll");
      document.body.classList.remove("landing-scroll");
      root?.classList.remove("landing-scroll");
    };
  }, [title]);

  return (
    <div className="landing-page">
      <header className="rodex-header rodex-header-anim">
        <div className="landing-container rodex-header-inner">
          <RodexBrandLink className="rodex-brand" iconClassName="rodex-brand-icon" textClassName="rodex-brand-text" />
          <button
            type="button"
            className="rodex-nav-toggle"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <nav
            className={`rodex-nav rodex-nav-anim${mobileNavOpen ? " is-open" : ""}`}
            aria-label="Main navigation"
          >
            <Link href="/about" className="rodex-nav-link" onClick={() => setMobileNavOpen(false)}>About</Link>
            <Link href="/contact" className="rodex-nav-link" onClick={() => setMobileNavOpen(false)}>Contact</Link>
            <a href="/#portals" className="rodex-btn rodex-btn-sm" onClick={() => setMobileNavOpen(false)}>Login</a>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="rodex-footer rodex-reveal">
        <div className="landing-container rodex-footer-inner">
          <RodexBrandLink className="rodex-brand" iconClassName="rodex-brand-icon" textClassName="rodex-brand-text" />
          <nav className="rodex-footer-nav" aria-label="Footer navigation">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <a href="/#portals">Login</a>
          </nav>
          <p>© 2026 RodexOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
