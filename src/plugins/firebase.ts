import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

// In development the app talks to the Firebase emulators as the demo project
// that `pnpm emulators` starts. A demo project needs no real config.
const useEmulators = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true'

const firebaseConfig = useEmulators
  ? {
    apiKey: 'demo-api-key',
    authDomain: 'demo-is-legal.firebaseapp.com',
    projectId: 'demo-is-legal',
    storageBucket: 'demo-is-legal.appspot.com',
    appId: 'demo-is-legal',
  }
  : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

// Must match REGION in functions/src/config.ts.
export const FUNCTIONS_REGION = 'us-central1'

const firebaseApp = initializeApp(firebaseConfig)
const db = getFirestore(firebaseApp)
const functions = getFunctions(firebaseApp, FUNCTIONS_REGION)
const auth = getAuth(firebaseApp)
const storage = getStorage(firebaseApp)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

export { auth, db, firebaseApp, functions, storage, useEmulators }
