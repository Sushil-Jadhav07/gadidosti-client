import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_SCRIPT_ID, GOOGLE_MAPS_LIBRARIES } from "../lib/googleMaps";

const DEBOUNCE_MS = 220;

// Bolds whichever part of the prediction's main text matched what was typed, mirroring
// how Google's own Autocomplete widget (and most ride-hailing apps) highlight matches —
// `structured_formatting.main_text_matched_substrings` gives the offsets directly.
function MatchedText({ prediction }) {
  const main = prediction.structured_formatting?.main_text || prediction.description;
  const matches = prediction.structured_formatting?.main_text_matched_substrings || [];
  if (!matches.length) return <>{main}</>;

  const parts = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.offset > cursor) parts.push(<span key={`n${i}`}>{main.slice(cursor, m.offset)}</span>);
    parts.push(<span key={`b${i}`} className="font-semibold text-neutral-800">{main.slice(m.offset, m.offset + m.length)}</span>);
    cursor = m.offset + m.length;
  });
  if (cursor < main.length) parts.push(<span key="last">{main.slice(cursor)}</span>);
  return <>{parts}</>;
}

// A fully custom-styled address search: Google's own <Autocomplete> widget renders an
// unstyleable browser-default dropdown (.pac-container, appended straight to <body>) that
// looks out of place next to the rest of the app. This drives the same underlying
// AutocompleteService/PlacesService APIs directly and renders the suggestion list ourselves,
// so it looks and feels like the rest of the product (and like the native map apps users
// already know) instead of a bolted-on browser widget.
export default function PlacesAutocompleteInput({ value, onChange, onPlaceSelect, placeholder, className, inputRef, inputProps = {} }) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const latestQueryRef = useRef("");

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    // PlacesService needs a Map or a plain DOM node to attach to — it never actually
    // renders into it, so a detached <div> (never inserted into the page) is fine.
    placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement("div"));
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
  }, [isLoaded]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback((input) => {
    if (!autocompleteServiceRef.current) return;
    setLoading(true);
    autocompleteServiceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: "in" }, sessionToken: sessionTokenRef.current },
      (results, status) => {
        // A slower earlier request resolving after a newer one — ignore it.
        if (input !== latestQueryRef.current) return;
        setLoading(false);
        const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
        setPredictions(ok && results ? results : []);
        setOpen(true);
      }
    );
  }, []);

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

  const selectPrediction = (prediction) => {
    setOpen(false);
    setPredictions([]);
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ["geometry", "formatted_address"], sessionToken: sessionTokenRef.current },
      (place, status) => {
        // Session tokens group a search-to-selection into one billable session — start a
        // fresh one now that this session is done.
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        const ok = status === window.google.maps.places.PlacesServiceStatus.OK;
        if (ok && place?.geometry?.location) {
          onPlaceSelect?.({
            address: place.formatted_address || prediction.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        } else {
          onChange(prediction.description);
        }
      }
    );
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
        className={`${className} pr-6`}
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
            {predictions.map((p, i) => (
              <button
                key={p.place_id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-neutral-50 last:border-b-0 ${
                  i === activeIndex ? "bg-primary-50" : "hover:bg-neutral-50"
                }`}
              >
                <MapPin className="w-4 h-4 text-neutral-300 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-neutral-700 truncate"><MatchedText prediction={p} /></p>
                  {p.structured_formatting?.secondary_text && (
                    <p className="text-xs text-neutral-400 truncate">{p.structured_formatting.secondary_text}</p>
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
