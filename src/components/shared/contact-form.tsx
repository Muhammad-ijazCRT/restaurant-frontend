import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { contactPaths } from "@/api/public/contact";
import { apiRequest } from "@/lib/queryClient";

type ContactFormProps = {
  className?: string;
};

export default function ContactForm({ className = "rodex-contact-form rodex-reveal rodex-reveal-delay-1" }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("loading");
    setErrorMessage("");

    try {
      await apiRequest("POST", contactPaths.submit, {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        message: String(formData.get("message") ?? ""),
        website: String(formData.get("website") ?? ""),
      });
      setStatus("success");
      form.reset();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not send your message.");
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <label>
        Name
        <input type="text" name="name" placeholder="Your name" required disabled={status === "loading"} />
      </label>
      <label>
        Email
        <input type="email" name="email" placeholder="you@company.com" required disabled={status === "loading"} />
      </label>
      <label>
        Message
        <textarea name="message" rows={4} placeholder="How can we help?" required disabled={status === "loading"} />
      </label>
      {status === "success" && (
        <p className="rodex-contact-feedback success" role="status">
          Thank you! Your message was sent. We will get back to you soon.
        </p>
      )}
      {status === "error" && (
        <p className="rodex-contact-feedback error" role="alert">
          {errorMessage}
        </p>
      )}
      <button type="submit" className="rodex-btn rodex-btn-lg rodex-btn-full" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Send Message"}
        <ArrowRight className="rodex-btn-icon" aria-hidden="true" />
      </button>
    </form>
  );
}
