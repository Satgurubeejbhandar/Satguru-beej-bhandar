import { initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// reCAPTCHA setup
export function setupRecaptcha(containerId: string = 'recaptcha-container') {
  if (!(window as any).recaptchaVerifier) {
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {},
    });
  }
  return (window as any).recaptchaVerifier as RecaptchaVerifier;
}

export async function sendOTP(phone10: string): Promise<ConfirmationResult> {
  const digits = phone10.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) throw new Error('10 digit mobile number daalein');

  const verifier = setupRecaptcha();
  const confirmation = await signInWithPhoneNumber(auth, `+91${digits}`, verifier);
  return confirmation;
}

export async function verifyOTP(confirmation: ConfirmationResult, otp: string) {
  const result = await confirmation.confirm(otp.trim());
  return result.user; 
}