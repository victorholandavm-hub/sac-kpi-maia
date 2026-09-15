"use client";

// Tabela de Clientes (Nível de relacionamento) em shadcn/ui + TanStack
// Table -- pedido do Victor 15/09/2026: "instale e configure as
// dependências... crie para mim o código TypeScript dessa tabela".
//
// TESTE LOCAL, de propósito -- ver useFormDraft.ts pra um exemplo do
// padrão oposto (tokens compartilhados var(--*), sem biblioteca nenhuma)
// que o resto do sistema inteiro usa. Esta tabela usa outra base visual
// (shadcn/ui, cores próprias dela -- ver globals.css, tokens --card/
// --primary/etc.) só nesta tela, por pedido explícito, pra comparar os
// dois estilos lado a lado antes de decidir. Se não for pra frente, é só
// trocar a chamada em clientes/page.tsx de volta pra a tabela hand-rolled
// original (o código dela continua intacto, nada foi apagado).
//
// Paginação/busca continuam vindo prontas do servidor (mesmo padrão do
// resto do app, URL-driven) -- só a APRESENTAÇÃO da página atual (a lista
// de `items`, já cortada em LIST_PAGE_SIZE) passa a usar TanStack Table +
// componentes shadcn/ui. Mandar TODOS os milhares de clientes pro cliente
// de uma vez (pra paginação/ordenação 100% client-side) pesaria demais no
// payload inicial -- por isso `manualPagination` aqui, não getPaginationRowModel.
import { Fragment, useEffect, useRef, useState } from "react";
// @tanstack/react-table v9 troca useReactTable/getCoreRowModel/
// getExpandedRowModel/ColumnDef (API v8 clássica) por um modelo novo de
// registro explícito de "features" (useTable + tableFeatures(...)) --
// achado ao rodar `npx tsc` (erros apontando 'createCoreRowModel'/
// 'ReactTable' em vez dos nomes de sempre) e confirmado nos .d.ts
// instalados (node_modules/@tanstack/react-table/skills/migrate-v8-to-v9).
// O pacote traz um módulo de COMPATIBILIDADE de propósito
// ("@tanstack/react-table/legacy") com a API v8 inteira igual sempre foi
// -- mais seguro pra um teste local rápido do que reescrever em cima da
// API nova sem testar direito. flexRender continua vindo do pacote
// principal (não muda entre v8/v9).
import {
  type LegacyColumnDef as ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import type { ExpandedState } from "@tanstack/table-core";
import { ChevronRight, MoreHorizontal, Copy } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getComprasDoClienteAction } from "@/app/clientes/actions";
import type { ClienteNivelInfo, ClienteCompra } from "@/lib/clientes";
import { CLIENTE_NIVEL_LABELS, CLIENTE_NIVEL_COLORS } from "@/lib/clientes";

const CLV_HORIZONTE_ANOS = 5;

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Sub-tabela de compras (expandida por linha) -- mesmo dado/ação de
// ClienteHistoricoRow.tsx (getComprasDoClienteAction, busca só no 1º
// clique), reescrita aqui em cima dos componentes shadcn/ui em vez do
// <table> cru.
function ComprasExpandidas({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compras, setCompras] = useState<ClienteCompra[] | null>(null);

  useEffect(() => {
    getComprasDoClienteAction(clientId)
      .then((result) => setCompras(result.compras))
      .catch(() => setError("Não foi possível carregar as compras."))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground px-4 py-3">Carregando…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive px-4 py-3">{error}</p>;
  }
  if (!compras || compras.length === 0) {
    return <p className="text-sm text-muted-foreground px-4 py-3">Nenhuma compra encontrada pra esse cliente.</p>;
  }

  const totalVendas = compras.filter((c) => c.type === "Venda").reduce((sum, c) => sum + c.invoiceTotal, 0);
  const totalDevolucoes = compras.filter((c) => c.type === "Devolucao").reduce((sum, c) => sum + c.invoiceTotal, 0);

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span>
          Total gasto (líquido): <strong className="text-foreground">{formatBRL(totalVendas + totalDevolucoes)}</strong>
        </span>
        {totalDevolucoes !== 0 ? <span>Devolvido: {formatBRL(Math.abs(totalDevolucoes))}</span> : null}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nota fiscal</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Vendedor(a)</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap">{formatDateOnly(c.issueDate)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={c.type === "Devolucao" ? "destructive" : "outline"}>
                    {c.type === "Devolucao" ? "Devolução" : "Venda"}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{c.invoice ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{c.branch ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{c.sellerName ?? "—"}</TableCell>
                {/* invoice_total já vem líquido/assinado do Protheus
                    (negativo pra devolução) -- formatBRL já mostra o sinal
                    sozinho. */}
                <TableCell className={`text-right whitespace-nowrap ${c.type === "Devolucao" ? "text-destructive" : ""}`}>
                  {formatBRL(c.invoiceTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ClientesNivelTable({
  items,
  clvByClientId,
}: {
  items: ClienteNivelInfo[];
  // Map não serializa tão previsível quanto objeto plano por essa borda
  // Server -> Client -- veio convertido em clientes/page.tsx.
  clvByClientId: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Aviso visual de que dá pra rolar a tabela pro lado -- pedido do Victor
  // 15/09/2026 depois de achar que as colunas da direita estavam sendo
  // "cortadas" (na verdade só rolam, mas sem indicação nenhuma o scrollbar
  // nativo do Windows some quando não tá em uso e ninguém descobre sozinho).
  // Quem realmente rola é o container interno do <Table> (ui/table.tsx,
  // data-slot="table-container") -- esse wrapper aqui só serve pra achar
  // ele via querySelector, não tem overflow próprio.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]');
    if (!el) return;
    const update = () => setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    update();
    el.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items]);

  const columns: ColumnDef<ClienteNivelInfo>[] = [
    {
      id: "posicao",
      header: () => <div className="text-right">Posição</div>,
      cell: ({ row }) => <div className="text-right text-muted-foreground tabular-nums">{row.original.posicaoNoNivel}º</div>,
    },
    {
      id: "nome",
      accessorFn: (c) => c.nome ?? c.clientId,
      header: "Nome",
      // Coluna de nomes alinhada à esquerda (pedido explícito) -- botão de
      // expandir/recolher junto, mesmo comportamento de
      // ClienteHistoricoRow.tsx (não navega, expande a linha logo abaixo).
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => row.toggleExpanded()}
          className="flex items-center gap-1.5 text-left font-medium hover:underline decoration-dotted"
        >
          <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${row.getIsExpanded() ? "rotate-90" : ""}`} />
          {row.original.nome ?? row.original.clientId}
        </button>
      ),
    },
    {
      id: "nivel",
      header: "Nível",
      cell: ({ row }) => {
        const c = row.original;
        const color = CLIENTE_NIVEL_COLORS[c.nivel];
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>{CLIENTE_NIVEL_LABELS[c.nivel]}</Badge>
            {c.inativoRecente ? (
              <Badge variant="destructive" title="Sem comprar há 180 dias ou mais -- nível é histórico acumulado, não reflete isso sozinho">
                ⚠ inativo
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "compras",
      accessorKey: "compras",
      header: () => <div className="text-right">Compras</div>,
      cell: ({ getValue }) => <div className="text-right tabular-nums">{getValue<number>()}</div>,
    },
    {
      id: "gasto",
      accessorKey: "gastoAcumulado",
      // Coluna de valores financeiros alinhada à direita + moeda pt-BR
      // (pedido explícito).
      header: () => <div className="text-right">Gasto acumulado</div>,
      cell: ({ getValue }) => <div className="text-right font-semibold text-[var(--brand-green)] tabular-nums">{formatBRL(getValue<number>())}</div>,
    },
    {
      id: "clv",
      header: () => <div className="text-right">CLV projetado ({CLV_HORIZONTE_ANOS}a)</div>,
      cell: ({ row }) => {
        const clv = clvByClientId[row.original.clientId];
        return <div className="text-right text-muted-foreground tabular-nums">{clv !== undefined ? formatBRL(clv) : "—"}</div>;
      },
    },
    {
      id: "aniversario",
      accessorKey: "primeiraCompra",
      header: () => <div className="text-right">Aniversário de rel.</div>,
      cell: ({ getValue }) => <div className="text-right text-muted-foreground whitespace-nowrap">{formatDateOnly(getValue<string | null>())}</div>,
    },
    {
      id: "ultimaCompra",
      accessorKey: "ultimaCompra",
      header: "Última compra",
      cell: ({ getValue }) => <span className="text-muted-foreground whitespace-nowrap">{formatDateOnly(getValue<string | null>())}</span>,
    },
    {
      id: "diasSemComprar",
      header: () => <div className="text-right">Dias sem comprar</div>,
      cell: ({ row }) => (
        <div className={`text-right tabular-nums ${row.original.inativoRecente ? "text-destructive" : "text-muted-foreground"}`}>
          {row.original.diasSemComprar ?? "—"}
        </div>
      ),
    },
    {
      id: "loja",
      header: "Loja",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.stores.length > 0 ? row.original.stores.join(", ") : "—"}</span>,
    },
    {
      id: "acoes",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          {/* Sem asChild (isso aqui é @base-ui/react por baixo, não Radix
              -- ver dropdown-menu.tsx) -- estiliza o próprio trigger em
              vez de embutir um <Button> dentro via polimorfismo. */}
          <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => row.toggleExpanded()}>
              <ChevronRight className="size-3.5" /> Ver histórico de compras
            </DropdownMenuItem>
            {row.original.cpfCnpj ? (
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.cpfCnpj!)}>
                <Copy className="size-3.5" /> Copiar CPF/CNPJ
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: items,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowId: (row) => row.clientId,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // Por padrão o v9 só deixa expandir linha que tenha subRows (uso normal
    // seria dados hierárquicos) -- aqui a "expansão" é só um painel de
    // detalhe por linha (histórico de compras), sem hierarquia nenhuma, daí
    // precisa liberar explicitamente ou toggleExpanded() nunca faz nada.
    getRowCanExpand: () => true,
    // Paginação/ordenação continuam a cargo do servidor (ver comentário no
    // topo do arquivo) -- só a apresentação da página atual é da tabela.
    manualPagination: true,
  });

  return (
    // min-w-0 é o ponto chave: este componente é filho direto do wrapper
    // "flex flex-col" da página (clientes/page.tsx) -- sem isso, o item flex
    // nunca encolhe abaixo da largura natural da tabela (nowrap em toda
    // coluna), então o overflow-x-auto do <Table> nunca chega a entrar em
    // ação e as últimas colunas ficam cortadas em vez de roláveis.
    <div
      ref={wrapperRef}
      className="relative min-w-0 rounded-lg overflow-hidden border-2 border-[var(--brand-green)] [&_[data-slot=table-container]]:min-w-0 [&_[data-slot=table-container]]:[scrollbar-color:var(--brand-green)_transparent] [&_[data-slot=table-container]]:[scrollbar-width:thin] [&_[data-slot=table-container]]:[&::-webkit-scrollbar]:h-2.5 [&_[data-slot=table-container]]:[&::-webkit-scrollbar-track]:bg-transparent [&_[data-slot=table-container]]:[&::-webkit-scrollbar-thumb]:rounded-full [&_[data-slot=table-container]]:[&::-webkit-scrollbar-thumb]:bg-[var(--brand-green)]"
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-[color-mix(in_srgb,var(--brand-green)_10%,var(--surface-1))]">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="whitespace-nowrap">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow className="hover:bg-[var(--surface-2)]">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() ? (
                <TableRow key={`${row.id}-expanded`} className="bg-[color-mix(in_srgb,var(--brand-green)_6%,var(--surface-2))] hover:bg-[color-mix(in_srgb,var(--brand-green)_6%,var(--surface-2))]">
                  <TableCell colSpan={columns.length} className="p-0">
                    <ComprasExpandidas clientId={row.original.clientId} />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {canScrollRight ? (
        // Só cobre a altura do cabeçalho (h-10, igual TableHead) -- se
        // cobrisse a tabela inteira (inset-y-0) o ícone ficaria centralizado
        // no meio de uma lista de dezenas de linhas, fora da área visível
        // ao carregar a página.
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-10 w-10 flex items-center justify-end pr-1"
          style={{ background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--brand-green) 10%, var(--surface-1)) 70%)" }}
        >
          <ChevronRight className="size-4 text-muted-foreground animate-pulse" />
        </div>
      ) : null}
    </div>
  );
}
