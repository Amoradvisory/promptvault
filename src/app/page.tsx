"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { localGetUser } from "@/lib/local-storage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = localGetUser();
    if (user) {
      router.replace("/dashboard");
    } else {
      router.replace("/auth/login");
    }
  }, [router]);

  return null;
}
