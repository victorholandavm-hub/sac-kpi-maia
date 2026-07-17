"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeDashboardToken, DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

export type FormState = { error?: string } | undefined;

export async function signInDashboard(_state: FormState, formData: FormData): Promise<FormState> {
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASSWORD) {
    return { error: "Configuração ausente no servidor." };
  }
  if (user !== process.env.DASHBOARD_USER || password !== process.env.DASHBOARD_PASSWORD) {
    return { error: "Usuário ou senha inválidos." };
  }

  const token = await computeDashboardToken();
  if (!token) {
    return { error: "Configuração ausente no servidor." };
  }

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}

export async function signOutDashboard() {
  const cookieStore = await cookies();
  cookieStore.delete(DASHBOARD_COOKIE_NAME);
  redirect("/login");
}
