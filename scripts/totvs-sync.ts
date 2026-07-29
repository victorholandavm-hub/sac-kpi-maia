// Script standalone pra rodar o sync do Protheus fora do Vercel: o firewall
// do ERP deixa passar a rede do CD e computadores já liberados, mas derruba
// (timeout) o IP de nuvem do Vercel. Rode isto agendado (Agendador de
// Tarefas do Windows) numa máquina que fique dentro da rede liberada.
//
// Uso: node --env-file=.env.totvs-script scripts/totvs-sync.ts
// (.env.local não serve aqui -- o loader de env do Node não expande "$" como
// o do Next.js, então a senha do Basic Auth precisa estar sem escape de
// barra invertida num arquivo à parte. Ver .env.totvs-script.)
import { getSupabaseAdmin } from "../src/lib/supabaseAdmin.ts";
import { runTotvsSync } from "../src/lib/totvsSync.ts";

async function main() {
  const supabase = getSupabaseAdmin();
  const summary = await runTotvsSync(supabase);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
