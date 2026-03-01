"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface NetworkContextType {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

export function useNetwork(): NetworkContextType {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let handle: { remove: () => void } | null = null;

      import("@capacitor/network").then(({ Network }) => {
        Network.getStatus().then((status) => {
          setIsOnline(status.connected);
        });

        Network.addListener("networkStatusChange", (status) => {
          setIsOnline(status.connected);
        }).then((h) => {
          handle = h;
        });
      });

      return () => {
        handle?.remove();
      };
    } else {
      const update = () => setIsOnline(navigator.onLine);
      update();
      window.addEventListener("online", update);
      window.addEventListener("offline", update);
      return () => {
        window.removeEventListener("online", update);
        window.removeEventListener("offline", update);
      };
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}
