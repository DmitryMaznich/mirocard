import webpush from "web-push";

let configured = false;

export function configureWebPush(publicKey, privateKey, subject) {
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(subscription, payload) {
  if (!configured) return;
  return webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    JSON.stringify(payload),
    { TTL: 60, urgency: "normal" }
  );
}
