// A hand-drawn top-down truck marker with gradient shading, highlights, and a soft drop
// shadow — the "3D-styled" look ride-hailing apps (Ola/Uber/etc.) use for their vehicle
// markers. Those aren't real 3D models either — they're flat top-down vectors rendered with
// depth cues (gradients, highlights, shadow) so they read as three-dimensional at a glance
// while still rotating cleanly to face any heading, which a true side-on 3D render couldn't do
// (it would only look right pointing in one or two directions). Ported from
// gadidosti-admin-dashboard's src/lib/truckIcon.js, which established this exact design first —
// kept identical here (not re-colored per app) so the vehicle marker looks the same everywhere.
//
// This replaces the old approach of wrapping an external PNG file in a rotated SVG <image> —
// spinning a side-view photo only ever looks right from the one angle it was shot at.
//
// headingDeg comes from the driver's live location ping; category is accepted for backwards
// compatibility with existing callers (MapView.jsx passes marker.truckCategory) but no longer
// changes the art — one consistent vehicle icon regardless of truck size, same as how
// ride-hailing apps don't render a different car shape per vehicle tier.
export const buildTruckIcon = (_category, headingDeg) => {
  const numericHeading = Number(headingDeg);
  const angle = Number.isFinite(numericHeading) ? numericHeading : 0;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <defs>
    <linearGradient id="bed" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E3EDFB"/>
      <stop offset="45%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#C9D9F0"/>
    </linearGradient>
    <linearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3B7DE8"/>
      <stop offset="100%" stop-color="#1E56C4"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#DCEBFF"/>
      <stop offset="100%" stop-color="#9FC3F5"/>
    </linearGradient>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0B1E3D" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#0B1E3D" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse cx="22" cy="24" rx="13" ry="15" fill="url(#shadow)"/>

  <g transform="rotate(${angle} 22 22)">
    <!-- rear wheels -->
    <rect x="7.5" y="19" width="3" height="7" rx="1.2" fill="#1F2937"/>
    <rect x="33.5" y="19" width="3" height="7" rx="1.2" fill="#1F2937"/>
    <!-- front wheels -->
    <rect x="8.5" y="9" width="3" height="6" rx="1.2" fill="#1F2937"/>
    <rect x="32.5" y="9" width="3" height="6" rx="1.2" fill="#1F2937"/>

    <!-- cargo bed -->
    <rect x="10" y="16" width="24" height="17" rx="3" fill="url(#bed)" stroke="#AFC4E6" stroke-width="0.6"/>
    <line x1="16" y1="16" x2="16" y2="33" stroke="#C9D9F0" stroke-width="0.5"/>
    <line x1="22" y1="16" x2="22" y2="33" stroke="#C9D9F0" stroke-width="0.5"/>
    <line x1="28" y1="16" x2="28" y2="33" stroke="#C9D9F0" stroke-width="0.5"/>

    <!-- cab -->
    <rect x="11" y="6" width="22" height="11" rx="3.5" fill="url(#cab)" stroke="#123B8C" stroke-width="0.6"/>
    <rect x="14" y="8" width="16" height="6" rx="2" fill="url(#glass)"/>
    <!-- headlights -->
    <rect x="12.5" y="6.5" width="2.4" height="2" rx="1" fill="#FFE9A8"/>
    <rect x="29.1" y="6.5" width="2.4" height="2" rx="1" fill="#FFE9A8"/>
  </g>
</svg>`.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
