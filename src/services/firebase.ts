import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDc0hjs4rYzJqr8l4PrBa4JFb3khZBofg4",
  authDomain: "aircraft-simulator-d3ae9.firebaseapp.com",
  projectId: "aircraft-simulator-d3ae9",
  storageBucket: "aircraft-simulator-d3ae9.firebasestorage.app",
  messagingSenderId: "828626531015",
  appId: "1:828626531015:web:d06d405942ba4ea94244e2"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
