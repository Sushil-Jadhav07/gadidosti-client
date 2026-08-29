import creditCardType from "credit-card-type";

// credit-card-type (the library) doesn't know about RuPay — checked its own card-types.js
// source directly, there's no rupay entry — so it's detected separately here using RuPay's
// publicly documented IIN/BIN prefixes, and takes priority over the library's guess for those
// prefixes (several — bare "6", "60", "65..." — overlap with ranges the library already assigns
// to Discover/Maestro, which would otherwise misidentify an Indian RuPay card as one of those).
const RUPAY_PREFIXES = ["60", "6521", "6522", "81", "82", "508", "353", "356"];

// Returns { type, niceType } (type matches PaymentLogos' CARD_BRAND_LOGOS keys below) or null
// once there aren't enough digits yet to tell.
export function detectCardBrand(cardNumber) {
  const digits = (cardNumber || "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  if (RUPAY_PREFIXES.some((p) => digits.startsWith(p))) {
    return { type: "rupay", niceType: "RuPay" };
  }
  const [match] = creditCardType(digits);
  return match ? { type: match.type, niceType: match.niceType } : null;
}

// Groups of 4 for display, e.g. "4242 4242 4242 4242" — matches the gap most networks use.
// Display-only formatting; this app never actually transmits/stores the full number either way.
export function formatCardNumber(value) {
  return (value || "").replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}
