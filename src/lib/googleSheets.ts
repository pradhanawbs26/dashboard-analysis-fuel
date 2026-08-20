import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize Authentication Listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in via Google popup window
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Access Token from Firebase Auth.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log out Google session
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Get current cached access token helper
export const getAccessToken = () => {
  return cachedAccessToken;
};

// Extract Spreadsheet ID from standard Google Sheets web url
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Regex to match typical Google Sheets URL format
  // https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // Return input directly if it looks like a raw ID
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  
  return null;
}

// Fetch Google Spreadsheet Metadata (for names of sheets)
export async function fetchSpreadsheetMetadata(spreadsheetId: string, accessToken: string): Promise<{ title: string; sheets: string[] }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Sheets API Error (${response.status}): ${errText || response.statusText}`);
  }

  const data = await response.json();
  const title = data.properties?.title || "Spreadsheet";
  const sheets = (data.sheets || []).map((s: any) => s.properties?.title as string).filter(Boolean);

  return { title, sheets };
}

// Fetch 2D Matrix representing sheet row data values
export async function fetchSheetValues(spreadsheetId: string, sheetName: string, accessToken: string): Promise<any[][]> {
  const encodedSheetName = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}?valueRenderOption=UNFORMATTED_VALUE`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengambil data dari sheet "${sheetName}": ${errText}`);
  }

  const data = await response.json();
  return data.values || [];
}
