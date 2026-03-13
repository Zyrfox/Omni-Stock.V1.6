"use server";

import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";

export async function changePassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Password minimal 8 karakter.");

  const hashed = await hashPassword(newPassword);

  await db.update(users)
    .set({ passwordHash: hashed, mustChangePassword: false })
    .where(eq(users.id, userId));

  await db.update(accounts)
    .set({ password: hashed })
    .where(eq(accounts.userId, userId));

  revalidatePath("/dashboard");
}
