"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
) {
  if (!email) {
    return { success: false, error: "not_authenticated" };
  }

  if (currentPassword === newPassword) {
    return { success: false, error: "same_password" };
  }

  const admin = createAdminClient();

  // Verify current password and get user data in one call
  const { data: signInData, error: signInError } =
    await admin.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

  if (signInError || !signInData.user) {
    return { success: false, error: "wrong_password" };
  }

  // Update password using the verified user's ID
  const { error: updateError } = await admin.auth.admin.updateUserById(
    signInData.user.id,
    { password: newPassword }
  );

  if (updateError) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}
