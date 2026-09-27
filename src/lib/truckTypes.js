// The 8 specific truck types that replace the old broad small/medium/large categories for
// anything describing a truck's actual physical size — mirrors gadidosti-backend's
// src/constants/truckTypes.js (separate codebases, no shared package, kept in sync by hand).
// 'part' (part-load booking) is a separate booking mode, not a truck size, and isn't here — the
// main BookTruck.jsx picker gets it from GET /api/config/vehicle-types instead (which already
// includes 'part' alongside these 8), so this file is only needed where that API call isn't
// already in play (e.g. MonthlyHiringForm.jsx).
export const TRUCK_TYPES = [
  { value: "3_wheeler", label: "3 Wheeler", capacity: "500 kg" },
  { value: "tata_ace", label: "Tata Ace", capacity: "750 kg" },
  { value: "pickup_8ft", label: "Pickup 8ft", capacity: "1 Ton" },
  { value: "pickup_10ft", label: "Pickup 10ft", capacity: "1.2 Ton" },
  { value: "14ft", label: "14ft Truck", capacity: "3.7 Ton" },
  { value: "17ft", label: "17ft Truck", capacity: "4.5 Ton" },
  { value: "19ft", label: "19ft Truck", capacity: "6 Ton" },
  { value: "22ft", label: "22ft Truck", capacity: "7 Ton" },
];

export const truckTypeLabel = (value) => TRUCK_TYPES.find((t) => t.value === value)?.label || value;
