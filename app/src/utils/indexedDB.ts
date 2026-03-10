/**
 * IndexedDB utility for persistent recording storage.
 * Stores recording chunks to allow recovery after unexpected page refresh or crashes.
 */

const DB_NAME = 'DaharMeetRec';
const STORE_NAME = 'recording_chunks';
const DB_VERSION = 1;

export interface RecordingMetadata {
    id: string;
    meetingId: string;
    userName: string;
    startTime: number;
    mimeType: string;
}

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // We use a compound key or separate stores? 
                // Let's use a simple store where each record is:
                // { id: 'meeting-timestamp', meetingId, chunk, index }
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('meetingId', 'meetingId', { unique: false });
            }
        };

        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const saveChunk = async (meetingId: string, userName: string, chunk: Blob, startTime: number, mimeType: string) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const record = {
            meetingId,
            userName,
            chunk,
            startTime,
            mimeType,
            timestamp: Date.now()
        };

        const request = store.add(record);
        request.onsuccess = () => resolve();
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const getChunksByMeeting = async (meetingId: string): Promise<any[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('meetingId');
        const request = index.getAll(IDBKeyRange.only(meetingId));

        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const getAllMeetingsWithData = async (): Promise<string[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event: any) => {
            const records = event.target.result;
            const meetingIds = Array.from(new Set(records.map((r: any) => r.meetingId))) as string[];
            resolve(meetingIds);
        };
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const deleteMeetingData = async (meetingId: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('meetingId');
        const request = index.openCursor(IDBKeyRange.only(meetingId));

        request.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (event: any) => reject(event.target.error);
    });
};
