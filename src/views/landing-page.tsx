import { useEffect } from "react";
import { Link } from "@/lib/wouter-compat";
import { ArrowRight, Store, Package } from "lucide-react";
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

function RodexLogo() {
  return (
    <Link href="/" className="rodex-brand" aria-label="RodexOS home">
      <svg className="rodex-brand-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M8 32V8h12.5c6.9 0 11.5 4.2 11.5 10.2S27.4 28.5 20.5 28.5H16v3.5H8z" fill="#111" />
        <path d="M16 14.5h4.2c3.4 0 5.6 1.9 5.6 4.8s-2.2 4.7-5.6 4.7H16V14.5z" fill="#fff" />
        <path d="M30 8h6v24h-6V8z" fill="#F05A28" />
      </svg>
      <span className="rodex-brand-text">
        Rodex<span className="rodex-brand-accent">OS</span>
      </span>
    </Link>
  );
}

function DashboardMockup() {
  return (
    <div className="rodex-laptop" aria-hidden="true">
      <div className="rodex-laptop-screen">
        <div className="rodex-dash">
          <aside className="rodex-dash-sidebar">
            <div className="rodex-dash-logo">RodexOS</div>
            <nav>
              <span className="active">Dashboard</span>
              <span>Orders</span>
              <span>Shipments</span>
              <span>Invoices</span>
              <span>Payments</span>
            </nav>
          </aside>
          <main className="rodex-dash-main">
            <p className="rodex-dash-title">Overview</p>
            <div className="rodex-dash-cards">
              <div className="rodex-dash-card rodex-dash-card-anim" style={{ animationDelay: "0.9s" }}>
                <span>Active Orders</span>
                <strong>128</strong>
                <div className="spark orange" />
              </div>
              <div className="rodex-dash-card rodex-dash-card-anim" style={{ animationDelay: "1.05s" }}>
                <span>Shipments</span>
                <strong>32</strong>
                <div className="spark blue" />
              </div>
              <div className="rodex-dash-card rodex-dash-card-anim" style={{ animationDelay: "1.2s" }}>
                <span>Invoices</span>
                <strong>18</strong>
                <div className="spark green" />
              </div>
              <div className="rodex-dash-card rodex-dash-card-anim" style={{ animationDelay: "1.35s" }}>
                <span>Payments</span>
                <strong>$48,760</strong>
                <div className="spark purple" />
              </div>
            </div>
            <p className="rodex-dash-subtitle">Recent Orders</p>
            <div className="rodex-dash-table">
              <div className="rodex-dash-row head">
                <span>Order</span>
                <span>Status</span>
              </div>
              <div className="rodex-dash-row rodex-dash-row-anim" style={{ animationDelay: "1.5s" }}>
                <span>#1042 · Green Leaf Bistro</span>
                <span className="badge transit">In Transit</span>
              </div>
              <div className="rodex-dash-row rodex-dash-row-anim" style={{ animationDelay: "1.65s" }}>
                <span>#1038 · Harbor Kitchen</span>
                <span className="badge delivered">Delivered</span>
              </div>
              <div className="rodex-dash-row rodex-dash-row-anim" style={{ animationDelay: "1.8s" }}>
                <span>#1035 · Urban Plate Co.</span>
                <span className="badge confirmed">Confirmed</span>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="rodex-laptop-base" />
    </div>
  );
}

export default function LandingPage() {
  useScrollReveal();

  useEffect(() => {
    document.title = "RodexOS — Streamline Restaurant–Vendor Operations";
    const root = document.getElementById("root");
    document.documentElement.classList.add("landing-scroll");
    document.body.classList.add("landing-scroll");
    root?.classList.add("landing-scroll");

    return () => {
      document.documentElement.classList.remove("landing-scroll");
      document.body.classList.remove("landing-scroll");
      root?.classList.remove("landing-scroll");
    };
  }, []);

  return (
    <div className="landing-page">
      <header className="rodex-header rodex-header-anim">
        <div className="landing-container rodex-header-inner">
          <RodexLogo />
          <nav className="rodex-nav rodex-nav-anim" aria-label="Main navigation">
            <a href="#about" className="rodex-nav-link">About</a>
            <a href="#contact" className="rodex-nav-link">Contact</a>
            <a href="#portals" className="rodex-btn rodex-btn-sm">Login</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="rodex-hero">
          <div className="landing-container rodex-hero-grid">
            <div className="rodex-hero-copy">
              <h1 className="rodex-hero-title-anim">
                Streamline Restaurant–Vendor{" "}
                <span className="rodex-highlight rodex-highlight-anim">Operations.</span>
              </h1>
              <p className="rodex-hero-text-anim">
                RodexOS connects restaurants and vendors on a unified platform to simplify
                ordering, tracking, invoicing, and payments.
              </p>
              <a href="#contact" className="rodex-btn rodex-btn-lg rodex-hero-btn-anim">
                Request Demo
                <ArrowRight className="rodex-btn-icon rodex-btn-icon-anim" aria-hidden="true" />
              </a>
            </div>
            <div className="rodex-hero-visual rodex-hero-visual-anim">
              <DashboardMockup />
            </div>
          </div>
        </section>

        <section id="portals" className="rodex-portals">
          <div className="landing-container rodex-portals-grid">
            <Link href="/restaurant/login" className="rodex-portal-card restaurant rodex-reveal">
              <div className="rodex-portal-icon restaurant">
                <Store aria-hidden="true" />
              </div>
              <h2>For Restaurants</h2>
              <p>
                Source from trusted vendors, place orders with ease, track deliveries in real
                time, and manage invoices and payments.
              </p>
              <span className="rodex-portal-cta">
                Login as Restaurant
                <ArrowRight aria-hidden="true" />
              </span>
            </Link>

            <Link href="/vendor/login" className="rodex-portal-card vendor rodex-reveal rodex-reveal-delay-1">
              <div className="rodex-portal-icon vendor">
                <Package aria-hidden="true" />
              </div>
              <h2>For Vendors</h2>
              <p>
                Receive orders, manage fulfillment, share updates, and get paid faster through
                a streamlined experience.
              </p>
              <span className="rodex-portal-cta">
                Login as Vendor
                <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          </div>
        </section>

        <section id="about" className="rodex-about">
          <div className="landing-container rodex-about-inner rodex-reveal">
            <div className="rodex-section-label">About</div>
            <h2>One platform for the full order-to-payment lifecycle</h2>
            <p>
              RodexOS was built for restaurant operators and vendor teams who need clarity at
              every step — from placing and fulfilling orders to resolving disputes, issuing
              invoices, and recording payments. No more scattered spreadsheets or missed
              deliveries.
            </p>
            <div className="rodex-about-stats">
              <div className="rodex-reveal rodex-reveal-delay-1">
                <strong>Ordering</strong>
                <span>Place and track orders with linked vendors</span>
              </div>
              <div className="rodex-reveal rodex-reveal-delay-2">
                <strong>Fulfillment</strong>
                <span>Picking, shipping, and delivery visibility</span>
              </div>
              <div className="rodex-reveal rodex-reveal-delay-3">
                <strong>Finance</strong>
                <span>Invoicing and payment in one place</span>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="rodex-contact">
          <div className="landing-container rodex-contact-inner">
            <div className="rodex-contact-copy rodex-reveal">
              <div className="rodex-section-label">Contact</div>
              <h2>Request a demo or get in touch</h2>
              <p>
                Tell us about your restaurant group or vendor operation and we&apos;ll show you
                how RodexOS fits your workflow.
              </p>
              <ul className="rodex-contact-details">
                <li>
                  <span>Email</span>
                  <a href="mailto:hello@rodexos.com">hello@rodexos.com</a>
                </li>
                <li>
                  <span>Phone</span>
                  <a href="tel:+18005551234">+1 (800) 555-1234</a>
                </li>
              </ul>
            </div>
            <form
              className="rodex-contact-form rodex-reveal rodex-reveal-delay-1"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <label>
                Name
                <input type="text" name="name" placeholder="Your name" required />
              </label>
              <label>
                Email
                <input type="email" name="email" placeholder="you@company.com" required />
              </label>
              <label>
                Message
                <textarea name="message" rows={4} placeholder="How can we help?" required />
              </label>
              <button type="submit" className="rodex-btn rodex-btn-lg rodex-btn-full">
                Send Message
                <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="rodex-footer rodex-reveal">
        <div className="landing-container rodex-footer-inner">
          <RodexLogo />
          <nav className="rodex-footer-nav" aria-label="Footer navigation">
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="#portals">Login</a>
          </nav>
          <p>© 2026 RodexOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
