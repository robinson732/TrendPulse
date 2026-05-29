import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDb, isFirebaseConfigured } from "./firebaseConfig";

export interface FirestorePulsePost {
  id: string;
  trendId: string;
  author: string;
  avatar: string;
  platform: string;
  content: string;
  timestamp: string;
  likes: number;
  reposts: number;
}

interface PulseDoc {
  trendId: string;
  author: string;
  platform: string;
  content: string;
  likes: number;
  reposts: number;
  createdAt: Timestamp | null;
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function subscribeToFirestorePosts(
  trendId: string,
  callback: (posts: FirestorePulsePost[]) => void,
  maxPosts = 30
): Unsubscribe | null {
  const db = getDb();
  if (!isFirebaseConfigured() || !db) return null;

  try {
    const postsRef = collection(db, "pulse_posts");
    const q = query(
      postsRef,
      where("trendId", "==", trendId),
      orderBy("createdAt", "desc"),
      limit(maxPosts)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const posts: FirestorePulsePost[] = snapshot.docs.map((d) => {
          const data = d.data() as PulseDoc;
          const createdAt = data.createdAt?.toDate() ?? new Date();
          return {
            id: d.id,
            trendId: data.trendId,
            author: data.author,
            avatar: data.author.charAt(0).toUpperCase(),
            platform: data.platform || "twitter",
            content: data.content,
            timestamp: formatTimeAgo(createdAt),
            likes: data.likes || 0,
            reposts: data.reposts || 0,
          };
        });
        callback(posts);
      },
      (err) => {
        console.warn("[Firestore] onSnapshot error:", err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("[Firestore] subscribeToFirestorePosts failed:", err);
    return null;
  }
}

export async function fetchFirestorePosts(
  trendId: string,
  maxPosts = 20
): Promise<FirestorePulsePost[]> {
  const db = getDb();
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const postsRef = collection(db, "pulse_posts");
    const q = query(
      postsRef,
      where("trendId", "==", trendId),
      orderBy("createdAt", "desc"),
      limit(maxPosts)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data() as PulseDoc;
      const createdAt = data.createdAt?.toDate() ?? new Date();
      return {
        id: doc.id,
        trendId: data.trendId,
        author: data.author,
        avatar: data.author.charAt(0).toUpperCase(),
        platform: data.platform || "twitter",
        content: data.content,
        timestamp: formatTimeAgo(createdAt),
        likes: data.likes || 0,
        reposts: data.reposts || 0,
      };
    });
  } catch (err) {
    console.warn("[Firestore Pulse] Fetch failed, falling back to API:", err);
    return [];
  }
}

export async function uploadPulseMedia(
  localUri: string,
  hashtag: string,
  mediaType: string = "image"
): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const storage = getStorage();
    const ext = mediaType === "video" ? "mp4" : "jpg";
    const storageRef = ref(storage, `pulses/${hashtag}/${Date.now()}.${ext}`);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.warn("[Firestore Pulse] Media upload failed:", err);
    return null;
  }
}

export async function createFirestorePost(
  trendId: string,
  author: string,
  content: string,
  platform = "twitter",
  extras?: { mediaUri?: string | null; mediaType?: string | null; link?: string | null }
): Promise<string | null> {
  const db = getDb();
  if (!isFirebaseConfigured() || !db) return null;

  try {
    const postsRef = collection(db, "pulse_posts");
    const docData: Record<string, any> = {
      trendId,
      author,
      platform,
      content,
      likes: 0,
      reposts: 0,
      createdAt: serverTimestamp(),
    };
    if (extras?.mediaUri) {
      docData.mediaUri = extras.mediaUri;
      docData.mediaType = extras.mediaType || "image";
    }
    if (extras?.link) {
      docData.link = extras.link;
    }
    const docRef = await addDoc(postsRef, docData);
    return docRef.id;
  } catch (err) {
    console.warn("[Firestore Pulse] Create failed:", err);
    return null;
  }
}

export async function reportFirestorePost(
  trendId: string,
  postId: string,
  reportedBy: string
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const db = getDb();
  if (!db) return false;

  try {
    const postRef = doc(db, `pulses/${trendId}/posts`, postId);
    await updateDoc(postRef, {
      reported: true,
      reportedBy,
      reportedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn("[Firestore Pulse] Report failed:", err);
    return false;
  }
}
