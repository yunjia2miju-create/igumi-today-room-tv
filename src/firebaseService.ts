import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';
import { Post, Inquiry, defaultPosts } from './data';

// --- Posts API ---

/**
 * Reads all property listings (posts) from Firestore with fallback to Express API / Default data
 */
export async function getPostsService(): Promise<Post[]> {
  try {
    // 1. Try Firestore first
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const posts: Post[] = [];
      snapshot.forEach((doc) => {
        posts.push(doc.data() as Post);
      });
      return posts;
    }
  } catch (err) {
    console.warn("Firestore posts retrieval bypassed, trying local API fallback:", err);
  }

  // 2. Fallback to Express backend /api/posts
  try {
    const res = await fetch('/api/posts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Express backend posts endpoint failed", err);
  }

  // 3. Fallback to bundled static default data
  return defaultPosts;
}

/**
 * Saves or updates a post in Firestore and tries to sync with Express backend
 */
export async function savePostService(post: Post): Promise<void> {
  const docPath = `posts/${post.id}`;
  
  // 1. Write to Firestore
  try {
    const docRef = doc(db, 'posts', post.id);
    await setDoc(docRef, post);
    console.log("Post successfully saved to Firestore:", post.id);
  } catch (err) {
    // Mandated structured permission-error interceptor check
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }

  // 2. Best-effort sync to Express backend /api/posts
  try {
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
    });
  } catch (err) {
    console.warn("Express backend post sync bypassed (offline/static mode)", err);
  }
}

/**
 * Deletes a post from Firestore and Express backend
 */
export async function deletePostService(id: string): Promise<void> {
  const docPath = `posts/${id}`;
  
  // 1. Delete from Firestore
  try {
    const docRef = doc(db, 'posts', id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }

  // 2. Best-effort delete on Express backend
  try {
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn("Express backend delete sync bypassed (offline/static mode)", err);
  }
}


// --- Inquiries API ---

/**
 * Retrieves client counseling requests (Inquiries)
 */
export async function getInquiriesService(): Promise<Inquiry[]> {
  try {
    // 1. Try Firestore first
    const inquiriesRef = collection(db, 'inquiries');
    const q = query(inquiriesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const inquiries: Inquiry[] = [];
    snapshot.forEach((doc) => {
      inquiries.push(doc.data() as Inquiry);
    });
    return inquiries;
  } catch (err) {
    console.warn("Firestore inquiries retrieval failed, trying local API:", err);
  }

  // 2. Try Express backend
  try {
    const res = await fetch('/api/inquiries');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Express backend inquiries endpoint failed", err);
  }

  return [];
}

/**
 * Submits an inquiry to Firestore, and pushes to backend
 */
export async function submitInquiryService(inq: Inquiry): Promise<void> {
  const docPath = `inquiries/${inq.id}`;
  
  // 1. Save to Firestore
  try {
    const docRef = doc(db, 'inquiries', inq.id);
    await setDoc(docRef, inq);
    console.log("Inquiry successfully saved to Firestore:", inq.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }

  // 2. Pushes to Express backend as well
  try {
    await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inq)
    });
  } catch (err) {
    console.warn("Express backend inquiry sync bypassed (offline/static mode)", err);
  }
}

/**
 * Update processed status on an inquiry
 */
export async function toggleInquiryProcessedService(id: string, currentProcessed: boolean): Promise<void> {
  const docPath = `inquiries/${id}`;
  
  // 1. Update in Firestore
  try {
    const docRef = doc(db, 'inquiries', id);
    await updateDoc(docRef, { processed: !currentProcessed });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docPath);
  }

  // 2. Update on Express backend
  try {
    await fetch(`/api/inquiries/${id}/toggle`, { method: 'POST' });
  } catch (err) {
    console.warn("Express backend index toggle bypassed", err);
  }
}
