import MarketingLayout from "@/components/shared/marketing-layout";

export default function AboutPage() {
  return (
    <MarketingLayout title="About — RodexOS">
      <section className="rodex-about rodex-page-section">
        <div className="landing-container rodex-about-inner rodex-reveal">
          <div className="rodex-section-label">About</div>
          <h1>One platform for the full order-to-payment lifecycle</h1>
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
    </MarketingLayout>
  );
}
