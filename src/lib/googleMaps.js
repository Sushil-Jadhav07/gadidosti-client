// Shared across every component that loads the Google Maps JS SDK (MapView, place
// autocomplete inputs). @react-google-maps/api's useJsApiLoader dedupes script loads that
// share the same `id`, but only if `libraries` is referentially stable too — importing these
// constants everywhere (instead of redeclaring `["places"]` inline) avoids an unintentional
// reload/console warning when two components mount the loader at once.
export const GOOGLE_MAPS_SCRIPT_ID = "ssk-google-maps-script";
export const GOOGLE_MAPS_LIBRARIES = ["places"];
