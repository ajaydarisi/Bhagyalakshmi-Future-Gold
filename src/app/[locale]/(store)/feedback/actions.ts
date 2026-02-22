"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFeedbackNotificationEmail } from "@/lib/email";
import type { FeedbackInput } from "@/lib/validators";

export async function submitFeedback(data: FeedbackInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = data.name || "";
  let email = data.email || "";
  let userId: string | null = null;

  if (user) {
    userId = user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    name = profile?.full_name || name;
    email = user.email || email;
  }

  if (!name || !email) {
    throw new Error("Name and email are required");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("feedback").insert({
    user_id: userId,
    name,
    email,
    rating: data.rating,
    message: data.message,
  });

  if (error) {
    throw new Error("Failed to submit feedback. Please try again.");
  }

  await sendFeedbackNotificationEmail(name, email, data.rating, data.message);

  return { success: true };
}
