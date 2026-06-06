// app/api/scan/route.ts
import { readMenuFromEnv } from "@/lib/ai/readMenu";

export async function POST(req: Request): Promise<Response> {
  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return Response.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  try {
    const read = readMenuFromEnv();
    const dishes = await read(body.imageBase64, body.mimeType);
    return Response.json({ dishes });
  } catch (err) {
    console.error("[api/scan] read failed:", err);
    return Response.json(
      { error: "Could not read the menu. Try a clearer photo, or type it." },
      { status: 502 },
    );
  }
}
