import { api } from "@/core/api";

// The «signup paused» / «email budget spent» wording: "auth.signupPaused",
// "auth.signupPausedGoogle", "auth.emailBudgetExhausted" in authMessages.js.

// A failed status request must never block signup: assume open.
export async function fetchSignupStatus() {
  try {
    return await api.get("/auth/signup-status");
  } catch {
    return { emailSignupOpen: true, google: null };
  }
}
