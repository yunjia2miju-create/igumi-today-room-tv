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
import { db, OperationType, handleFirestoreError, auth } from './firebase';
import { Post, Inquiry, defaultPosts } from './data';

// --- Posts API ---

/**
 * Reads all property listings (posts) from Firestore and merges with Express API / Default data
 */
export async function getPostsService(): Promise<Post[]> {
  let firestorePosts: Post[] = [];
  try {
    // 1. Try Firestore first
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        firestorePosts.push(doc.data() as Post);
      });
    }
  } catch (err) {
    console.warn("Firestore posts retrieval bypassed, trying local API fallback:", err);
  }

  let expressPosts: Post[] = [];
  // 2. Fetch from Express backend /api/posts
  try {
    const res = await fetch('/api/posts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        expressPosts = data;
      }
    }
  } catch (err) {
    console.warn("Express backend posts endpoint failed", err);
  }

  // 3. Fallback to bundled static default data if both are empty
  if (firestorePosts.length === 0 && expressPosts.length === 0) {
    return defaultPosts;
  }

  // Merge lists by unique post ID so that both local and cloud updates are shown
  const mergedMap = new Map<string, Post>();
  
  // First load express posts
  expressPosts.forEach(p => {
    if (p && p.id) {
      mergedMap.set(p.id, p);
    }
  });

  // Then merge firestore posts, prioritizing newer updates / cloud truths
  firestorePosts.forEach(p => {
    if (p && p.id) {
      const existing = mergedMap.get(p.id);
      if (!existing || p.createdAt > (existing.createdAt || 0)) {
        mergedMap.set(p.id, p);
      }
    }
  });

  const mergedList = Array.from(mergedMap.values());
  // Sort by createdAt descending (newest first)
  mergedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return mergedList;
}

/**
 * Saves or updates a post in Firestore and tries to sync with Express backend
 */
export async function savePostService(post: Post): Promise<void> {
  const docPath = `posts/${post.id}`;
  let firestoreError: any = null;
  
  // 1. Write to Firestore
  try {
    const docRef = doc(db, 'posts', post.id);
    await setDoc(docRef, post);
    console.log("Post successfully saved to Firestore:", post.id);
  } catch (err) {
    console.warn("Post saving to Firestore bypassed (will save to local server file):", err);
    firestoreError = err;
  }

  // 2. Clear sync to Express backend /api/posts
  let expressSuccess = false;
  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
    });
    if (res.ok) {
      expressSuccess = true;
    }
  } catch (err) {
    console.warn("Express backend post sync bypassed (offline/static mode)", err);
  }

  // 3. If Firestore fail and Express also fail, throw the Firestore Error
  if (firestoreError && !expressSuccess) {
    handleFirestoreError(firestoreError, OperationType.WRITE, docPath);
  }
}

/**
 * Deletes a post from Firestore and Express backend
 */
export async function deletePostService(id: string): Promise<void> {
  const docPath = `posts/${id}`;
  let firestoreError: any = null;
  
  // 1. Delete from Firestore
  try {
    const docRef = doc(db, 'posts', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Post delete from Firestore bypassed:", err);
    firestoreError = err;
  }

  // 2. Delete on Express backend
  let expressSuccess = false;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      expressSuccess = true;
    }
  } catch (err) {
    console.warn("Express backend delete sync bypassed (offline/static mode)", err);
  }

  // 3. If Firestore fail and Express also fail, throw the Firestore Error
  if (firestoreError && !expressSuccess) {
    handleFirestoreError(firestoreError, OperationType.DELETE, docPath);
  }
}


// --- Inquiries API ---

/**
 * Retrieves client counseling requests (Inquiries)
 */
export async function getInquiriesService(): Promise<Inquiry[]> {
  let firestoreInqs: Inquiry[] = [];
  
  // 1. Try Firestore first only if compiled as the authorized admin to prevent permission warnings
  const isAdmin = auth.currentUser && auth.currentUser.email === 'yunjia2miju@gmail.com';
  if (isAdmin) {
    try {
      const inquiriesRef = collection(db, 'inquiries');
      const q = query(inquiriesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      snapshot.forEach((doc) => {
        firestoreInqs.push(doc.data() as Inquiry);
      });
    } catch (err) {
      console.warn("Firestore inquiries retrieval failed, trying local API:", err);
    }
  }

  let expressInqs: Inquiry[] = [];
  // 2. Try Express backend
  try {
    const res = await fetch('/api/inquiries');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        expressInqs = data;
      }
    }
  } catch (err) {
    console.warn("Express backend inquiries endpoint failed", err);
  }

  if (firestoreInqs.length === 0 && expressInqs.length === 0) {
    return [];
  }

  const mergedMap = new Map<string, Inquiry>();
  expressInqs.forEach(inq => {
    if (inq && inq.id) {
      mergedMap.set(inq.id, inq);
    }
  });

  firestoreInqs.forEach(inq => {
    if (inq && inq.id) {
      const existing = mergedMap.get(inq.id);
      if (!existing || inq.createdAt > (existing.createdAt || 0)) {
        mergedMap.set(inq.id, inq);
      }
    }
  });

  const mergedList = Array.from(mergedMap.values());
  mergedList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return mergedList;
}

/**
 * Submits an inquiry to Firestore, and pushes to backend
 */
export async function submitInquiryService(inq: Inquiry): Promise<void> {
  const docPath = `inquiries/${inq.id}`;
  let firestoreError: any = null;
  
  // 1. Save to Firestore
  try {
    const docRef = doc(db, 'inquiries', inq.id);
    await setDoc(docRef, inq);
    console.log("Inquiry successfully saved to Firestore:", inq.id);
  } catch (err) {
    console.warn("Inquiry save to Firestore bypassed:", err);
    firestoreError = err;
  }

  // 2. Pushes to Express backend as well
  let expressSuccess = false;
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inq)
    });
    if (res.ok) {
      expressSuccess = true;
    }
  } catch (err) {
    console.warn("Express backend inquiry sync bypassed (offline/static mode)", err);
  }

  if (firestoreError && !expressSuccess) {
    handleFirestoreError(firestoreError, OperationType.WRITE, docPath);
  }
}

/**
 * Update processed status on an inquiry
 */
export async function toggleInquiryProcessedService(id: string, currentProcessed: boolean): Promise<void> {
  const docPath = `inquiries/${id}`;
  let firestoreError: any = null;
  
  // 1. Update in Firestore
  try {
    const docRef = doc(db, 'inquiries', id);
    await updateDoc(docRef, { processed: !currentProcessed });
  } catch (err) {
    console.warn("Inquiry toggle in Firestore bypassed:", err);
    firestoreError = err;
  }

  // 2. Update on Express backend
  let expressSuccess = false;
  try {
    const res = await fetch(`/api/inquiries/${id}/toggle`, { method: 'POST' });
    if (res.ok) {
      expressSuccess = true;
    }
  } catch (err) {
    console.warn("Express backend index toggle bypassed", err);
  }

  if (firestoreError && !expressSuccess) {
    handleFirestoreError(firestoreError, OperationType.UPDATE, docPath);
  }
}
