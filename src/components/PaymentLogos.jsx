// Simplified, stylized brand marks for the payment demo sheet — not pixel-accurate
// reproductions of the real logos, just enough visual shorthand to be recognizable.
// Used only where no real icon asset (public/icons8-*.png) exists yet.

export function PhonePeLogo({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="6" fill="#5F259F" />
      <path d="M9.5 6.5h2.2c2.3 0 3.7 1.15 3.7 3.05 0 1.95-1.5 3.1-3.85 3.1h-1.1v3.85H8.5v-10h1zm.95 4.75h1c1.25 0 2-.55 2-1.65 0-1.05-.7-1.65-1.95-1.65h-1.05v3.3z" fill="#fff" />
    </svg>
  );
}

export function VisaLogo({ className = "h-4" }) {
  return (
    <svg viewBox="0 0 48 16" className={className}>
      <text x="0" y="13" fontSize="14" fontWeight="800" fontStyle="italic" fill="#1A1F71" fontFamily="Arial, sans-serif">VISA</text>
    </svg>
  );
}

export function MastercardLogo({ className = "w-8 h-5" }) {
  return (
    <svg viewBox="0 0 40 24" className={className}>
      <circle cx="15" cy="12" r="10" fill="#EB001B" />
      <circle cx="25" cy="12" r="10" fill="#F79E1B" />
      <path d="M20 4.5a10 10 0 0 1 0 15 10 10 0 0 1 0-15z" fill="#FF5F00" />
    </svg>
  );
}

export function MobikwikLogo({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="6" fill="#E7384D" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">M</text>
    </svg>
  );
}

export function FreechargeLogo({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="6" fill="#5A2D82" />
      <path d="M13 5l-5 8h3.5l-1.5 6 6-9h-3.5z" fill="#fff" />
    </svg>
  );
}

// Real icon assets (public/icons8-*.png) — used in place of a hand-drawn SVG mark
// wherever the actual brand icon file is available.
export function GooglePayImageLogo({ className = "w-6 h-6" }) {
  return <img src="/icons8-google-pay-480.png" alt="Google Pay" className={`${className} object-contain`} />;
}

export function PayPalImageLogo({ className = "w-6 h-6" }) {
  return <img src="/icons8-paypal-96.png" alt="PayPal" className={`${className} object-contain`} />;
}

export function PaytmImageLogo({ className = "w-6 h-6" }) {
  return <img src="/icons8-paytm-480.png" alt="Paytm" className={`${className} object-contain`} />;
}

export function AmazonPayImageLogo({ className = "w-6 h-6" }) {
  return <img src="/icons8-amazon-pay-96.png" alt="Amazon Pay" className={`${className} object-contain`} />;
}

export function BankLogo({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="6" fill="#F1F5F9" />
      <path d="M6 10l6-3.5L18 10v1H6v-1z" fill="#64748B" />
      <path d="M7 11.5v5.5H6V19h12v-1h-1v-5.5h-1V19h-2.5v-5.5h-1V19h-2v-5.5h-1V19H9v-5.5H7z" fill="#64748B" />
    </svg>
  );
}

// ── Card network marks (used by SavedAddresses/PaymentMethods' live brand detection) ──

export function AmexLogo({ className = "h-4" }) {
  return (
    <svg viewBox="0 0 48 16" className={className}>
      <rect width="48" height="16" rx="2" fill="#006FCF" />
      <text x="24" y="11.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">AMEX</text>
    </svg>
  );
}

export function DiscoverLogo({ className = "h-4" }) {
  return (
    <svg viewBox="0 0 48 16" className={className}>
      <rect width="48" height="16" rx="2" fill="#1A1A1A" />
      <circle cx="40" cy="8" r="7" fill="#FF6000" />
      <text x="19" y="11.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">DISCOVER</text>
    </svg>
  );
}

export function JcbLogo({ className = "h-4" }) {
  return (
    <svg viewBox="0 0 48 16" className={className}>
      <rect width="15" height="16" rx="2" fill="#0E4C96" />
      <rect x="16.5" width="15" height="16" rx="2" fill="#C6161C" />
      <rect x="33" width="15" height="16" rx="2" fill="#009A57" />
      <text x="24" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">JCB</text>
    </svg>
  );
}

export function RupayLogo({ className = "h-4" }) {
  return (
    <svg viewBox="0 0 48 16" className={className}>
      <rect width="48" height="16" rx="2" fill="#fff" stroke="#E2E8F0" />
      <path d="M0 8h24v8H2a2 2 0 0 1-2-2V8z" fill="#F58220" />
      <path d="M24 0h22a2 2 0 0 1 2 2v6H24V0z" fill="#00A651" />
      <text x="24" y="11" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#1A1A1A" fontFamily="Arial, sans-serif">RuPay</text>
    </svg>
  );
}

export function GenericCardLogo({ className = "h-4 w-6" }) {
  return (
    <svg viewBox="0 0 24 16" className={className}>
      <rect width="24" height="16" rx="2.5" fill="#94A3B8" />
      <rect y="4" width="24" height="2.5" fill="#64748B" />
    </svg>
  );
}

// Per-bank hand-drawn marks (SbiLogo/HdfcLogo/IciciLogo/AxisLogo/KotakLogo) lived here briefly
// but were replaced by real bank logos for all 33 RBI-scheduled banks — see lib/indianBanks.js
// and public/banks/. BankLogo above stays as the generic fallback for anything not in that list.
