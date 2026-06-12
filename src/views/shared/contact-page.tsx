import ContactForm from "@/components/shared/contact-form";
import MarketingLayout from "@/components/shared/marketing-layout";

export default function ContactPage() {
  return (
    <MarketingLayout title="Contact — RodexOS">
      <section className="rodex-contact rodex-page-section">
        <div className="landing-container rodex-contact-inner">
          <div className="rodex-contact-copy rodex-reveal">
            <div className="rodex-section-label">Contact</div>
            <h1>Request a demo or get in touch</h1>
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
          <ContactForm />
        </div>
      </section>
    </MarketingLayout>
  );
}
