// app/api/generate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Define the Zod schema for validating the creative response
const CreativeSchema = z.object({
  platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "google_display"]),
  product_or_service: z.string(),
  audience: z.array(z.string()).min(1),
  angles: z.array(z.string()).min(2),
  primary_text: z.string(),
  headline: z.string(),
  description: z.string(),
  cta: z.string(),
  hashtags: z.array(z.string()).optional(),
  image_prompts: z.array(z.string()).min(2),
  video_script: z.object({
    duration_seconds: z.number().int().min(10).max(60),
    beats: z.array(
      z.object({
        timestamp: z.string(),
        shot: z.string(),
        voiceover: z.string(),
      })
    ).min(4),
  }),
});

// JSON schema for OpenAI’s structured response
const jsonSchema = {
  name: "AdCreative",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      platform: { enum: ["facebook", "instagram", "tiktok", "youtube", "google_display"] },
      product_or_service: { type: "string" },
      audience: { type: "array", items: { type: "string" }, minItems: 1 },
      angles: { type: "array", items: { type: "string" }, minItems: 2 },
      primary_text: { type: "string" },
      headline: { type: "string" },
      description: { type: "string" },
      cta: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
      image_prompts: { type: "array", items: { type: "string" }, minItems: 2 },
      video_script: {
        type: "object",
        additionalProperties: false,
        properties: {
          duration_seconds: { type: "integer", minimum: 10, maximum: 60 },
          beats: {
            type: "array",
            minItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                timestamp: { type: "string" },
                shot: { type: "string" },
                voiceover: { type: "string" },
              },
              required: ["timestamp", "shot", "voiceover"],
            },
          },
        },
        required: ["duration_seconds", "beats"],
      },
    },
    required: [
      "platform",
      "product_or_service",
      "audience",
      "angles",
      "primary_text",
      "headline",
      "description",
      "cta",
      "image_prompts",
      "video_script",
    ],
  },
  strict: true,
} as const;

export const GET = async () =>
  NextResponse.json({
    ok: true,
    message: "POST { prompt, platform } to this endpoint to generate ad creatives.",
  });

export const POST = async (req: Request) => {
  // Ensure the API key is set
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, platform = "facebook" } = body || {};
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing required field: prompt" }, { status: 400 });
  }

  try {
    // Compose the request with a professional ad‑creative system prompt
    const aiReq: any = {
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a professional direct-response ad creative expert. Your job is to generate high-converting ad copy and ideas for the specified platform and product or service. Use persuasive hooks, emotional triggers, and clear calls to action. Follow platform guidelines (e.g. character limits, no policy violations) and provide the result as structured JSON matching the provided schema exactly.",
        },
        {
          role: "user",
          content: [
            `Brief: ${prompt}`,
            `Platform: ${platform}`,
            "Tone: direct-response",
            "Locale: en-US",
            "Constraints: Keep primary text ≤ 550 chars (Meta), headline ≤ 60, description ≤ 90. Include ≥ 2 image prompts and a short UGC video outline.",
          ].join("\n"),
        },
      ],
      response_format: { type: "json_schema", json_schema: jsonSchema },
    };

    const aiRes = await (openai as any).responses.create(aiReq);
    const outputText: string = (aiRes as any).output_text;
    let creative: unknown;
    try {
      creative = JSON.parse(outputText);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON", raw: outputText }, { status: 502 });
    }

    const parsed = CreativeSchema.safeParse(creative);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Schema validation failed", issues: parsed.error.issues },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, creative: parsed.data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error calling OpenAI" },
      { status: 500 }
    );
  }
};
