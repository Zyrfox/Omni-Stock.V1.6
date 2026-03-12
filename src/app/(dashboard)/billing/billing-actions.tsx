"use client";

import { useState } from "react";
import { receivePO } from "@/actions/purchase-order";
import { useRouter } from "next/navigation";

export function BillingActions({ poId }: { poId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLunas() {
    setLoading(true);
    await receivePO(poId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleLunas}
      disabled={loading}
      className="btn-accent"
      style={{ fontSize: 10, padding: "3px 8px", border: "none", cursor: loading ? "wait" : "pointer", borderRadius: 4 }}
    >
      {loading ? "..." : "✓ Tandai Lunas"}
    </button>
  );
}
