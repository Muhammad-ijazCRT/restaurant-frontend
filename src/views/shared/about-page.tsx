import MarketingLayout from "@/components/shared/marketing-layout";
import { Link } from "@/lib/wouter-compat";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Globe2,
  Headphones,
  Lightbulb,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Target,
  Truck,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";

const ABOUT_IMAGES = {
  hero: "/images/about/hero-restaurant.jpg",
  restaurant: "/images/about/restaurant-kitchen.png",
  vendor: "/images/about/vendor.png",
  warehouse: "/images/about/warehouse.png",
  driver: "/images/about/driver.png",
} as const;

const HERO_FEATURES = [
  { icon: Store, label: "Reliable Suppliers" },
  { icon: Truck, label: "Fast Logistics" },
  { icon: ShieldCheck, label: "Quality Control" },
  { icon: Headphones, label: "24/7 Support" },
];

const WHO_WE_ARE_FEATURES = [
  {
    icon: Lightbulb,
    title: "Innovation",
    text: "Modern tools that replace manual workflows and disconnected systems.",
  },
  {
    icon: ShieldCheck,
    title: "Reliability",
    text: "Stable operations for restaurants, vendors, warehouses, and drivers.",
  },
  {
    icon: Globe2,
    title: "Transparency",
    text: "Real-time visibility across every step of the supply chain.",
  },
  {
    icon: Headphones,
    title: "Support",
    text: "Dedicated help when your team needs guidance or troubleshooting.",
  },
];

const PLATFORM_ROLES = [
  {
    icon: Store,
    title: "Restaurants",
    text: "Browse products, compare vendors, place orders, track deliveries, and manage purchase history from a single dashboard.",
  },
  {
    icon: Package,
    title: "Vendors",
    text: "Receive orders from restaurants, manage product catalogs, monitor inventory, process orders, and coordinate with warehouses.",
  },
  {
    icon: Warehouse,
    title: "Warehouses",
    text: "Receive assigned orders, prepare products, update inventory levels, and coordinate dispatch operations.",
  },
  {
    icon: Truck,
    title: "Drivers",
    text: "Receive delivery assignments, view routes, update delivery status, and ensure products reach restaurants on time.",
  },
];

const ORDER_JOURNEY = [
  { step: 1, label: "Restaurant places an order", icon: ShoppingCart },
  { step: 2, label: "Vendor receives and confirms", icon: Package },
  { step: 3, label: "Vendor assigns to warehouse", icon: Building2 },
  { step: 4, label: "Warehouse prepares products", icon: Warehouse },
  { step: 5, label: "Warehouse assigns to driver", icon: Users },
  { step: 6, label: "Driver collects products", icon: Truck },
  { step: 7, label: "Driver delivers to restaurant", icon: MapPin },
  { step: 8, label: "Restaurant confirms delivery", icon: CheckCircle2 },
];

const PARTNERS = [
  {
    title: "Restaurants",
    text: "Order smarter with full visibility from purchase to delivery.",
    image: ABOUT_IMAGES.restaurant,
  },
  {
    title: "Vendors",
    text: "Manage catalogs, fulfill orders, and coordinate fulfillment teams.",
    image: ABOUT_IMAGES.vendor,
  },
  {
    title: "Warehouses",
    text: "Pack, prepare, and dispatch with accurate inventory control.",
    image: ABOUT_IMAGES.warehouse,
  },
  {
    title: "Drivers",
    text: "Deliver on time with clear routes and live status updates.",
    image: ABOUT_IMAGES.driver,
  },
];

const STATS = [
  { value: "5000+", label: "Restaurants trust us", icon: Store },
  { value: "12000+", label: "Suppliers on the platform", icon: Package },
  { value: "150+", label: "Warehouses connected", icon: Warehouse },
  { value: "3000+", label: "Drivers with us", icon: Truck },
];

const WHY_CHOOSE = [
  "Real-time order tracking",
  "Centralized communication",
  "Faster order processing",
  "Improved inventory management",
  "Reduced operational costs",
  "Better supplier coordination",
  "Delivery management tools",
  "Secure role-based access",
  "Detailed reporting and analytics",
  "Scalable for businesses of all sizes",
];

const CTA_FEATURES = [
  { icon: Clock3, title: "Save time on orders", text: "Automate ordering and reduce manual follow-ups." },
  { icon: BarChart3, title: "Reduce costs", text: "Optimize inventory and supplier coordination." },
  { icon: ShieldCheck, title: "Track every stage", text: "Monitor progress from order to delivery." },
  { icon: Zap, title: "Grow your business", text: "Scale operations with one connected platform." },
];

export default function AboutPage() {
  return (
    <MarketingLayout title="About Us — RodexOS">
      <section className="rodex-about-hero">
        <div className="landing-container rodex-about-hero-grid">
          <div className="rodex-about-hero-copy rodex-reveal">
            <div className="rodex-section-label">About Us</div>
            <h1>We connect the entire supply chain for restaurants</h1>
            <p>
              Welcome to our restaurant supply and logistics platform — a complete solution designed
              to connect restaurants, vendors, warehouses, and delivery drivers through one powerful
              system. Our mission is to modernize the restaurant supply chain by making ordering,
              inventory management, warehousing, and delivery faster, more transparent, and more
              efficient.
            </p>
            <div className="rodex-about-hero-actions">
              <Link href="/contact" className="rodex-btn rodex-btn-lg">
                Become a Partner
                <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
              </Link>
              <Link href="/#portals" className="rodex-btn-outline rodex-btn-lg">
                Explore Portals
              </Link>
            </div>
          </div>

          <div className="rodex-about-hero-visual rodex-reveal rodex-reveal-delay-1">
            <img src={ABOUT_IMAGES.hero} alt="Restaurant supply and logistics operations" className="rodex-about-hero-image" />
            <div className="rodex-about-hero-card">
              {HERO_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="rodex-about-hero-card-item">
                  <span className="rodex-about-hero-card-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rodex-about-section">
        <div className="landing-container rodex-about-split rodex-reveal">
          <div className="rodex-about-split-media">
            <img src={ABOUT_IMAGES.restaurant} alt="Restaurant kitchen using digital ordering" />
            <div className="rodex-about-goal-card">
              <div className="rodex-about-goal-icon">
                <Target aria-hidden="true" />
              </div>
              <strong>Our Goal</strong>
              <p>
                Build one centralized platform that eliminates manual communication, spreadsheets,
                and disconnected systems across the full supply process.
              </p>
            </div>
          </div>

          <div className="rodex-about-split-copy">
            <div className="rodex-section-label">Who We Are</div>
            <h2>Technology for your business</h2>
            <p>
              We are a technology-driven company focused on helping restaurants and suppliers
              streamline their daily operations. Whether you own a single restaurant or manage a
              large restaurant chain, our system helps you order products, track deliveries, manage
              suppliers, and monitor order progress in real time.
            </p>
            <div className="rodex-about-feature-grid">
              {WHO_WE_ARE_FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rodex-about-feature-item">
                  <span className="rodex-about-feature-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rodex-about-section rodex-about-section-muted">
        <div className="landing-container">
          <div className="rodex-about-section-head rodex-reveal">
            <div className="rodex-section-label">How Our Platform Works</div>
            <h2>One workflow for every role</h2>
            <p>
              Restaurants, vendors, warehouses, and drivers operate on the same connected system
              with role-based access and real-time updates.
            </p>
          </div>
          <div className="rodex-about-role-grid">
            {PLATFORM_ROLES.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className={`rodex-about-role-card rodex-reveal rodex-reveal-delay-${(index % 3) + 1}`}
              >
                <span className="rodex-about-role-icon">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rodex-about-section">
        <div className="landing-container">
          <div className="rodex-about-section-head rodex-reveal">
            <div className="rodex-section-label">Complete Order Journey</div>
            <h2>From order to delivery — fully tracked</h2>
            <p>Throughout the process, all parties can track order status in real time.</p>
          </div>
          <div className="rodex-about-journey">
            {ORDER_JOURNEY.map(({ step, label, icon: Icon }, index) => (
              <div
                key={step}
                className={`rodex-about-journey-step rodex-reveal rodex-reveal-delay-${(index % 3) + 1}`}
              >
                <div className="rodex-about-journey-icon">
                  <Icon aria-hidden="true" />
                </div>
                <span className="rodex-about-journey-number">{step}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rodex-about-section rodex-about-section-muted">
        <div className="landing-container">
          <div className="rodex-about-section-head rodex-reveal">
            <div className="rodex-section-label">Who We Work With</div>
            <h2>Built for every part of the supply chain</h2>
          </div>
          <div className="rodex-about-partner-grid">
            {PARTNERS.map(({ title, text, image }, index) => (
              <article
                key={title}
                className={`rodex-about-partner-card rodex-reveal rodex-reveal-delay-${(index % 3) + 1}`}
              >
                <img src={image} alt={title} />
                <div className="rodex-about-partner-overlay">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rodex-about-stats-bar">
        <div className="landing-container rodex-about-stats-grid rodex-reveal">
          {STATS.map(({ value, label, icon: Icon }) => (
            <div key={label} className="rodex-about-stat">
              <span className="rodex-about-stat-icon">
                <Icon aria-hidden="true" />
              </span>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rodex-about-section">
        <div className="landing-container">
          <div className="rodex-about-section-head rodex-reveal">
            <div className="rodex-section-label">Why Choose Our Platform</div>
            <h2>Everything you need to run smarter operations</h2>
          </div>
          <div className="rodex-about-benefits-grid rodex-reveal">
            {WHY_CHOOSE.map((item) => (
              <div key={item} className="rodex-about-benefit">
                <CheckCircle2 aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rodex-about-section rodex-about-section-muted">
        <div className="landing-container rodex-about-vision-grid rodex-reveal">
          <article className="rodex-about-vision-card">
            <div className="rodex-section-label">Our Vision</div>
            <h2>Leading the digital restaurant supply ecosystem</h2>
            <p>
              Our vision is to become the leading digital ecosystem for restaurant supply chain
              management in Russia, helping restaurants and suppliers operate more efficiently while
              delivering exceptional service to their customers.
            </p>
          </article>
          <article className="rodex-about-vision-card">
            <div className="rodex-section-label">Our Commitment</div>
            <h2>Reliable technology. Outstanding support.</h2>
            <p>
              We are committed to providing reliable technology, outstanding customer support, and
              innovative solutions that help our clients grow their businesses and optimize their
              operations. By connecting restaurants, vendors, warehouses, and drivers into one
              seamless workflow, we are building the future of food supply management.
            </p>
          </article>
        </div>
      </section>

      <section className="rodex-about-cta">
        <div className="landing-container rodex-about-cta-grid">
          <div className="rodex-about-cta-visual rodex-reveal">
            <img src={ABOUT_IMAGES.driver} alt="Delivery driver on route" />
          </div>

          <div className="rodex-about-cta-copy rodex-reveal rodex-reveal-delay-1">
            <h2>Let&apos;s grow your business together</h2>
            <p>
              Join our platform and connect your restaurant or supply business to a modern,
              transparent, and efficient workflow.
            </p>
            <Link href="/contact" className="rodex-btn rodex-btn-lg">
              Become a Partner
              <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
            </Link>
          </div>

          <div className="rodex-about-cta-features rodex-reveal rodex-reveal-delay-2">
            {CTA_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rodex-about-cta-feature">
                <span className="rodex-about-cta-feature-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
