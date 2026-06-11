import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuOV_UYwoKhHMiPwP1LvBu2z3crVTHEcs",
  authDomain: "bolao-hexa.firebaseapp.com",
  projectId: "bolao-hexa",
  storageBucket: "bolao-hexa.firebasestorage.app",
  messagingSenderId: "98891295779",
  appId: "1:98891295779:web:5bd68b438d4b95cd089596",
  measurementId: "G-2GXRWXWRJ4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function ensureAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then(cred => resolve(cred.user)).catch(reject);
      }
    });
  });
}
