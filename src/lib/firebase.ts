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
  writeBatch,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MonthlyReportData, ActiveDatasetData, FuelRecord } from '../types';

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured databaseId (CRITICAL for multi-database or project setup)
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
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

const ACTIVE_DATASET_COLLECTION = 'active_dataset';
const ACTIVE_DOC_ID = 'current';
const BATCH_SIZE = 400; // Store 400 records per document chunk (safe well under 1MB Firestore limit)

export interface SaveActiveDatasetParams {
  records: FuelRecord[];
  plans: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>;
  startDate: string;
  endDate: string;
  fileName: string;
  userEmail?: string;
}

/**
 * Save active fuel records and metadata directly into Cloud Firestore
 */
export async function saveActiveDatasetToFirestore({
  records,
  plans,
  startDate,
  endDate,
  fileName,
  userEmail
}: SaveActiveDatasetParams): Promise<void> {
  const metaDocRef = doc(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID);
  
  // Calculate summary metrics
  const totalVolume = records.reduce((acc, r) => acc + (r.volumeFuel || 0), 0);
  const totalHours = records.reduce((acc, r) => acc + (r.selisihHm > 0 ? r.selisihHm : 0), 0);
  const batchesCount = Math.ceil(records.length / BATCH_SIZE) || 1;

  const datasetMeta: ActiveDatasetData = {
    id: ACTIVE_DOC_ID,
    fileName: fileName || "Fuel_Log_Data.xlsx",
    startDate,
    endDate,
    recordCount: records.length,
    totalVolume,
    totalHours,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userEmail || auth.currentUser?.email || "Anonymous User",
    plans: plans || {},
    batchesCount
  };

  try {
    // 1. Write the metadata document
    await setDoc(metaDocRef, datasetMeta);

    // 2. Write record batches
    for (let i = 0; i < batchesCount; i++) {
      const chunk = records.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const batchDocRef = doc(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID, "batches", `batch_${i}`);
      await setDoc(batchDocRef, {
        batchIndex: i,
        count: chunk.length,
        records: chunk
      });
    }

    // 3. Clean up any leftover higher-index batches from previously larger uploads
    try {
      const batchesCol = collection(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID, "batches");
      const existingBatchesSnap = await getDocs(batchesCol);
      for (const d of existingBatchesSnap.docs) {
        const batchIdx = parseInt(d.id.replace("batch_", ""), 10);
        if (batchIdx >= batchesCount) {
          await deleteDoc(d.ref);
        }
      }
    } catch (cleanErr) {
      console.warn("Batch cleanup notice:", cleanErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ACTIVE_DATASET_COLLECTION}/${ACTIVE_DOC_ID}`);
  }
}

/**
 * Fetch the active dataset and all its record batches directly from Cloud Firestore
 */
export async function fetchActiveDatasetFromFirestore(): Promise<{
  records: FuelRecord[];
  plans: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>;
  startDate: string;
  endDate: string;
  fileName: string;
  uploadedAt: string;
} | null> {
  try {
    const metaDocRef = doc(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID);
    const metaSnap = await getDoc(metaDocRef);

    if (!metaSnap.exists()) {
      return null;
    }

    const meta = metaSnap.data() as ActiveDatasetData;
    const batchesCol = collection(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID, "batches");
    const batchesSnap = await getDocs(batchesCol);

    const sortedBatches = batchesSnap.docs
      .map(d => d.data() as { batchIndex: number; records: FuelRecord[] })
      .sort((a, b) => a.batchIndex - b.batchIndex);

    let allRecords: FuelRecord[] = [];
    for (const b of sortedBatches) {
      if (Array.isArray(b.records)) {
        allRecords = allRecords.concat(b.records);
      }
    }

    return {
      records: allRecords,
      plans: meta.plans || {},
      startDate: meta.startDate || "",
      endDate: meta.endDate || "",
      fileName: meta.fileName || "",
      uploadedAt: meta.uploadedAt || ""
    };
  } catch (error) {
    console.error("fetchActiveDatasetFromFirestore error:", error);
    return null;
  }
}

/**
 * Delete / Clear active dataset from Firestore
 */
export async function deleteActiveDatasetFromFirestore(): Promise<void> {
  try {
    const metaDocRef = doc(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID);
    const batchesCol = collection(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID, "batches");
    const batchesSnap = await getDocs(batchesCol);
    for (const b of batchesSnap.docs) {
      await deleteDoc(b.ref);
    }
    await deleteDoc(metaDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ACTIVE_DATASET_COLLECTION}/${ACTIVE_DOC_ID}`);
  }
}

/**
 * Real-time listener for the active dashboard dataset in Firestore
 */
export function subscribeToActiveDataset(
  onData: (data: {
    records: FuelRecord[];
    plans: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>;
    startDate: string;
    endDate: string;
    fileName: string;
    uploadedAt: string;
    uploadedBy?: string;
  } | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const metaDocRef = doc(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID);
  return onSnapshot(
    metaDocRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      try {
        const meta = snapshot.data() as ActiveDatasetData;
        const batchesCol = collection(db, ACTIVE_DATASET_COLLECTION, ACTIVE_DOC_ID, "batches");
        const batchesSnap = await getDocs(batchesCol);
        const sortedBatches = batchesSnap.docs
          .map(d => d.data() as { batchIndex: number; records: FuelRecord[] })
          .sort((a, b) => a.batchIndex - b.batchIndex);

        let allRecords: FuelRecord[] = [];
        for (const b of sortedBatches) {
          if (Array.isArray(b.records)) {
            allRecords = allRecords.concat(b.records);
          }
        }

        onData({
          records: allRecords,
          plans: meta.plans || {},
          startDate: meta.startDate || "",
          endDate: meta.endDate || "",
          fileName: meta.fileName || "",
          uploadedAt: meta.uploadedAt || "",
          uploadedBy: meta.uploadedBy
        });
      } catch (err) {
        console.error("Error loading active dataset batches:", err);
      }
    },
    (error) => {
      console.error("subscribeToActiveDataset error:", error);
      if (onError) onError(error);
    }
  );
}
