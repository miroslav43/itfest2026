"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated, getRole } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }

    const role = getRole();

    // Enforce role → correct section
    if (role === "blind_user" && !pathname.startsWith("/blind")) {
      router.replace("/blind");
      return;
    }
    if (role === "admin" && pathname === "/") {
      // Admins can also view the caregiver map, just don't force redirect
    }
  }, [pathname, router]);

  return <>{children}</>;
}
