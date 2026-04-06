import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB32-9iWotJFwBaBZsv7rnbo_bO9CPwzwE",
  authDomain: "csrl-store.firebaseapp.com",
  projectId: "csrl-store",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function test() {
  try {
    const res = await signInWithEmailAndPassword(auth, "gail@csrl.internal", "GailCentre2026!");
    console.log("GAIL SUCCESS", res.user.uid);
  } catch (e) {
    console.log("GAIL ERROR", e.code, e.message);
  }

  try {
    const res = await signInWithEmailAndPassword(auth, "admin@csrl.internal", "password123");
    console.log("ADMIN SUCCESS", res.user.uid);
  } catch (e) {
    console.log("ADMIN ERROR", e.code, e.message);
  }

  try {
    // Student test (e.g. roll number 24001 or whatever the DB has)
    // We migrated 100 students from GAIL. Let's list a few using admin SDK if needed.
  } catch (e) {
  }
}

test();
