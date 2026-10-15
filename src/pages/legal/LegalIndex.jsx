import React from "react";
import { Link } from "react-router-dom";
import { FileText, Shield, UserX, Headphones, RotateCcw, ShieldAlert, ChevronRight } from "lucide-react";

// Public, unauthenticated landing page linking every legal/compliance page — the one URL an
// app-store listing can point to that then fans out to all the rest, instead of needing a
// separate submitted link for each individual policy.
const PAGES = [
  { key: "privacy_policy", label: "Privacy Policy", icon: Shield },
  { key: "terms_conditions", label: "Terms & Conditions", icon: FileText },
  { key: "account_deletion", label: "Account Deletion Request", icon: UserX },
  { key: "contact_support", label: "Contact / Support", icon: Headphones },
  { key: "refund_policy", label: "Cancellation & Refund Policy", icon: RotateCcw },
  { key: "safety_policy", label: "Safety Policy", icon: ShieldAlert },
];

export default function LegalIndex() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-10">
        <h1 className="font-poppins font-bold text-2xl text-neutral-800 mb-1">Legal & Support</h1>
        <p className="text-sm text-neutral-500 mb-6">Policies and support information for the GadiDosti client app.</p>

        <div className="bg-white rounded-2xl shadow-card divide-y divide-neutral-50 overflow-hidden">
          {PAGES.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              to={`/legal/${key}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors"
            >
              <span className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </span>
              <span className="flex-1 text-sm font-medium text-neutral-800">{label}</span>
              <ChevronRight className="w-4 h-4 text-neutral-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
