import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  getDocs, 
  getDoc, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MonthlyReportData } from '../types';

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured databaseId (CRITICAL for multi-database or project setup)
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on app startup per Firebase Integration Skill
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore offline or configuration pending.");
    }
    return false;
  }
}

const MONTHLY_COLLECTION = 'monthly_reports';

/**
 * Save or update a monthly report in Firestore backend
 */
export async function saveMonthlyReportToFirestore(report: MonthlyReportData): Promise<void> {
  const docId = report.id || `${report.year}_${report.bulan}`;
  const docRef = doc(db, MONTHLY_COLLECTION, docId);
  
  // Format clean payload conforming to schema
  const payload: MonthlyReportData = {
    id: docId,
    bulan: report.bulan,
    monthIndex: report.monthIndex,
    year: report.year,
    fileName: report.fileName || `Fuel_Report_${report.bulan}_${report.year}.xlsx`,
    uploadedAt: report.uploadedAt || new Date().toISOString(),
    totalVolume: Number(report.totalVolume) || 0,
    totalHours: Number(report.totalHours) || 0,
    recordCount: Number(report.recordCount) || 0,
    avgBurnRate: Number(report.avgBurnRate) || (report.totalHours > 0 ? Number((report.totalVolume / report.totalHours).toFixed(2)) : 0),
    typeSummaries: report.typeSummaries || [],
    plans: report.plans || {},
    records: report.records || []
  };

  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${MONTHLY_COLLECTION}/${docId}`);
  }
}

/**
 * Fetch all monthly reports from Firestore backend
 */
export async function fetchAllMonthlyReports(): Promise<MonthlyReportData[]> {
  try {
    const colRef = collection(db, MONTHLY_COLLECTION);
    const snap = await getDocs(colRef);
    const results: MonthlyReportData[] = [];
    snap.forEach((d) => {
      results.push(d.data() as MonthlyReportData);
    });
    // Sort by monthIndex ascending
    return results.sort((a, b) => a.monthIndex - b.monthIndex);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MONTHLY_COLLECTION);
  }
}

/**
 * Delete a specific monthly report from Firestore
 */
export async function deleteMonthlyReport(docId: string): Promise<void> {
  try {
    const docRef = doc(db, MONTHLY_COLLECTION, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MONTHLY_COLLECTION}/${docId}`);
  }
}

/**
 * Real-time listener for monthly reports collection
 */
export function subscribeToMonthlyReports(
  onData: (reports: MonthlyReportData[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const colRef = collection(db, MONTHLY_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: MonthlyReportData[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as MonthlyReportData);
      });
      list.sort((a, b) => a.monthIndex - b.monthIndex);
      onData(list);
    },
    (error) => {
      console.error("Firestore onSnapshot error:", error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, MONTHLY_COLLECTION);
    }
  );
}
