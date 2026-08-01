import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "system-backups";
const KEEP_DAYS = 14;
const PAGE_SIZE = 1000;

// Todas as tabelas do módulo de assistência — transacionais (chamados, peças,
// fornecedor, estoque) e de cadastro (lojas, contas, montadores,
// fornecedores). O plano Free do Supabase não tem backup automático, então
// isso é o que garante um ponto de restauração caso algo seja apagado ou
// corrompido sem querer dentro do próprio app.
const TABLES = [
  "service_requests",
  "service_request_items",
  "service_request_events",
  "service_request_photos",
  "part_orders",
  "supplier_returns",
  "stock_movements",
  "stores",
  "profiles",
  "assemblers",
  "suppliers",
];

async function dumpTable(table: string): Promise<unknown[]> {
  const admin = getSupabaseAdmin();
  let all: unknown[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // Comparação direta com `Bearer ${process.env.CRON_SECRET}` deixava a
  // rota aberta pra quem mandasse literalmente "Bearer undefined" caso a
  // variável de ambiente sumisse num deploy -- falha aberta, não fechada.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    dump[table] = await dumpTable(table);
  }

  const today = new Date().toISOString().slice(0, 10);
  const path = `${today}.json`;
  const body = JSON.stringify({ createdAt: new Date().toISOString(), tables: dump });

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: files } = await admin.storage.from(BUCKET).list("");
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toRemove = (files ?? []).map((f) => f.name).filter((name) => name.endsWith(".json") && name.slice(0, 10) < cutoff);
  if (toRemove.length > 0) {
    await admin.storage.from(BUCKET).remove(toRemove);
  }

  return NextResponse.json({
    ok: true,
    path,
    rowCounts: Object.fromEntries(Object.entries(dump).map(([t, rows]) => [t, rows.length])),
    removedOldBackups: toRemove,
  });
}
