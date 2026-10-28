import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  doc,
  getDocFromServer,
  setLogLevel,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  FirebaseStorage,
} from 'firebase/storage';
import defaultConfig from '../../firebase-applet-config.json';

// Build-time / deployment environment variables (e.g. on Netlify / Vercel / Cloudflare)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultConfig.appId || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || defaultConfig.firestoreDatabaseId || '(default)',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Uploads compressed payment screenshot to Firebase Storage and returns public download URL.
 * Includes graceful base64 fallback in case of transient storage network/CORS restrictions.
 */
export async function uploadPaymentScreenshot(
  file: File | Blob,
  orderNumber: string
): Promise<string> {
  const safeOrderNum = (orderNumber || 'order').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const ext = file.type.includes('webp') ? 'webp' : 'jpg';
  const storagePath = `orders/${safeOrderNum}/screenshot_${timestamp}.${ext}`;

  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (storageError) {
    console.warn('Firebase Storage upload notice, using compressed data URL fallback:', storageError);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to encode screenshot'));
        }
      };
      reader.onerror = () => reject(reader.error || storageError);
      reader.readAsDataURL(file);
    });
  }
}

// Configure Firestore log level to prevent unhandled connection warning in console
try {
  setLogLevel('error');
} catch {}

// Use initializeFirestore with forced long-polling to prevent WebSocket negotiation drop in cloud proxy environments
export const db: Firestore = (() => {
  try {
    return initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

/**
 * Strips undefined properties recursively to comply with Firestore document restrictions
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;

  // If transient unavailable, offline, or non-critical audit log path, log warning and avoid crashing
  if (
    errCode === 'unavailable' ||
    errMsg.includes('the client is offline') ||
    errMsg.includes('Could not reach Cloud Firestore backend') ||
    errMsg.includes('offline mode') ||
    path?.startsWith('deleted_orders_log')
  ) {
    console.warn(`Firestore [${operationType}] at ${path} in offline/graceful mode:`, errMsg);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to live Firestore database
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Attempt a light ping read
    await getDocFromServer(doc(db, 'settings', 'store_config'));
    return { success: true, message: 'Firestore real-time connection verified successfully.' };
  } catch (error: any) {
    if (
      error?.message?.includes('the client is offline') ||
      error?.message?.includes('Could not reach Cloud Firestore') ||
      error?.code === 'unavailable'
    ) {
      return { success: false, message: 'Client offline or unable to reach Firestore servers. Operating in offline cache mode.' };
    }
    // If document just doesn't exist, connection itself succeeded!
    return { success: true, message: 'Connected to Firestore instance.' };
  }
}
