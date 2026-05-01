"use client";

import { useEffect } from "react";
import { getAuthToken } from "../lib/auth";

export function AuthCookieSync() {
  useEffect(() => {
    const sync = () => {
      getAuthToken();
    };

    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
