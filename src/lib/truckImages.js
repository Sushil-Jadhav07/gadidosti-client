// Maps every truck_category value (see backend constants/truckTypes.js) to the closest-matching
// supplied artwork by real size — there's no dedicated art asset per new type, so the 4 largest
// (14ft/17ft/19ft/22ft) all share the same biggest-truck image; still one clear step up from the
// pickup-sized ones below it. "part" keeps the two-trucks icon (shared/combined capacity, not one
// vehicle size). small/medium/large/part are kept too — old, not-yet-recategorized trucks still
// need a valid lookup (see gadidosti-backend's db/51vehicle_pricing.sql).
export const TRUCK_IMAGES = {
  "3_wheeler": "/truck/133_ICON_WITHOUT_DIMENSIONS.png",
  tata_ace: "/truck/Tata_407_deselected.png",
  pickup_8ft: "/truck/110_ICON_WITHOUT_DIMENSIONS.png",
  pickup_10ft: "/truck/109_ICON_WITHOUT_DIMENSIONS.png",
  "14ft": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  "17ft": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  "19ft": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  "22ft": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  "32ft_sxl": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  "32ft_mxl": "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  small: "/truck/109_ICON_WITHOUT_DIMENSIONS.png",
  medium: "/truck/Tata_407_deselected.png",
  large: "/truck/2161_ICON_WITHOUT_DIMENSIONS.png",
  part: "/truck/1149_ICON_WITHOUT_DIMENSIONS.png",
};
