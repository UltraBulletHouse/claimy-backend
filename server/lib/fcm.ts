import admin from 'firebase-admin';
import { connectDB } from './db';
import UserModel from '../models/User';

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_DATABASE_URL
} = process.env;

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
};

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('Warning: Firebase credentials are not fully configured.');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: FIREBASE_DATABASE_URL
    });
    firebaseInitialized = true;
  } catch (error) {
    if ((error as { code?: string }).code === 'app/duplicate-app') {
      firebaseInitialized = true;
      return;
    }
    throw error;
  }
}

export async function sendPushNotification(userToken: string, payload: NotificationPayload) {
  initializeFirebase();

  if (!firebaseInitialized) {
    throw new Error('Firebase is not initialized. Check credentials.');
  }

  const data = payload.data
    ? Object.entries(payload.data).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    : undefined;

  await admin.messaging().send({
    token: userToken,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data
  });
}

export async function sendFCMNotification(userId: string, payload: NotificationPayload) {
  await connectDB();
  const user = await UserModel.findById(userId);
  if (!user || !user.fcmToken) {
    console.warn('FCM token not available for user', userId);
    return;
  }

  await sendPushNotification(user.fcmToken, payload);
}
