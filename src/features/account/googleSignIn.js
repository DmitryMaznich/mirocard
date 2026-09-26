import { api } from "@/core/api";
import { useAppStore } from "@/core/store";
import { completeLogin } from "./completeLogin";

// Called at boot with ?google_code= from the Google callback redirect.
export async function handleGoogleCode(code) {
  const r = await api.post("/auth/google/exchange", { code });
  if (r.needsProfile) {
    useAppStore.setState({
      googleSignup: { signupCode: r.signupCode, email: r.email, firstName: r.firstName, lastName: r.lastName },
    });
    useAppStore.getState().setScreen("google_complete_profile");
    return;
  }
  await completeLogin({ account: r.account, token: r.token });
}
