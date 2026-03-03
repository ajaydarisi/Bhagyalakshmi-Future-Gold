import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  // Verify admin auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      title,
      body: msgBody,
      imageUrl,
      data,
      targetType,
      targetValue,
      type,
    } = body;

    // Create notification record
    const { data: notification, error: insertError } = await admin
      .from("notifications")
      .insert({
        title,
        body: msgBody,
        image_url: imageUrl || null,
        data: data || {},
        type: type || "custom",
        target_type: targetType || "all",
        target_value: targetValue || null,
        status: "sending",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    const messaging = getFirebaseMessaging();
    let sentCount = 0;
    let failedCount = 0;

    if (targetType === "topic" || targetType === "all") {
      const topic = targetType === "all" ? "all_users" : targetValue;
      try {
        await messaging.send({
          topic,
          notification: {
            title,
            body: msgBody,
            imageUrl: imageUrl || undefined,
          },
          data: data || {},
          android: {
            priority: "high",
            notification: { channelId: "default", sound: "default", color: "#7a462e" },
          },
        });
        sentCount = 1;
      } catch {
        failedCount = 1;
      }
    } else if (targetType === "user" && targetValue) {
      const { data: deviceTokens } = await admin
        .from("device_tokens")
        .select("token")
        .eq("user_id", targetValue)
        .eq("is_active", true);

      const tokens = (deviceTokens || []).map((d) => d.token);

      if (tokens.length > 0) {
        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title,
            body: msgBody,
            imageUrl: imageUrl || undefined,
          },
          data: data || {},
          android: {
            priority: "high",
            notification: { channelId: "default", sound: "default", color: "#7a462e" },
          },
        });
        sentCount = response.successCount;
        failedCount = response.failureCount;

        // Collect and deactivate stale tokens
        const staleTokens = response.responses
          .map((resp, idx) =>
            resp.error?.code === "messaging/registration-token-not-registered"
              ? tokens[idx]
              : null
          )
          .filter(Boolean) as string[];

        if (staleTokens.length > 0) {
          await admin
            .from("device_tokens")
            .update({ is_active: false })
            .in("token", staleTokens);

          // Don't count stale token failures as real failures
          failedCount -= staleTokens.length;
        }
      }
    }

    // Update notification record
    await admin
      .from("notifications")
      .update({
        status: failedCount > 0 && sentCount === 0 ? "failed" : "sent",
        sent_count: sentCount,
        failed_count: failedCount,
        sent_at: new Date().toISOString(),
      })
      .eq("id", notification.id);

    return NextResponse.json({
      status: "ok",
      notificationId: notification.id,
      sentCount,
      failedCount,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
