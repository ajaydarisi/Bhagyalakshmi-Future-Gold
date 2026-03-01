const CACHE_NAME = "bfg-v3";
const ASSETS_CACHE = "bfg-assets-v1";
const IMAGES_CACHE = "bfg-images-v1";
const MAX_CACHED_IMAGES = 200;
const IDB_NAME = "bfg-background";
const IDB_STORE = "pending-ops";

const STATIC_ASSETS = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/offline.html",
  "/logos/darisi.svg",
];

// Supabase config received from main thread
let supabaseConfig = null;

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  const validCaches = new Set([CACHE_NAME, ASSETS_CACHE, IMAGES_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.has(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Navigation requests: network-first, fall back to offline.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Next.js static assets: stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkResponse = await fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => null);
        return cached || networkResponse || new Response("", { status: 503 });
      })
    );
    return;
  }

  // Supabase storage images: cache-first (images are content-addressed)
  if (url.hostname.includes("supabase.co") && url.pathname.includes("/storage/")) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          if (response.ok) {
            // Evict oldest entry if over limit
            const keys = await cache.keys();
            if (keys.length >= MAX_CACHED_IMAGES) {
              await cache.delete(keys[0]);
            }
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // All other GET requests: network-first, fall back to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ─── Message handler (config + image preloading) ────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data.type === "CONFIG") {
    supabaseConfig = {
      url: event.data.supabaseUrl,
      anonKey: event.data.supabaseAnonKey,
    };
  }

  if (event.data.type === "PRELOAD_IMAGES") {
    event.waitUntil(preloadImages(event.data.urls));
  }
});

async function preloadImages(urls) {
  const cache = await caches.open(IMAGES_CACHE);
  const existingKeys = await cache.keys();
  const existingUrls = new Set(existingKeys.map((r) => r.url));
  const toFetch = urls.filter((u) => !existingUrls.has(u));

  // Fetch in batches of 4 to avoid network congestion
  for (let i = 0; i < toFetch.length; i += 4) {
    const batch = toFetch.slice(i, i + 4);
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const keys = await cache.keys();
            if (keys.length >= MAX_CACHED_IMAGES) {
              await cache.delete(keys[0]);
            }
            await cache.put(url, resp);
          }
        } catch {
          // Skip failed image fetches
        }
      })
    );
  }
}

// ─── Background Sync ────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "bfg-sync-mutations") {
    event.waitUntil(replayQueueFromSW());
  }
});

async function replayQueueFromSW() {
  if (!supabaseConfig) return;

  const ops = await idbGetAll();
  if (ops.length === 0) return;

  // Sort by creation time
  ops.sort((a, b) => a.createdAt - b.createdAt);

  for (const op of ops) {
    try {
      await executeOpViaREST(op);
      await idbRemove(op.id);
    } catch {
      op.retryCount = (op.retryCount || 0) + 1;
      if (op.retryCount >= (op.maxRetries || 5)) {
        await idbRemove(op.id);
      } else {
        await idbPutOp(op);
      }
    }
  }
}

async function executeOpViaREST(op) {
  const { url, anonKey } = supabaseConfig;
  const headers = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${op.payload.accessToken || anonKey}`,
    Prefer: "return=minimal",
  };

  const userId = op.payload.userId;
  const productId = op.payload.productId;

  switch (op.type) {
    case "cart-add": {
      const resp = await fetch(
        `${url}/rest/v1/cart_items?on_conflict=user_id,product_id`,
        {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal,resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId,
            quantity: op.payload.quantity,
          }),
        }
      );
      if (!resp.ok && resp.status !== 409) throw new Error(resp.statusText);
      break;
    }
    case "cart-update": {
      const resp = await fetch(
        `${url}/rest/v1/cart_items?user_id=eq.${userId}&product_id=eq.${productId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ quantity: op.payload.quantity }),
        }
      );
      if (!resp.ok) throw new Error(resp.statusText);
      break;
    }
    case "cart-remove": {
      const resp = await fetch(
        `${url}/rest/v1/cart_items?user_id=eq.${userId}&product_id=eq.${productId}`,
        { method: "DELETE", headers }
      );
      if (!resp.ok) throw new Error(resp.statusText);
      break;
    }
    case "cart-clear": {
      const resp = await fetch(
        `${url}/rest/v1/cart_items?user_id=eq.${userId}`,
        { method: "DELETE", headers }
      );
      if (!resp.ok) throw new Error(resp.statusText);
      break;
    }
    case "wishlist-add": {
      const resp = await fetch(
        `${url}/rest/v1/wishlist_items?on_conflict=user_id,product_id`,
        {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal,resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId,
          }),
        }
      );
      if (!resp.ok && resp.status !== 409) throw new Error(resp.statusText);
      break;
    }
    case "wishlist-remove": {
      const resp = await fetch(
        `${url}/rest/v1/wishlist_items?user_id=eq.${userId}&product_id=eq.${productId}`,
        { method: "DELETE", headers }
      );
      if (!resp.ok) throw new Error(resp.statusText);
      break;
    }
  }
}

// ─── Periodic Background Sync (PWA only) ────────────────────────────────────

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "bfg-refresh-prices") {
    event.waitUntil(refreshCachedPrices());
  }
});

async function refreshCachedPrices() {
  if (!supabaseConfig) return;

  try {
    const PRODUCT_CACHE_KEY = "bfg-product-cache";
    // Read product cache from tracked-products store in IDB
    const tracked = await idbGetAllFromStore("tracked-products");
    if (tracked.length === 0) return;

    const ids = tracked.map((t) => t.id);
    const { url, anonKey } = supabaseConfig;

    const resp = await fetch(
      `${url}/rest/v1/products?id=in.(${ids.join(",")})&select=id,price,discount_price,stock,is_active`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }
    );

    if (!resp.ok) return;
    const freshData = await resp.json();

    // Notify all clients about price updates
    const clients = await self.clients.matchAll();
    clients.forEach((client) =>
      client.postMessage({ type: "PRICES_UPDATED", data: freshData })
    );
  } catch {
    // Silent fail for periodic sync
  }
}

// ─── IndexedDB helpers (for SW context) ─────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tracked-products")) {
        db.createObjectStore("tracked-products", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllFromStore(storeName) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRemove(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbPutOp(op) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(op);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
