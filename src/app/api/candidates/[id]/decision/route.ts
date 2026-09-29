import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Rubric Part 15 / non-negotiable #12: the AI never decides. This is the
 * ONLY place decision_status changes, and it only ever changes because
 * Arjun explicitly clicked Advance or Reject in the UI — never automatically
 * from a score or recommendation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision;
  if (decision !== "advanced" && decision !== "rejected") {
    return NextResponse.json(
      { error: 'Body must include decision: "advanced" or "rejected".' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: candidate, error: fetchError } = await supabase
    .from("candidates")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }
  if (candidate.status !== "scored") {
    return NextResponse.json(
      { error: "This candidate has not finished scoring yet." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("candidates")
    .update({ decision_status: decision, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, decisionStatus: decision });
}
