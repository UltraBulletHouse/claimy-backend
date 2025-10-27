import admin from 'firebase-admin';
import { connectDB } from './db';
import UserModel from '../models/User';

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_DATABASE_URL
} = process.env;

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

export async function sendPushNotification(userToken: string, title: string, body: string) {
  initializeFirebase();

  if (!firebaseInitialized) {
    throw new Error('Firebase is not initialized. Check credentials.');
  }

  await admin.messaging().send({
    token: userToken,
    notification: {
      title,
      body
    }
  });
}

export async function sendFCMNotification(userId: string, title: string, body: string) {
  await connectDB();
  const user = await UserModel.findById(userId);
  if (!user || !user.fcmToken) {
    throw new Error('User token not available for notifications.');
  }

  await sendPushNotification(user.fcmToken, title, body);
}
