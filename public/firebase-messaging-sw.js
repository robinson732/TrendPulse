importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC9HhxoXwciHDIagq4-pEyrf6KSRFDaJbM",
  authDomain: "trendpulse-93668.firebaseapp.com",
  projectId: "trendpulse-93668",
  storageBucket: "trendpulse-93668.firebasestorage.app",
  messagingSenderId: "547319257323",
  appId: "1:547319257323:web:1e8eb81a6c66d79ca246ae",
  measurementId: "G-3P5BSYTD8M",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "TrendPulse";
  const options = {
    body: payload.notification?.body || "New trending topic alert!",
    icon: "/assets/images/logo.png",
    badge: "/assets/images/logo.png",
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
