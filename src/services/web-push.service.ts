import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { PushSubscriptionRepository } from '../modules/notifications/push-subscription.repository';

const pushSubscriptionRepository = new PushSubscriptionRepository();

export class WebPushService {
  constructor() {
    this.initializeVapid();
  }

  private initializeVapid() {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.log('[WebPush] VAPID keys are missing. Generating new VAPID keys...');
      try {
        const vapidKeys = webpush.generateVAPIDKeys();
        publicKey = vapidKeys.publicKey;
        privateKey = vapidKeys.privateKey;

        // Update process.env so getters in config read them immediately
        process.env.VAPID_PUBLIC_KEY = publicKey;
        process.env.VAPID_PRIVATE_KEY = privateKey;

        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Clean existing VAPID entries if any (or just append)
        const lines = envContent.split('\n').filter(line => 
          !line.startsWith('VAPID_PUBLIC_KEY=') && 
          !line.startsWith('VAPID_PRIVATE_KEY=') &&
          !line.startsWith('VAPID_SUBJECT=')
        );

        lines.push(`VAPID_PUBLIC_KEY=${publicKey}`);
        lines.push(`VAPID_PRIVATE_KEY=${privateKey}`);
        lines.push(`VAPID_SUBJECT=mailto:support@syncra.app`);

        fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
        console.log('[WebPush] Successfully generated and wrote VAPID keys to .env');
      } catch (err) {
        console.error('[WebPush] Failed to generate/write VAPID keys to .env:', err);
      }
    }

    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@syncra.app',
        publicKey!,
        privateKey!
      );
      console.log('[WebPush] WebPush initialized successfully.');
    } catch (err) {
      console.error('[WebPush] Error setting VAPID details:', err);
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'info',
    clickUrl: string = '/'
  ): Promise<void> {
    try {
      const subscriptions = await pushSubscriptionRepository.findByUserId(userId);
      if (subscriptions.length === 0) return;

      const payload = JSON.stringify({
        title,
        body: message,
        type,
        clickUrl
      });

      const sendPromises = subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          await webpush.sendNotification(pushSubscription, payload);
        } catch (error: any) {
          // If browser push subscription is expired or revoked (410 Gone or 404 Not Found), delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[WebPush] Subscription expired (status ${error.statusCode}). Deleting subscription: ${sub.endpoint}`);
            await pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
          } else {
            console.error('[WebPush] Failed to send push notification to subscription:', error.message || error);
          }
        }
      });

      await Promise.all(sendPromises);
    } catch (err) {
      console.error('[WebPush] Error in sendPushNotification process:', err);
    }
  }
}

export const webPushService = new WebPushService();
export default webPushService;
