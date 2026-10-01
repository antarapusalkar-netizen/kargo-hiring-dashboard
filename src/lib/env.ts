// Central place to read + validate required env vars, so every route fails
// fast with a clear, specific message instead of a generic crash.

export class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(
      `Missing required environment variable: ${key}. Set it in .env.local for local development, or in your Vercel project's Environment Variables for production.`
    );
    this.name = "MissingEnvError";
  }
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new MissingEnvError(key);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get openaiModel() {
    return process.env.OPENAI_MODEL || "gpt-4.1";
  },
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  get resendFromAddress() {
    return process.env.RESEND_FROM_ADDRESS || "hiring@kargo.example.com";
  },
  /**
   * Optional. When set, every outgoing email is redirected to this address
   * instead of the candidate's real one (subject gets a "[Test — ...]" tag
   * so the intended recipient is still visible). Needed because Resend's
   * sandbox mode only delivers to the Resend account's own email until a
   * sending domain is verified — this lets the full Advance/Reject → Send
   * flow be exercised against real candidates before a domain exists.
   * Unset this once a verified domain + real RESEND_FROM_ADDRESS are set up.
   */
  get resendTestRedirectEmail() {
    return process.env.RESEND_TEST_REDIRECT_EMAIL || null;
  },
};

/** Non-throwing check used by UI/API to show a setup banner instead of a hard crash. */
export function checkEnv() {
  const missing: string[] = [];
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
  ]) {
    if (!process.env[key]) missing.push(key);
  }
  // RESEND_API_KEY is only needed at send-time, not for scoring, so it is
  // reported separately rather than blocking the whole dashboard.
  const missingResend = !process.env.RESEND_API_KEY;
  return { ok: missing.length === 0, missing, missingResend };
}
