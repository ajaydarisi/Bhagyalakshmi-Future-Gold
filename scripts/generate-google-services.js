#!/usr/bin/env node

/**
 * Generates android/app/google-services.json from environment variables.
 * Run: node scripts/generate-google-services.js
 *
 * Required env vars (set in .env.local):
 *   FIREBASE_PROJECT_NUMBER
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_STORAGE_BUCKET
 *   FIREBASE_MOBILESDK_APP_ID
 *   FIREBASE_ANDROID_API_KEY
 */

const fs = require("fs");
const path = require("path");

// Load .env.local if running standalone (not via Next.js)
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const required = [
  "FIREBASE_PROJECT_NUMBER",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MOBILESDK_APP_ID",
  "FIREBASE_ANDROID_API_KEY",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("Missing environment variables:", missing.join(", "));
  process.exit(1);
}

const googleServices = {
  project_info: {
    project_number: process.env.FIREBASE_PROJECT_NUMBER,
    project_id: process.env.FIREBASE_PROJECT_ID,
    storage_bucket: process.env.FIREBASE_STORAGE_BUCKET,
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: process.env.FIREBASE_MOBILESDK_APP_ID,
        android_client_info: {
          package_name: "com.bhagyalakshmifuturegold.app",
        },
      },
      oauth_client: [],
      api_key: [
        {
          current_key: process.env.FIREBASE_ANDROID_API_KEY,
        },
      ],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [],
        },
      },
    },
  ],
  configuration_version: "1",
};

const outPath = path.resolve(__dirname, "..", "android", "app", "google-services.json");
fs.writeFileSync(outPath, JSON.stringify(googleServices, null, 2) + "\n");
console.log("Generated", outPath);
