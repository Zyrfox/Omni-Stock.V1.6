"use server";

import { db } from "@/db";
import { systemConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-utils";

export async function getSystemConfig(key: string): Promise<string | null> {
  const row = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, key),
  });
  return row?.value ?? null;
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  const existing = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, key),
  });
  if (existing) {
    await db.update(systemConfigs).set({ value }).where(eq(systemConfigs.key, key));
  } else {
    await db.insert(systemConfigs).values({ key, value });
  }
}

export async function getWATemplate(outletId: string): Promise<string> {
  const row = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, `wa_template:${outletId}`),
  });
  return row?.value ?? DEFAULT_WA_TEMPLATE;
}
