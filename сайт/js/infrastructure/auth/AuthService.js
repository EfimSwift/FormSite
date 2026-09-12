import { DEMO_PASS, DEMO_USER } from "../../config.js";

const SESSION_KEY = "formsite_session";

export class AuthService {
  constructor(expectedUser, expectedPass) {
    this.expectedUser = expectedUser;
    this.expectedPass = expectedPass;
  }

  login(user, pass) {
    if (user === this.expectedUser && pass === this.expectedPass) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ user, at: Date.now() }),
      );
      return true;
    }
    return false;
  }

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  isAuthenticated() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService(DEMO_USER, DEMO_PASS);
