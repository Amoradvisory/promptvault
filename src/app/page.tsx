"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hybridGetUser } from "@/lib/sync-engine";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    void hybridGetUser().then((user) => {
      router.replace(user ? "/dashboard" : "/auth/login");
    });
  }, [router]);

  return null;
}
