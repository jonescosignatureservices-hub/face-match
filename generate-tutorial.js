// api/generate-tutorial.js
//
// Deploy target: Vercel (or adapt easily to Netlify Functions / AWS Lambda / Cloudflare Workers).
// This is the ONLY place your API keys should live.
//
// Setup:
//   1. Put this file at api/generate-tutorial.js in a Vercel project.
//   2. In the Vercel dashboard, add environment variables:
//        ANTHROPIC_API_KEY  (for the tutorial text + face analysis)
//        OPENAI_API_KEY     (for the final-look image and step diagrams)
//   3. Deploy. Your frontend (index.html or MakeupTutorialApp.jsx) can then call
//      POST https://your-app.vercel.app/api/generate-tutorial
//
// Local testing:
//   npm install
//   vercel dev
//   (requires a .env.local file with both keys set)

async function generateFinalLookImage({ apiKey, faceImage, lookSummary }) {
  // Uses OpenAI's image edit endpoint to show the user's own uploaded face
  // with the target makeup applied. Returns a base64 PNG string, or null on failure.
  const form = new FormData();
  const bytes = Buffer.from(faceImage.data, "base64");
  const blob = new Blob([bytes], { type: faceImage.media_type });
  form.append("image", blob, "face.png");
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    `Apply this makeup look to the person's face, keeping their exact facial features, identity, skin, and proportions unchanged — only add makeup: ${lookSummary}. Photorealistic, natural lighting, no other edits to the face or background.`
  );
  form.append("size", "1024x1024");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.error("OpenAI final-look image error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.b64_json || null;
}

async function generateStepDiagram({ apiKey, step }) {
  // Generates a simple illustrated face diagram (not the user's real face) marking
  // where this step's product goes — arrows/shaded zones, not a photoreal image.
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `Simple flat illustrated diagram of a generic front-facing head/face outline, minimal line art style, with clear arrows and shaded zones showing exactly where to apply: ${step.title} — ${step.instruction}. Clean beauty-tutorial diagram style, plain background, no text labels, no photorealism.`,
      size: "512x512",
    }),
  });

  if (!res.ok) {
    console.error("OpenAI step diagram error for", step.title, res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.b64_json || null;
}

export default async function handler(req, res) {
  // CORS — restrict this to your actual frontend domain before going live
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const imageApiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    const { brands, face_image, look_mode, look_text, look_image } = req.body || {};

    // --- Basic request validation ---
    if (!Array.isArray(brands) || brands.length === 0) {
      return res.status(400).json({ error: "brands is required" });
    }
    if (!face_image || !face_image.data || !face_image.media_type) {
      return res.status(400).json({ error: "face_image is required" });
    }
    if (look_mode === "text" && (!look_text || !look_text.trim())) {
      return res.status(400).json({ error: "look_text is required when look_mode is text" });
    }
    if (look_mode === "image" && (!look_image || !look_image.data)) {
      return res.status(400).json({ error: "look_image is required when look_mode is image" });
    }

    // --- Very basic per-request size guard (base64 image sanity check) ---
    const MAX_B64_LEN = 8_000_000; // ~6MB decoded, generous for a phone photo
    if (face_image.data.length > MAX_B64_LEN) {
      return res.status(413).json({ error: "face_image too large" });
    }
    if (look_image && look_image.data.length > MAX_B64_LEN) {
      return res.status(413).json({ error: "look_image too large" });
    }

    // --- Build the Claude request ---
    const content = [
      {
        type: "image",
        source: { type: "base64", media_type: face_image.media_type, data: face_image.data },
      },
    ];

    if (look_mode === "image" && look_image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: look_image.media_type, data: look_image.data },
      });
    }

    const promptText = `The first image is a bare face (no makeup). ${
      look_mode === "image"
        ? "The second image is the target makeup look the user wants to achieve."
        : `The user wants this look, described in their own words: "${look_text}"`
    }
Analyze the face (skin tone, undertone, face shape, eye shape, lip shape) and generate a personalized makeup tutorial to achieve the target look on this specific face.
Only recommend products from this partner brand list: ${brands.join(", ")}.
Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "face_profile": {"skin_tone": "", "undertone": "", "face_shape": "", "eye_shape": "", "lip_shape": ""},
  "look_summary": "one sentence description of the target look",
  "steps": [{"title": "", "instruction": "", "product_category": ""}],
  "shopping_list": [{"category": "", "brand": "", "product_type": "", "shade_or_finish_note": ""}]
}
Keep steps to 6-9 items and shopping_list to one entry per major category used. Be specific and personalized to the analyzed face, not generic.`;

    content.push({ type: "text", text: promptText });

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errBody);
      return res.status(502).json({ error: "Tutorial generation failed upstream" });
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "No response from analysis" });
    }

    // Strip markdown fences, then pull out just the {...} JSON object in case
    // Claude added any stray text before/after it.
    let cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Claude response as JSON. Stop reason:", data.stop_reason, "Raw text:", textBlock.text);
      return res.status(502).json({ error: "Could not parse tutorial response" });
    }

    // --- Image generation (final look + step diagrams) ---
    // Only runs if OPENAI_API_KEY is configured. If it's missing or a call fails,
    // the app still returns the full text tutorial — images are additive, not required.
    if (imageApiKey) {
      const [finalLookB64, stepDiagramB64s] = await Promise.all([
        generateFinalLookImage({
          apiKey: imageApiKey,
          faceImage: face_image,
          lookSummary: parsed.look_summary || look_text || "the requested makeup look",
        }),
        Promise.all(
          (parsed.steps || []).map((step) => generateStepDiagram({ apiKey: imageApiKey, step }))
        ),
      ]);

      parsed.final_look_image = finalLookB64 ? `data:image/png;base64,${finalLookB64}` : null;
      parsed.steps = (parsed.steps || []).map((step, i) => ({
        ...step,
        diagram_image: stepDiagramB64s[i] ? `data:image/png;base64,${stepDiagramB64s[i]}` : null,
      }));
    } else {
      parsed.final_look_image = null;
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Unhandled error in generate-tutorial:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

