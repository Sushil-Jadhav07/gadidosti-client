import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { api } from "../services/api";

// Proof-of-delivery photos/videos — up to MAX_PHOTOS_PER_TRIP per trip (see
// gadidosti-backend's trip_pod_photos), shown as a thumbnail grid that opens into a fullscreen
// lightbox. The file-serving route is behind auth, so a plain <img src> would 401 — every
// blob is fetched once here (shared between the thumbnail and the lightbox, so opening the
// lightbox doesn't re-download what the thumbnail already has).
export default function PodGallery({ media, token }) {
  const [blobs, setBlobs] = useState({});
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const urls = [];
    media.forEach((item, i) => {
      api.getFileBlobUrl(item.url, token)
        .then((blobUrl) => {
          if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
          urls.push(blobUrl);
          setBlobs((prev) => ({ ...prev, [i]: blobUrl }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.map((m) => m.url).join(","), token]);

  useEffect(() => {
    if (openIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i > 0 ? i - 1 : media.length - 1));
      if (e.key === "ArrowRight") setOpenIndex((i) => (i < media.length - 1 ? i + 1 : 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, media.length]);

  if (!media.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {media.map((item, i) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50"
          >
            {!blobs[i] ? (
              <div className="w-full h-full animate-pulse bg-neutral-100" />
            ) : item.type === "video" ? (
              <>
                <video src={blobs[i]} className="w-full h-full object-cover" muted />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play className="w-6 h-6 text-white" fill="white" />
                </span>
              </>
            ) : (
              <img src={blobs[i]} alt="" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpenIndex(null)}>
          <button onClick={() => setOpenIndex(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
          {media.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenIndex((i) => (i > 0 ? i - 1 : media.length - 1)); }}
                className="absolute left-2 sm:left-4 text-white/80 hover:text-white p-2"
                aria-label="Previous"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenIndex((i) => (i < media.length - 1 ? i + 1 : 0)); }}
                className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-2"
                aria-label="Next"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <div className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {media[openIndex].type === "video" ? (
              <video src={blobs[openIndex]} className="max-w-full max-h-[85vh] rounded-lg" controls autoPlay />
            ) : (
              <img src={blobs[openIndex]} alt="" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            )}
          </div>
          {media.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{openIndex + 1} / {media.length}</p>
          )}
        </div>
      )}
    </>
  );
}
