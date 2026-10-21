export default function Footer() {
  return (
    <footer className="wrap site-footer">
      <p>&copy; 2026 TALO Engine</p>
      <div className="footer-links">
        <a className="footer-link" href="#legal">Legal</a>
        <a className="footer-link" href="#terms">Terms &amp; Conditions</a>
        <a className="footer-link" href="#faq">FAQs</a>
      </div>
      <div className="social-links">
        <a className="social-link" href="#" aria-label="TALO Engine on Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a className="social-link" href="#" aria-label="TALO Engine on LinkedIn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="7.5" y1="10.2" x2="7.5" y2="16.5" />
            <circle cx="7.5" cy="7.2" r="0.6" fill="currentColor" stroke="none" />
            <path d="M11.3 16.5v-4.1c0-1.4 1-2.3 2.3-2.3s2.1.9 2.1 2.3v4.1" />
          </svg>
        </a>
        <a className="social-link" href="#" aria-label="TALO Engine on Substack">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
            <rect x="4" y="4.5" width="16" height="2.4" />
            <rect x="4" y="9" width="16" height="2.4" />
            <path d="M4 13.4h16v2.2L12 20l-8-4.4z" />
          </svg>
        </a>
      </div>
      <p>Human judgement. Machine speed.</p>
    </footer>
  );
}
