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
import { useEffect, useRef, useState } from "react";
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
import { type LegacyColumnDef as ColumnDef, getCoreRowModel, useLegacyTable as useReactTable } from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { ChevronRight, MoreHorizontal, Copy } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ComprasModalButton } from "@/components/ComprasModalButton";
import type { ClienteNivelInfo } from "@/lib/clientes";
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

export function ClientesNivelTable({
  items,
  clvByClientId,
}: {
  items: ClienteNivelInfo[];
  // Map não serializa tão previsível quanto objeto plano por essa borda
  // Server -> Client -- veio convertido em clientes/page.tsx.
  clvByClientId: Record<string, number>;
}) {
  // Aviso visual de que dá pra rolar a tabela pro lado -- pedido do Victor
  // 15/09/2026 depois de achar que as colunas da direita estavam sendo
  // "cortadas" (na verdade só rolam, mas sem indicação nenhuma o scrollbar
  // nativo do Windows some quando não tá em uso e ninguém descobre sozinho).
  // Quem realmente rola é o container interno do <Table> (ui/table.tsx,
  // data-slot="table-container") -- esse wrapper aqui só serve pra achar
  // ele via querySelector, não tem overflow próprio.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Barra de rolagem duplicada no topo -- pedido do Victor 15/09/2026:
  // tabela comprida (muitas linhas), o scrollbar horizontal só aparece no
  // fim dela, obrigando rolar a página toda pra baixo só pra rolar pro
  // lado. topRef é uma barra falsa em cima da tabela, sincronizada nos
  // dois sentidos com o scroll de verdade (mesmo elemento data-slot=
  // table-container de cima); spacerRef só existe pra dar largura de
  // rolagem igual à da tabela real.
  const topRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef<"top" | "bottom" | null>(null);

  useEffect(() => {
    const el = wrapperRef.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]');
    const top = topRef.current;
    const spacer = spacerRef.current;
    if (!el || !top || !spacer) return;
    scrollElRef.current = el;

    const update = () => {
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
      spacer.style.width = `${el.scrollWidth}px`;
    };
    update();

    const onBottomScroll = () => {
      update();
      if (syncingRef.current === "top") return;
      syncingRef.current = "bottom";
      top.scrollLeft = el.scrollLeft;
      syncingRef.current = null;
    };
    const onTopScroll = () => {
      if (syncingRef.current === "bottom") return;
      syncingRef.current = "top";
      el.scrollLeft = top.scrollLeft;
      syncingRef.current = null;
    };

    el.addEventListener("scroll", onBottomScroll);
    top.addEventListener("scroll", onTopScroll);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onBottomScroll);
      top.removeEventListener("scroll", onTopScroll);
      observer.disconnect();
    };
  }, [items]);

  const columns: ColumnDef<ClienteNivelInfo>[] = [
    {
      id: "posicao",
      // Abreviado (Posição -> Pos.) -- pedido do Victor 15/09/2026: sob
      // alinhamento à direita, um título bem mais longo que o valor (ex.
      // "Posição" vs "1º") deixa o título visivelmente "puxado" pra
      // esquerda do dado, mesmo as duas bordas direitas coincidindo
      // (confirmado por medição -- thead/tbody sempre têm a mesma largura
      // de coluna numa <table> só). Abreviar encolhe essa folga.
      header: () => <div className="text-right">Pos.</div>,
      cell: ({ row }) => <div className="text-right text-muted-foreground tabular-nums">{row.original.posicaoNoNivel}º</div>,
    },
    {
      id: "nome",
      accessorFn: (c) => c.nome ?? c.clientId,
      header: "Nome",
      // Texto simples, sem botão de expandir -- pedido do Victor
      // 16/09/2026: histórico de compras vira o botão "Ver compras" na
      // coluna própria (ver coluna "compras" abaixo), mesma lógica de "Ver
      // produtos (N)" da tela de Entregas, em vez de expandir a linha.
      cell: ({ row }) => <span className="font-medium">{row.original.nome ?? row.original.clientId}</span>,
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
      // Botão "Ver compras (N)" em vez de só o número -- pedido do Victor
      // 16/09/2026, mesma lógica de "Ver produtos (N)" da tela de Entregas
      // (abre modal em vez de expandir a linha, ver ComprasModalButton.tsx).
      cell: ({ row, getValue }) => (
        <div className="text-right">
          <ComprasModalButton clientId={row.original.clientId} count={getValue<number>()} />
        </div>
      ),
    },
    {
      id: "gasto",
      accessorKey: "gastoAcumulado",
      // Coluna de valores financeiros alinhada à direita + moeda pt-BR
      // (pedido explícito).
      header: () => <div className="text-right">Gasto acum.</div>,
      cell: ({ getValue }) => <div className="text-right font-semibold text-[var(--brand-green)] tabular-nums">{formatBRL(getValue<number>())}</div>,
    },
    {
      id: "clv",
      header: () => <div className="text-right">CLV ({CLV_HORIZONTE_ANOS}a)</div>,
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
    getRowId: (row) => row.clientId,
    getCoreRowModel: getCoreRowModel(),
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
      <div
        ref={topRef}
        className="min-w-0 overflow-x-auto overflow-y-hidden border-b [scrollbar-color:var(--brand-green)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--brand-green)]"
        style={{ height: 17, borderColor: "var(--border)" }}
      >
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-[color-mix(in_srgb,var(--brand-green)_10%,var(--surface-1))]">
              {headerGroup.headers.map((header) => (
                // Cabeçalho compacto/uppercase -- pedido do Victor 16/09/2026:
                // "fiquem com a tabela muito parecida com a lógica dessa"
                // (tela de Entregas, EntregasFlatList.tsx: text-[11px]
                // uppercase tracking-wider text-muted-foreground).
                <TableHead key={header.id} className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-[var(--surface-2)]">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canScrollRight ? (
        // Botão de verdade (clicável, rola a tabela), não só um ícone
        // decorativo -- pedido do Victor 15/09/2026: "a setinha de arrastar
        // pro lado não está funcionando" (tentou clicar nela esperando que
        // rolasse). Só cobre a altura do cabeçalho (h-10, igual TableHead)
        // -- se cobrisse a tabela inteira o botão ficaria no meio de uma
        // lista de dezenas de linhas, fora da área visível ao carregar.
        <button
          type="button"
          onClick={() => scrollElRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
          aria-label="Rolar a tabela para o lado"
          className="absolute top-0 right-0 h-10 w-10 flex items-center justify-end pr-1 cursor-pointer"
          style={{ background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--brand-green) 10%, var(--surface-1)) 70%)" }}
        >
          <ChevronRight className="size-4 text-muted-foreground animate-pulse" />
        </button>
      ) : null}
    </div>
  );
}
