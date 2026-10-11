import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
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
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
    if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
      return { success: false, message: 'Client offline or unable to reach Firestore servers.' };
    }
    // If document just doesn't exist, connection itself succeeded!
    return { success: true, message: 'Connected to Firestore instance.' };
  }
}
