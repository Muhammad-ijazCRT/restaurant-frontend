import ContactForm from "@/components/shared/contact-form";
import MarketingLayout from "@/components/shared/marketing-layout";
import { Link } from "@/lib/wouter-compat";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  Package,
  Phone,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";

const CONTACT_IMAGES = {
  hero: "/images/contact/hero-support.jpg",
  warehouse: "/images/contact/warehouse.png",
  team: "/images/contact/support-team.png",
} as const;

const GET_IN_TOUCH_POINTS = [
  "Have questions about our platform?",
  "Need technical support?",
  "Interested in becoming a vendor or restaurant partner?",
  "Want to learn more about our services?",
];

const SUPPORT_CATEGORIES = [
  {
    icon: Store,
    title: "For Restaurants",
    text: "Support for orders, onboarding, and account setup.",
  },
  {
    icon: Package,
    title: "For Vendors",
    text: "Support for products, catalogs, and pricing.",
  },
  {
    icon: Warehouse,
    title: "For Warehouses",
    text: "Support for inventory and fulfillment operations.",
  },
  {
    icon: Truck,
    title: "For Drivers",
    text: "Support for deliveries, routes, and assignments.",
  },
];

const SUPPORT_SERVICES = [
  "Account registration",
  "Restaurant onboarding",
  "Vendor onboarding",
  "Warehouse management",
  "Driver accounts",
  "Order management",
  "Technical support",
  "Billing inquiries",
  "Partnership opportunities",
];

export default function ContactPage() {
  return (
    <MarketingLayout title="Contact Us — RodexOS">
      <section className="rodex-contact-hero">
        <div className="landing-container rodex-contact-hero-grid rodex-reveal">
          <div className="rodex-contact-hero-copy">
            <div className="rodex-section-label">Contact Us</div>
            <h1>We would love to hear from you</h1>
            <p>
              Whether you are a restaurant owner, vendor, warehouse operator, delivery driver,
              or business partner, our team is ready to assist you.
            </p>
          </div>

          <div className="rodex-contact-hero-visual">
            <img src={CONTACT_IMAGES.hero} alt="Customer support representative" />
            <div className="rodex-contact-hero-card">
              <h2>Get In Touch</h2>
              <ul>
                <li>
                  <Phone aria-hidden="true" />
                  <span>
                    <strong>Phone</strong>
                    <a href="tel:+18005551234">+1 (800) 555-1234</a>
                  </span>
                </li>
                <li>
                  <Mail aria-hidden="true" />
                  <span>
                    <strong>Email</strong>
                    <a href="mailto:hello@rodexos.com">hello@rodexos.com</a>
                  </span>
                </li>
                <li>
                  <Clock3 aria-hidden="true" />
                  <span>
                    <strong>Business Hours</strong>
                    Monday – Friday: 9:00 AM – 6:00 PM
                  </span>
                </li>
                <li>
                  <MapPin aria-hidden="true" />
                  <span>
                    <strong>Address</strong>
                    123 Supply Chain Avenue, Moscow, Russia
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rodex-contact-main">
        <div className="landing-container rodex-contact-main-grid">
          <div className="rodex-contact-form-wrap rodex-reveal" id="contact-form">
            <h2>Send us a Message</h2>
            <p>
              Send us a message through our contact form and a member of our team will respond
              as soon as possible.
            </p>
            <ContactForm className="rodex-contact-form" />
          </div>

          <div className="rodex-contact-help rodex-reveal rodex-reveal-delay-1">
            <h2>Get In Touch</h2>
            <ul className="rodex-contact-help-list">
              {GET_IN_TOUCH_POINTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="rodex-contact-help-note">Our team is available to help.</p>

            <h3>We are here to help</h3>
            <div className="rodex-contact-category-grid">
              {SUPPORT_CATEGORIES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rodex-contact-category-card">
                  <span className="rodex-contact-category-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rodex-contact-info-bar">
        <div className="landing-container rodex-contact-info-grid rodex-reveal">
          <div>
            <h2>Contact Information</h2>
            <ul className="rodex-contact-info-list">
              <li>
                <MapPin aria-hidden="true" />
                <span>
                  <strong>Address</strong>
                  123 Supply Chain Avenue, Moscow, Russia
                </span>
              </li>
              <li>
                <Phone aria-hidden="true" />
                <span>
                  <strong>Phone</strong>
                  <a href="tel:+18005551234">+1 (800) 555-1234</a>
                </span>
              </li>
              <li>
                <Mail aria-hidden="true" />
                <span>
                  <strong>Email</strong>
                  <a href="mailto:hello@rodexos.com">hello@rodexos.com</a>
                </span>
              </li>
              <li>
                <Clock3 aria-hidden="true" />
                <span>
                  <strong>Business Hours</strong>
                  Monday – Friday: 9:00 AM – 6:00 PM
                </span>
              </li>
            </ul>
          </div>
          <div className="rodex-contact-info-visual">
            <img src={CONTACT_IMAGES.team} alt="Support team ready to help" />
          </div>
        </div>
      </section>

      <section className="rodex-contact-partner">
        <div className="landing-container rodex-contact-partner-grid rodex-reveal">
          <div className="rodex-contact-partner-copy">
            <div className="rodex-section-label">Partner With Us</div>
            <h2>Join our growing ecosystem</h2>
            <p>
              We are continuously expanding our network across Russia and welcome new
              restaurants, suppliers, warehouses, and logistics partners.
            </p>
            <p>
              Join our growing ecosystem and become part of a smarter, more connected restaurant
              supply chain.
            </p>
          </div>
          <div className="rodex-contact-partner-media">
            <img src={CONTACT_IMAGES.warehouse} alt="Warehouse and logistics operations" />
          </div>
        </div>
      </section>

      <section className="rodex-contact-services">
        <div className="landing-container rodex-reveal">
          <div className="rodex-section-label">Support Services</div>
          <h2>Our support team can assist with</h2>
          <div className="rodex-contact-services-grid">
            {SUPPORT_SERVICES.map((service) => (
              <div key={service} className="rodex-contact-service-item">
                <Headphones aria-hidden="true" />
                <span>{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rodex-contact-cta">
        <div className="landing-container rodex-contact-cta-inner rodex-reveal">
          <div className="rodex-contact-cta-copy">
            <Headphones aria-hidden="true" />
            <span>Still have questions?</span>
          </div>
          <Link href="#contact-form" className="rodex-btn rodex-btn-lg">
            Contact Us
            <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
