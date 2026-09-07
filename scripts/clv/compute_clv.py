"""
Motor de Recompra -- CLV preditivo (BG/NBD + Gamma-Gamma).

Pedido do Victor 07/09/2026: peça do desenho original (motor-de-recompra.html)
que não dava pra fazer no stack atual (TypeScript/Next.js) -- BG/NBD e
Gamma-Gamma não têm biblioteca madura fora de Python. Fica separado do
resto do projeto (scripts/*.ts) de propósito -- ambiente Python próprio
(venv), sem misturar com o app.

O que isso calcula, por cliente, a partir do histórico de pedidos
(totvs_orders):
  - probabilidade de o cliente ainda estar "vivo" (ativo) -- P(alive)
  - nº esperado de compras nos próximos 90 dias
  - CLV esperado pros próximos 12 meses (BRL)

IMPORTANTE (07/09/2026): rodando HOJE, com o backfill histórico ainda em
andamento (ver totvsSync.ts/nextOrdersCursor), os números daqui NÃO são
confiáveis ainda -- o modelo calibra em cima de quem já recomprou, e com
histórico raso tem poucos clientes assim. Rodar de novo depois que o
backfill terminar (ver totvs_sync_state.totvs_orders_next_day == hoje).

Por enquanto só imprime um resumo + salva um CSV local (out/clv.csv) --
NÃO escreve em nenhuma tabela do Supabase ainda. Escrever de volta pro
banco (pra aparecer em /clientes) é o próximo passo, depois que os
números forem confiáveis.

Uso:
  cd scripts/clv
  venv/Scripts/python.exe compute_clv.py       (Windows)
  venv/bin/python compute_clv.py               (mac/Linux)

Lê as mesmas credenciais do sync de pedidos (../../.env.totvs-script):
NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from lifetimes import BetaGeoFitter, GammaGammaFitter
from lifetimes.utils import summary_data_from_transaction_data
from supabase import create_client

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.totvs-script")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("Faltando NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY em .env.totvs-script")

PAGE_SIZE = 1000

# "LOJAS AIAM..." e "CONSUMIDOR FINAL" -- mesma exclusão de isClienteInterno
# (src/lib/clientes.ts) -- não são clientes de verdade.
COMPANY_CNPJ_ROOT = "39537682"
INTERNAL_NAMES = {"CONSUMIDOR FINAL"}


def is_internal(name, cpf_cnpj) -> bool:
    # pandas devolve NaN (float) pra célula nula, não None/"" -- checa
    # isinstance antes de mexer com string (achado rodando de verdade
    # 07/09/2026: 'float' object has no attribute 'startswith').
    if isinstance(cpf_cnpj, str) and cpf_cnpj.startswith(COMPANY_CNPJ_ROOT):
        return True
    if isinstance(name, str) and name.strip().upper() in INTERNAL_NAMES:
        return True
    return False


def fetch_all_orders(client) -> pd.DataFrame:
    """Varre totvs_orders inteiro (só Venda, com client_id) -- mesmo padrão
    de paginação do fetchAllPagesParallel (supabasePagination.ts), só que
    sequencial (não precisa ser paralelo aqui, roda 1x, não numa página
    carregando pro usuário)."""
    rows: list[dict] = []
    start = 0
    while True:
        res = (
            client.table("totvs_orders")
            .select("client_id, issue_date, invoice_total, client_name, client_cpf_cnpj")
            .eq("type", "Venda")
            .not_.is_("client_id", "null")
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        start += PAGE_SIZE
    return pd.DataFrame(rows)


def main() -> None:
    print("Conectando ao Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Baixando totvs_orders (só Venda, com client_id)...")
    df = fetch_all_orders(client)
    print(f"{len(df)} linhas de pedido baixadas.")

    # Exclui cliente interno (transferência entre filiais) e venda balcão
    # sem identificação -- mesma regra de clientes.ts.
    internal_mask = df.apply(lambda r: is_internal(r.get("client_name"), r.get("client_cpf_cnpj")), axis=1)
    df = df[~internal_mask].copy()
    print(f"{len(df)} linhas depois de excluir cliente interno/consumidor final.")

    df["issue_date"] = pd.to_datetime(df["issue_date"])

    observation_end = datetime.now(timezone.utc).replace(tzinfo=None)

    summary = summary_data_from_transaction_data(
        df,
        customer_id_col="client_id",
        datetime_col="issue_date",
        monetary_value_col="invoice_total",
        observation_period_end=observation_end,
        freq="D",
    )

    n_total = len(summary)
    n_repeat = int((summary["frequency"] > 0).sum())
    print(f"\n{n_total} clientes únicos (com pelo menos 1 compra).")
    print(f"{n_repeat} já recompraram pelo menos 1 vez (frequency > 0) -- é isso que o modelo calibra em cima.")
    print(f"Proporção de recompradores: {n_repeat / n_total:.1%}\n")

    if n_repeat < 50:
        print(
            "AVISO: menos de 50 clientes com recompra -- calibração vai ser "
            "instável de qualquer jeito. Números abaixo são só pra validar "
            "que o pipeline RODA, não pra confiar no resultado ainda."
        )

    bgf = BetaGeoFitter(penalizer_coef=0.001)
    bgf.fit(summary["frequency"], summary["recency"], summary["T"])

    repeat = summary[(summary["frequency"] > 0) & (summary["monetary_value"] > 0)].copy()
    ggf = GammaGammaFitter(penalizer_coef=0.001)
    ggf.fit(repeat["frequency"], repeat["monetary_value"])

    summary["prob_alive"] = bgf.conditional_probability_alive(summary["frequency"], summary["recency"], summary["T"])
    summary["esperado_90d"] = bgf.conditional_expected_number_of_purchases_up_to_time(
        90, summary["frequency"], summary["recency"], summary["T"]
    )

    # CLV só existe pra quem já recomprou (Gamma-Gamma precisa de
    # monetary_value > 0 em repeat purchase) -- resto fica NaN, sem "chutar"
    # valor pra quem só comprou 1 vez.
    summary["clv_12m"] = pd.NA
    summary.loc[repeat.index, "clv_12m"] = ggf.customer_lifetime_value(
        bgf,
        repeat["frequency"],
        repeat["recency"],
        repeat["T"],
        repeat["monetary_value"],
        time=12,  # meses
        freq="D",  # unidade de recency/T (dias, igual summary_data_from_transaction_data)
        discount_rate=0.01,
    )

    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "clv.csv"
    summary.reset_index().rename(columns={"index": "client_id"}).to_csv(out_path, index=False)
    print(f"Salvo em {out_path}")

    print("\nTop 10 por CLV esperado (12 meses):")
    top = summary.dropna(subset=["clv_12m"]).sort_values("clv_12m", ascending=False).head(10)
    for client_id, row in top.iterrows():
        print(
            f"  {client_id}: CLV=R${row['clv_12m']:.2f}  "
            f"P(vivo)={row['prob_alive']:.0%}  "
            f"compras={int(row['frequency']) + 1}  "
            f"esperado/90d={row['esperado_90d']:.2f}"
        )


if __name__ == "__main__":
    main()
