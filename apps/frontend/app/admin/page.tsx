"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminDashboard } from "../../components/admin-dashboard";
import { getAuthUser } from "../../lib/auth";

const ALLOWED_ADMIN_EMAIL = "mk20040307@gmail.com";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const authUser = getAuthUser();
    const isAdmin = authUser?.email?.toLowerCase() === ALLOWED_ADMIN_EMAIL;
    if (!isAdmin) {
      router.replace("/");
    }
  }, [router]);

  return <AdminDashboard />;
}
