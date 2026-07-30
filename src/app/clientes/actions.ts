"use server";

import { searchClients } from "@/lib/customerProfile";

export async function searchClientsAction(query: string) {
  return searchClients(query);
}
