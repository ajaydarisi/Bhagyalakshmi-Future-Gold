import { Capacitor } from "@capacitor/core";

type ImpactStyle = "light" | "medium" | "heavy";
type NotificationType = "success" | "warning" | "error";

const IMPACT_STYLE_MAP: Record<ImpactStyle, string> = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

const NOTIFICATION_TYPE_MAP: Record<NotificationType, string> = {
  success: "Success",
  warning: "Warning",
  error: "Error",
};

export async function hapticImpact(style: ImpactStyle = "medium"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({
      style: ImpactStyle[IMPACT_STYLE_MAP[style] as keyof typeof ImpactStyle],
    });
  } catch {}
}

export async function hapticNotification(type: NotificationType): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({
      type: NotificationType[NOTIFICATION_TYPE_MAP[type] as keyof typeof NotificationType],
    });
  } catch {}
}

export async function hapticSelection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionChanged();
  } catch {}
}
