"use client";

import { useState } from "react";
import { receivePO } from "@/actions/purchase-order";
import { useRouter } from "next/navigation";

export function DeliveryActions({ poId }: { poId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    await receivePO(poId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={loading}
      style={{
        fontSize: 10, padding: "3px 8px", borderRadius: 4,
        border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)",
        color: "#60A5FA", cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {loading ? "..." : "✓ Konfirmasi Terima"}
    </button>
  );
}
