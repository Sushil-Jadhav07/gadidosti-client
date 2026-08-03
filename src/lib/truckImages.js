// Maps the 4 fixed truck_category values (see backend config.controller.js VEHICLE_TYPES —
// there is no 5th category, so every id here is exhaustive) to the closest-matching supplied
// artwork, ordered by real capacity: small (≤1T) < medium (≤5T) < large (≤20T), with "part"
// getting the two-trucks icon since it represents shared/combined capacity, not one vehicle size.
export const TRUCK_IMAGES = {
  small: "/truck/109_ICON_WITHOUT_DIMENSIONS.png",
  medium: "/truck/Tata_407_deselected.png",
  large: "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  part: "/truck/1149_ICON_WITHOUT_DIMENSIONS.png",
};
