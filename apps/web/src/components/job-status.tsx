"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the server-rendered job page until the job finishes. */
export function JobPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
