import { useEffect, useState } from "react";
import { Link } from "@/lib/wouter-compat";
import { ArrowRight, Menu, Store, Package, X } from "lucide-react";
import { RodexBrandLink } from "@/components/shared/rodex-brand";
import "@/styles/landing.css";

const LANDING_ABOUT_IMAGE = "/images/about/hero-restaurant.jpg";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
            <a href="#portals" className="rodex-btn rodex-btn-sm" onClick={() => setMobileNavOpen(false)}>Login</a>
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
              <Link href="/contact" className="rodex-btn rodex-btn-lg rodex-hero-btn-anim">
                Request Demo
                <ArrowRight className="rodex-btn-icon rodex-btn-icon-anim" aria-hidden="true" />
              </Link>
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

        <section className="rodex-about">
          <div className="landing-container rodex-landing-about-split rodex-reveal">
            <div className="rodex-landing-about-media">
              <img src={LANDING_ABOUT_IMAGE} alt="Restaurant supply platform" />
            </div>
            <div className="rodex-landing-about-copy">
              <div className="rodex-section-label">About</div>
              <h2>One platform for restaurants, vendors, warehouses, and drivers</h2>
              <p>
                Our mission is to modernize the restaurant supply chain with real-time tracking,
                centralized communication, and role-based tools for every step — from placing an
                order to confirming delivery.
              </p>
              <Link href="/about" className="rodex-btn rodex-btn-lg">
                Learn More
                <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rodex-contact">
          <div className="landing-container rodex-landing-contact-split rodex-reveal">
            <div className="rodex-landing-contact-copy">
              <div className="rodex-section-label">Contact</div>
              <h2>We would love to hear from you</h2>
              <p>
                Whether you are a restaurant owner, vendor, warehouse operator, or delivery
                driver, our team is ready to assist you with onboarding, support, and
                partnership opportunities.
              </p>
              <Link href="/contact" className="rodex-btn rodex-btn-lg">
                Contact Us
                <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
              </Link>
            </div>
            <div className="rodex-landing-contact-media">
              <img src="/images/contact/hero-support.jpg" alt="Contact our support team" />
            </div>
          </div>
        </section>
      </main>

      <footer className="rodex-footer rodex-reveal">
        <div className="landing-container rodex-footer-inner">
          <RodexBrandLink className="rodex-brand" iconClassName="rodex-brand-icon" textClassName="rodex-brand-text" />
          <nav className="rodex-footer-nav" aria-label="Footer navigation">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <a href="#portals">Login</a>
          </nav>
          <p>© 2026 RodexOS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
