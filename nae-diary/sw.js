self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = "/mail";
  try {
    if (event.notification.data && event.notification.data.url) {
      target = event.notification.data.url;
    }
  } catch (error) {}
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i];
        if (!client || !client.url) continue;
        try {
          var path = new URL(client.url).pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/";
          if (path === "/mail" && "focus" in client) return client.focus();
        } catch (error) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});

self.addEventListener("push", function (event) {
  var payload = {
    title: "새 메일",
    body: "받은편지함에 새 메일이 있습니다.",
    url: "/mail",
  };
  try {
    if (event.data) {
      var data = event.data.json();
      if (data && typeof data === "object") {
        if (data.title) payload.title = data.title;
        if (data.body) payload.body = data.body;
        if (data.url) payload.url = data.url;
      }
    }
  } catch (error) {
    try {
      var text = event.data && event.data.text();
      if (text) payload.body = text;
    } catch (err) {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "nae-diary-mail",
      renotify: true,
      data: { url: payload.url },
    })
  );
});
