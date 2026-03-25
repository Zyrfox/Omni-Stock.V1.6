export const dynamic = "force-dynamic";

import { db } from "@/db";
import { uploadBatches } from "@/db/schema";
import { desc } from "drizzle-orm";
import { UploadHistoryClient } from "./upload-history-client";

export default async function UploadHistoryPage() {
  const batches = await db.query.uploadBatches.findMany({
    orderBy: [desc(uploadBatches.createdAt)],
    limit: 50,
    with: {
      outlet: true,
      uploadedByUser: true,
    },
  });

  return <UploadHistoryClient batches={batches as any} />;
}
