"use client";

import { Capacitor } from "@capacitor/core";
import type { ComponentProps } from "react";

/**
 * An <a> tag that opens URLs via the system intent handler on native
 * (e.g. geo: URIs open Google Maps), and falls back to normal behavior on web.
 */
export function ExternalLink({
  geoUri,
  ...props
}: ComponentProps<"a"> & { geoUri?: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        if (Capacitor.isNativePlatform() && geoUri) {
          e.preventDefault();
          window.location.href = geoUri;
          return;
        }
        props.onClick?.(e);
      }}
    />
  );
}
