"use client";

import { useEffect, useCallback } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { Capacitor } from "@capacitor/core";
import { hapticImpact, hapticSelection } from "@/lib/haptics";

interface ImageGalleryLightboxProps {
  images: string[];
  name: string;
  open: boolean;
  index: number;
  onClose: () => void;
}

export function ImageGalleryLightbox({
  images,
  name,
  open,
  index,
  onClose,
}: ImageGalleryLightboxProps) {
  // Handle Android hardware back button
  useEffect(() => {
    if (!open || !Capacitor.isNativePlatform()) return;

    let removed = false;
    let removeListener: (() => void) | undefined;

    import("@capacitor/app").then(({ App }) => {
      if (removed) return;
      App.addListener("backButton", () => {
        onClose();
      }).then((handle) => {
        if (removed) {
          handle.remove();
        } else {
          removeListener = () => handle.remove();
        }
      });
    });

    return () => {
      removed = true;
      removeListener?.();
    };
  }, [open, onClose]);

  const handleView = useCallback(() => {
    hapticSelection();
  }, []);

  const handleEntering = useCallback(() => {
    hapticImpact("light");
  }, []);

  const handleExiting = useCallback(() => {
    hapticImpact("light");
  }, []);

  const slides = images.map((src, i) => ({
    src,
    alt: `${name} - Image ${i + 1}`,
  }));

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom, Counter]}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
      }}
      carousel={{
        finite: false,
      }}
      animation={{
        swipe: 250,
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      on={{
        view: handleView,
        entering: handleEntering,
        exiting: handleExiting,
      }}
    />
  );
}
