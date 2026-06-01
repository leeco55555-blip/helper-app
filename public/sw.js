/* Helper App — Service Worker */
const APP_NAME = "תזכורת";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: APP_NAME, body: event.data ? event.data.text() : "" };
  }
  const title = data.title || APP_NAME;
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "he",
    dir: "rtl",
    vibrate: [200, 100, 200],
    silent: false,
    timestamp: Date.now(),
    tag: data.tag || data.occurrence_id || "reminder",
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/today",
      occurrence_id: data.occurrence_id || null,
    },
    actions: data.actions || (data.occurrence_id ? [
      { action: "taken", title: "✓ בוצע" },
      { action: "skip", title: "דלג" },
    ] : []),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const occId = event.notification.data && event.notification.data.occurrence_id;
  const baseUrl = (event.notification.data && event.notification.data.url) || "/today";

  if (event.action === "taken" && occId) {
    event.notification.close();
    event.waitUntil(
      fetch(`/api/occurrences/${occId}/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "taken" }),
        credentials: "include",
      }).catch(() => {}),
    );
    return;
  }
  if (event.action === "skip" && occId) {
    event.notification.close();
    event.waitUntil(
      fetch(`/api/occurrences/${occId}/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
        credentials: "include",
      }).catch(() => {}),
    );
    return;
  }

  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        if (c.url.includes(baseUrl)) {
          c.focus();
          return;
        }
      }
      await self.clients.openWindow(baseUrl);
    })(),
  );
});
