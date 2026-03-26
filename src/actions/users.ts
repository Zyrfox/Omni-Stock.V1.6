"use server";

import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, generatePassword } from "@/lib/id-generator";
import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";

export async function getUsers() {
  return db.query.users.findMany({
    with: { outlet: true },
    orderBy: (u, { asc }) => [asc(u.createdAt)],
  });
}

export async function createUser(data: {
  nama: string;
  email: string;
  role: "admin" | "manager" | "supervisor" | "staff";
  outletId?: string;
  password: string;
}): Promise<{ id: string; password: string }> {
  // Check for duplicate email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });
  if (existing) throw new Error("Email sudah terdaftar.");

  const id = await generateId("users");
  const passwordHash = await hashPassword(data.password);


  // Insert directly into users table with our custom USR-xxx ID
  await db.insert(users).values({
    id,
    email: data.email,
    name: data.nama,          // Better Auth standard field
    nama: data.nama,          // App display name
    role: data.role,
    passwordHash,             // Reference copy
    mustChangePassword: true,
    outletId: data.outletId ?? null,
    emailVerified: false,
  });

  // Create Better Auth account record so credential login works
  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: data.email,
    providerId: "credential",
    userId: id,
    password: passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath("/users");
  return { id, password: data.password };
}

export async function deleteUser(id: string) {
  // accounts and sessions cascade-delete automatically via FK
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function updateUser(
  id: string,
  data: Partial<{ nama: string; name: string; role: "admin" | "manager" | "supervisor" | "staff"; outletId: string | null }>
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
    supervisor: all.filter((u) => u.role === "supervisor").length,
    staff: all.filter((u) => u.role === "staff").length,
  };
}
