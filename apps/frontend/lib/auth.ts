export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  profileId: string;
};

const TOKEN_KEY = "omnichannel_auth_token";
const USER_KEY = "omnichannel_auth_user";
const AUTH_TOKEN_COOKIE = "omnichannel_auth_token";
const AUTH_EMAIL_COOKIE = "omnichannel_auth_email";

function setSessionCookies(token: string, email: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const tokenCookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`;
  const emailCookie = `${AUTH_EMAIL_COOKIE}=${encodeURIComponent(email.toLowerCase())}; Path=/; SameSite=Lax${secure}`;
  document.cookie = tokenCookie;
  document.cookie = emailCookie;
}

function clearSessionCookies() {
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `${AUTH_TOKEN_COOKIE}=; Path=/; Expires=${expires}; SameSite=Lax`;
  document.cookie = `${AUTH_EMAIL_COOKIE}=; Path=/; Expires=${expires}; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const rawUser = localStorage.getItem(USER_KEY);
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser) as AuthUser;
      setSessionCookies(token, user.email);
    } catch {
      // Ignore invalid user payload; token still returned.
    }
  }
  return token;
}

export function setAuthSession(input: { token: string; user: AuthUser }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, input.token);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
  setSessionCookies(input.token, input.user.email);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionCookies();
}
