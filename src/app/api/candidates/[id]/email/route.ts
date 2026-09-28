import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { env, MissingEnvError } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const type = body?.type;
  if (type !== "interview" && type !== "rejection") {
    return NextResponse.json(
      { error: 'Body must include type: "interview" or "rejection".' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id, name, email")
    .eq("id", id)
    .maybeSingle();
  if (candidateError || !candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }
  if (!candidate.email) {
    return NextResponse.json(
      { error: "This candidate has no email address on file — cannot send." },
      { status: 400 }
    );
  }

  const { data: brief, error: briefError } = await supabase
    .from("interview_briefs")
    .select("*")
    .eq("candidate_id", id)
    .maybeSingle();
  if (briefError || !brief) {
    return NextResponse.json(
      { error: "No draft email has been generated for this candidate yet." },
      { status: 400 }
    );
  }

  const subject =
    type === "interview" ? brief.email_interview_subject : brief.email_rejection_subject;
  const bodyText =
    type === "interview" ? brief.email_interview_body : brief.email_rejection_body;
  if (!subject || !bodyText) {
    return NextResponse.json(
      { error: "The draft email for this type is missing." },
      { status: 400 }
    );
  }

  let resendApiKey: string;
  try {
    resendApiKey = env.resendApiKey;
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }

  try {
    const resend = new Resend(resendApiKey);
    const { error: sendError } = await resend.emails.send({
      from: env.resendFromAddress,
      to: candidate.email,
      subject,
      text: bodyText,
    });
    if (sendError) {
      return NextResponse.json(
        { error: `Resend failed to send: ${sendError.message}` },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: `Email send failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 502 }
    );
  }

  await supabase
    .from("interview_briefs")
    .update({ sent_email_type: type, sent_at: new Date().toISOString() })
    .eq("candidate_id", id);

  return NextResponse.json({ ok: true });
}
