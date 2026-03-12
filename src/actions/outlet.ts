"use server";

import { db } from "@/db";
import { outlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";

export async function getOutlets() {
  return db.query.outlets.findMany({
    orderBy: (o, { asc }) => [asc(o.namaOutlet)],
  });
}

export async function createOutlet(data: { namaOutlet: string }) {
  const id = await generateId("outlets");
  await db.insert(outlets).values({ id, namaOutlet: data.namaOutlet });
  revalidatePath("/stores");
  return { id };
}

export async function updateOutlet(id: string, data: { namaOutlet: string }) {
  await db.update(outlets).set(data).where(eq(outlets.id, id));
  revalidatePath("/stores");
}

export async function deleteOutlet(id: string) {
  await db.delete(outlets).where(eq(outlets.id, id));
  revalidatePath("/stores");
}
