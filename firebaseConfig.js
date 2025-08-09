import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  // --- PASTE YOUR NEW REGENERATED API KEY HERE ---
  apiKey: "", 
  authDomain: "kumarshoes-b2c90.firebaseapp.com",
  projectId: "kumarshoes-b2c90",
  storageBucket: "kumarshoes-b2c90.appspot.com",
  messagingSenderId: "896146180841",
  appId: "1:896146180841:web:3372a4eb78381187cefe78"
};

// Conditionally initialize Firebase to prevent the "duplicate-app" error
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get references to the services we will use
const db = getFirestore(app);
const auth = getAuth(app);

// Export the services for use in other parts of the app

export { app, db, auth };
