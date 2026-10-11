import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

export { auth };

// Sensitive Workspace scopes needed ONLY when syncing to Google Sheets
export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Standard Google Authentication provider for portal sign-in (Staff & Admin).
 * Requests ONLY basic profile & email (unrestricted scopes).
 * This ensures that staff members with any Gmail address will NEVER be blocked by
 * "App has not completed Google verification process (Error 403: access_denied)".
 */
export const createAuthGoogleProvider = () => {
  const p = new GoogleAuthProvider();
  p.addScope('email');
  p.addScope('profile');
  p.setCustomParameters({
    prompt: 'select_account',
  });
  return p;
};

/**
 * Google Provider with Google Sheets & Drive scopes.
 * Used ONLY when an administrator explicitly triggers a Google Sheets synchronization.
 */
export const createSheetsGoogleProvider = (forceConsent = false) => {
  const p = new GoogleAuthProvider();
  SHEETS_SCOPES.forEach((scope) => p.addScope(scope));
  p.setCustomParameters({
    prompt: forceConsent ? 'consent select_account' : 'select_account',
    access_type: 'offline',
  });
  return p;
};

// In-memory token storage (never localStorage for security)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const clearCachedToken = () => {
  cachedAccessToken = null;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is authenticated in Firebase
        if (onAuthSuccess) onAuthSuccess(user, null);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Standard user sign-in for boutique staff and admin access.
 * Uses standard unrestricted profile/email scopes so it never gets blocked by Google OAuth verification.
 */
export const googleSignIn = async (forceConsent = false): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const providerInstance = createAuthGoogleProvider();
    const result = await signInWithPopup(auth, providerInstance);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }

    return {
      user: result.user,
      accessToken: cachedAccessToken || '',
    };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves valid Google OAuth access token for Google Sheets sync.
 * Prompts user with Google Sheets / Drive scopes only when performing spreadsheet actions.
 */
export const getAccessToken = async (
  promptIfMissing = true,
  forceConsent = false
): Promise<string | null> => {
  if (cachedAccessToken && !forceConsent) return cachedAccessToken;

  if (promptIfMissing || forceConsent) {
    try {
      isSigningIn = true;
      const provider = createSheetsGoogleProvider(forceConsent);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
      return cachedAccessToken;
    } catch (err: any) {
      console.warn('Google Sheets token prompt dismissed or failed:', err);
      const isPopupClosed = err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user');
      const isPopupBlocked = err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked');
      if (isPopupBlocked) {
        throw new Error('Google Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      }
      if (isPopupClosed) {
        throw new Error('Google sign-in popup was closed before completing authorization. Please try again.');
      }
      throw new Error(err?.message || 'Unable to obtain Google authorization token for Google Sheets.');
    } finally {
      isSigningIn = false;
    }
  }

  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign out error:', err);
  } finally {
    cachedAccessToken = null;
  }
};
