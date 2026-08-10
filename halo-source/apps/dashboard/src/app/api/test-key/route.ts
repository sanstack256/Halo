import { NextResponse } from "next/server";
import { generateApiKey } from "@/lib/api-key";

export async function GET() {
    const key = await generateApiKey();

    return NextResponse.json(key);
}