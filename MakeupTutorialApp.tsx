import React, { useState, useRef } from "react";
import { Upload, Sparkles, ShoppingBag, X, Camera, Type, ArrowRight, Loader2 } from "lucide-react";

const BRANDS = [
  "e.l.f. Cosmetics", "NYX Professional Makeup", "Maybelline", "Rare Beauty",
  "Fenty Beauty", "Charlotte Tilbury", "Pat McGrath Labs", "Tom Ford Beauty",
  "Black Radiance", "Ardell", "Kiss Lashes", "House of Lashes", "Lilly Lashes",
];

// Point this at YOUR backend endpoint, which holds your Anthropic API key server-side
// and calls Claude on the app's behalf. This component never calls Anthropic directly.
// See generate-tutorial-endpoint.md for the expected request/response contract.
const API_ENDPOINT = "/api/generate-tutorial";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function UploadTile({ label, sublabel, file, onFile, icon: Icon }) {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-[#4a2354] bg-[#2a1330] overflow-hidden transition-all hover:border-[#ff3d7f]"
      style={{ aspectRatio: "3/4" }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <>
          <img src={URL.createObjectURL(file)} alt={label} className="h-full w-full object-cover" />
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null); }}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <Icon size={24} className="text-[#ff3d7f]" strokeWidth={1.5} />
          <div className="font-serif text-[15px] text-[#fff6ec]">{label}</div>
          <div className="text-xs text-[#b592c2]">{sublabel}</div>
        </div>
      )}
    </div>
  );
}

export default function MakeupTutorialApp() {
  const [faceFile, setFaceFile] = useState(null);
  const [lookFile, setLookFile] = useState(null);
  const [lookText, setLookText] = useState("");
  const [lookMode, setLookMode] = useState("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canGenerate = faceFile && (lookMode === "text" ? lookText.trim().length > 3 : lookFile);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const faceB64 = await fileToBase64(faceFile);
      const payload = {
        brands: BRANDS,
        face_image: { media_type: faceFile.type, data: faceB64 },
        look_mode: lookMode,
      };
      if (lookMode === "image" && lookFile) {
        const lookB64 = await fileToBase64(lookFile);
        payload.look_image = { media_type: lookFile.type, data: lookB64 };
      } else {
        payload.look_text = lookText.trim();
      }

      // This calls YOUR backend — not Anthropic directly. Your backend holds the API key,
      // calls Claude, and returns the parsed tutorial JSON in the shape below.
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Request failed");
      const parsed = await response.json();
      setResult(parsed);
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating your tutorial. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#1a0b1f] text-[#fff6ec]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap');
        .font-serif { font-family: 'Fraunces', serif; }
        .gradient-text {
          background: linear-gradient(90deg, #ff3d7f, #ff6b4a 60%, #ffc857);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `}</style>

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-[#4a2354] px-6 py-16 sm:px-10"
        style={{ background: "radial-gradient(ellipse at top, rgba(255,61,127,0.18), transparent 60%)" }}>
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#ffc857]">Your face, your look</div>
          <h1 className="font-serif gradient-text text-4xl italic font-semibold leading-tight sm:text-5xl">
            The mirror that teaches you the look
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-[#b592c2]">
            Upload your bare face and the look you want. Get a personalized step-by-step
            tutorial and a shopping list from brands you already trust.
          </p>
        </div>
      </header>

      {/* Upload section */}
      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-10">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="font-serif text-lg">1. Your bare face</span>
            </div>
            <UploadTile
              label="Upload a bare-face photo"
              sublabel="Good lighting, no makeup"
              file={faceFile}
              onFile={setFaceFile}
              icon={Camera}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-serif text-lg">2. The look you want</span>
              <div className="flex gap-1 rounded-full bg-[#2a1330] p-1 text-xs">
                <button
                  onClick={() => setLookMode("text")}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${lookMode === "text" ? "bg-gradient-to-r from-[#ff3d7f] to-[#ff6b4a] text-[#1a0b1f]" : "text-[#b592c2]"}`}
                >
                  <Type size={12} className="inline mr-1 -mt-0.5" />Describe
                </button>
                <button
                  onClick={() => setLookMode("image")}
                  className={`rounded-full px-3 py-1 font-semibold transition-colors ${lookMode === "image" ? "bg-gradient-to-r from-[#ff3d7f] to-[#ff6b4a] text-[#1a0b1f]" : "text-[#b592c2]"}`}
                >
                  <Camera size={12} className="inline mr-1 -mt-0.5" />Upload
                </button>
              </div>
            </div>
            {lookMode === "text" ? (
              <textarea
                value={lookText}
                onChange={(e) => setLookText(e.target.value)}
                placeholder="e.g. Soft glam with a warm terracotta eye, glossy nude lip, and a natural dewy base..."
                className="h-full min-h-[220px] w-full resize-none rounded-2xl border border-[#4a2354] bg-[#2a1330] p-4 text-sm text-[#fff6ec] placeholder-[#6b5478] outline-none focus:border-[#ff3d7f]"
                style={{ aspectRatio: "3/4" }}
              />
            ) : (
              <UploadTile
                label="Upload a reference look"
                sublabel="A photo of the makeup you want"
                file={lookFile}
                onFile={setLookFile}
                icon={Upload}
              />
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            disabled={!canGenerate || loading}
            onClick={handleGenerate}
            className="flex items-center gap-2 rounded-full px-8 py-3 font-bold text-[#1a0b1f] transition-all disabled:cursor-not-allowed disabled:bg-[#4a2354] disabled:text-[#7a6584]"
            style={!loading && canGenerate ? { background: "linear-gradient(90deg, #ffc857, #ff6b4a, #ff3d7f)" } : {}}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analyzing your face...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate my tutorial
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-[#ff6b4a]">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="mt-14 space-y-10 border-t border-[#4a2354] pt-10">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ffc857]">Your look</div>
              <p className="font-serif mt-2 text-xl italic">{result.look_summary}</p>
            </div>

            {result.final_look_image && (
              <div className="flex justify-center">
                <img
                  src={result.final_look_image}
                  alt="Your final look"
                  className="max-w-[340px] w-full rounded-2xl border border-[#4a2354]"
                />
              </div>
            )}

            <div className="grid gap-3 rounded-2xl border border-[#4a2354] bg-[#2a1330] p-5 sm:grid-cols-5">
              {Object.entries(result.face_profile || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-[#ffc857]">{k.replace(/_/g, " ")}</div>
                  <div className="mt-1 text-sm text-[#fff6ec]">{v}</div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="font-serif mb-4 flex items-center gap-2 text-2xl italic">
                <ArrowRight size={18} className="text-[#ff3d7f]" /> Step by step
              </h2>
              <ol className="space-y-4">
                {(result.steps || []).map((s, i) => (
                  <li key={i} className="flex gap-4 rounded-2xl border border-[#4a2354] bg-[#2a1330] p-4">
                    <div className="font-serif flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#ff3d7f] text-sm italic text-[#ff3d7f]">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[#fff6ec]">{s.title}</div>
                      <div className="mt-1 text-sm text-[#b592c2]">{s.instruction}</div>
                      {s.product_category && (
                        <div className="mt-2 inline-block rounded-full bg-[#ff3d7f]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#ffc857]">
                          {s.product_category}
                        </div>
                      )}
                      {s.diagram_image && (
                        <img
                          src={s.diagram_image}
                          alt={`${s.title} placement diagram`}
                          className="mt-3 h-28 w-28 rounded-lg border border-[#4a2354] object-cover"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h2 className="font-serif mb-4 flex items-center gap-2 text-2xl italic">
                <ShoppingBag size={18} className="text-[#ff3d7f]" /> Shopping list
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(result.shopping_list || []).map((p, i) => (
                  <div key={i} className="rounded-2xl border border-[#4a2354] bg-[#2a1330] p-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#ff3d7f]">{p.category}</div>
                    <div className="mt-1 font-semibold text-[#fff6ec]">{p.brand}</div>
                    <div className="text-sm text-[#b592c2]">{p.product_type}</div>
                    {p.shade_or_finish_note && (
                      <div className="mt-1 text-xs text-[#8a749a]">{p.shade_or_finish_note}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-[#6b5478]">
                Prototype note: shopping list shows product types and brands only — live pricing
                and affiliate links get wired in once retailer affiliate accounts are approved.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
