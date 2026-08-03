import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

const DEBOUNCE_MS = 220;

// Search is always restricted to India (componentRestrictions/includedRegionCodes below),
// so the trailing ", India" on every result is dead weight — dropping it buys back visible
// width in the (necessarily narrow) input before the text has to truncate.
const stripCountrySuffix = (address) => address?.replace(/,\s*India$/, "") || address;

// Bolds whichever part of the prediction's main text matched what was typed, mirroring
// how Google's own Autocomplete widget (and most ride-hailing apps) highlight matches —
// `mainText.matches` gives the offsets directly.
function MatchedText({ placePrediction }) {
  const main = placePrediction.mainText?.text || placePrediction.text?.text || "";
  const matches = placePrediction.mainText?.matches || [];
  if (!matches.length) return <>{main}</>;

  const parts = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.startOffset > cursor) parts.push(<span key={`n${i}`}>{main.slice(cursor, m.startOffset)}</span>);
    parts.push(<span key={`b${i}`} className="font-semibold text-neutral-800">{main.slice(m.startOffset, m.endOffset)}</span>);
    cursor = m.endOffset;
  });
  if (cursor < main.length) parts.push(<span key="last">{main.slice(cursor)}</span>);
  return <>{parts}</>;
}

// A fully custom-styled address search: Google's own <Autocomplete> widget renders an
// unstyleable browser-default dropdown (.pac-container, appended straight to <body>) that
// looks out of place next to the rest of the app. This drives the underlying
// AutocompleteSuggestion/Place APIs directly and renders the suggestion list ourselves, so
// it looks and feels like the rest of the product instead of a bolted-on browser widget.
// Deliberately NOT the older AutocompleteService/PlacesService classes — Google deprecated
// those in March 2025 and blocks them outright for Cloud projects created after that date,
// which silently degrades results (e.g. location restriction stops working) with no error.
export default function PlacesAutocompleteInput({ value, onChange, onPlaceSelect, placeholder, className, inputRef, inputProps = {}, restrictToCity = null }) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // The selected city's real viewport — passed as `locationRestriction` below so
  // predictions come back confined to that city instead of anywhere in India.
  const [cityBounds, setCityBounds] = useState(null);

  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const latestQueryRef = useRef("");

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
  }, [isLoaded]);

  // Resolved by autocompleting the city name itself, then fetching that place's viewport.
  useEffect(() => {
    if (!restrictToCity || !isLoaded || !window.google?.maps?.places) {
      setCityBounds(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: restrictToCity,
          includedRegionCodes: ["in"],
        });
        if (cancelled) return;
        const placePrediction = suggestions?.[0]?.placePrediction;
        if (!placePrediction) {
          console.warn(`Could not resolve a place for city "${restrictToCity}" — location search will be unrestricted.`);
          setCityBounds(null);
          return;
        }
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["viewport"] });
        if (cancelled) return;
        if (!place.viewport) {
          console.warn(`City "${restrictToCity}" has no viewport — location search will be unrestricted.`);
        }
        setCityBounds(place.viewport || null);
      } catch (err) {
        if (!cancelled) {
          console.warn(`Could not resolve bounds for city "${restrictToCity}":`, err);
          setCityBounds(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [restrictToCity, isLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input) => {
    if (!window.google?.maps?.places) return;
    setLoading(true);
    try {
      const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ["in"],
        sessionToken: sessionTokenRef.current,
        // A hard restriction (not just a bias) — the point of the intra-city restriction.
        ...(cityBounds ? { locationRestriction: cityBounds } : {}),
      });
      // A slower earlier request resolving after a newer one — ignore it.
      if (input !== latestQueryRef.current) return;
      setLoading(false);
      setPredictions(suggestions?.filter((s) => s.placePrediction) || []);
      setOpen(true);
    } catch {
      if (input !== latestQueryRef.current) return;
      setLoading(false);
      setPredictions([]);
      setOpen(true);
    }
  }, [cityBounds]);

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    setActiveIndex(-1);
    latestQueryRef.current = v;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setPredictions([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPredictions(v), DEBOUNCE_MS);
  };

  const selectPrediction = async (suggestion) => {
    setOpen(false);
    setPredictions([]);
    const placePrediction = suggestion.placePrediction;
    if (!placePrediction) return;
    const place = placePrediction.toPlace();
    try {
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      // Session tokens group a search-to-selection into one billable session — start a
      // fresh one now that this session is done.
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      if (place.location) {
        onPlaceSelect?.({
          address: stripCountrySuffix(place.formattedAddress || placePrediction.text?.text),
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
      } else {
        onChange(stripCountrySuffix(placePrediction.text?.text) || "");
      }
    } catch {
      onChange(stripCountrySuffix(placePrediction.text?.text) || "");
    }
  };

  const handleKeyDown = (e) => {
    if (!open || !predictions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <input
        ref={(node) => { if (inputRef) inputRef.current = node; }}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => { if (predictions.length) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        title={value}
        className={`${className} pr-6 truncate`}
        autoComplete="off"
        {...inputProps}
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (loading || predictions.length > 0) && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-card border border-neutral-100 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {loading && !predictions.length && (
              <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            )}
            {predictions.map((s, i) => (
              <button
                key={s.placePrediction.placeId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-neutral-50 last:border-b-0 ${
                  i === activeIndex ? "bg-primary-50" : "hover:bg-neutral-50"
                }`}
              >
                <MapPin className="w-4 h-4 text-neutral-300 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700 truncate"><MatchedText placePrediction={s.placePrediction} /></p>
                  {s.placePrediction.secondaryText?.text && (
                    <p className="text-xs text-neutral-400 truncate">{s.placePrediction.secondaryText.text}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end px-3 py-1.5 border-t border-neutral-50 bg-neutral-50/60">
            <span className="text-[10px] text-neutral-300">powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
