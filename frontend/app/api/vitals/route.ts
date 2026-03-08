import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json()
    // Log vitals server-side for future aggregation
    console.log("[Web Vitals]", JSON.stringify(metric))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
