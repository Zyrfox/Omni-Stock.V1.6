"use server";

import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { generateId, generatePassword } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function getUsers() {
  return db.query.users.findMany({
    with: { outlet: true },
    orderBy: (u, { asc }) => [asc(u.createdAt)],
  });
}

export async function createUser(data: {
  nama: string;
  email: string;
  role: "admin" | "manager";
  outletId?: string;
}): Promise<{ id: string; password: string }> {
  // Check for duplicate email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });
  if (existing) throw new Error("Email sudah terdaftar.");

  const password = generatePassword();
  const id = await generateId("users");

  // Create via Better Auth
  await auth.api.signUpEmail({
    body: {
      email: data.email,
      password,
      name: data.nama,
    },
  });

  // Update additional fields
  await db
    .update(users)
    .set({
      id, // override with our custom ID
      nama: data.nama,
      role: data.role,
      outletId: data.outletId ?? null,
      mustChangePassword: true,
    })
    .where(eq(users.email, data.email));

  revalidatePath("/users");
  return { id, password };
}

export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function updateUser(
  id: string,
  data: Partial<{ nama: string; role: "admin" | "manager"; outletId: string | null }>
) {
  await db.update(users).set(data).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function getUserStats() {
  const all = await db.query.users.findMany();
  return {
    total: all.length,
    admin: all.filter((u) => u.role === "admin").length,
    manager: all.filter((u) => u.role === "manager").length,
  };
}
