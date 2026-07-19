import "dotenv/config";

export function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name} — copy voice-agent/.env.example to voice-agent/.env and fill it in.`,
    );
  }
  return v;
}

export function validateEnvironment(): void {
  const missing = ["SARVAM_API_KEY", "VOICE_TOKEN_SECRET"].filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production") {
    if ((process.env.VOICE_TOKEN_SECRET?.length ?? 0) < 32) {
      throw new Error("VOICE_TOKEN_SECRET must be at least 32 characters in production");
    }
    if (
      process.env.VOICE_TOKEN_PREVIOUS_SECRET &&
      process.env.VOICE_TOKEN_PREVIOUS_SECRET.length < 32
    ) {
      throw new Error(
        "VOICE_TOKEN_PREVIOUS_SECRET must be at least 32 characters when configured",
      );
    }
    if (!(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN)?.trim()) {
      throw new Error("ALLOWED_ORIGINS is required in production");
    }
  }
}
