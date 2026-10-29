import { jsPDF } from "jspdf";

// DANFE gerada aqui a partir do XML autorizado -- Victor 29/10/2026: a ponte
// do Pedro não imprime a nota de venda (5922, "a nota que acompanha a
// mercadoria é a 5117"), mas o SAC precisa mandar a 2ª via ao cliente. A ponte
// devolve o XML de qualquer nota (/nota/<chave>/xml) e a cópia de madrugada
// guarda os do Protheus (copiaXmlNotas.ts). Layout retrato com os quadros da
// DANFE e o código de barras (Code 128C) da chave.

export type ItemNfe = { codigo: string; descricao: string; ncm: string; cst: string; cfop: string; un: string; qtd: number; vUnit: number; vTotal: number };
export type Nfe = {
  chave: string;
  numero: string;
  serie: string;
  natureza: string;
  tipo: string;
  emissao: string;
  saida: string;
  emit: { nome: string; fantasia: string; cnpj: string; ie: string; endereco: string; municipio: string; uf: string; cep: string; fone: string };
  dest: { nome: string; doc: string; endereco: string; bairro: string; municipio: string; uf: string; cep: string; fone: string; ie: string };
  totais: Record<"vBC" | "vICMS" | "vBCST" | "vST" | "vProd" | "vFrete" | "vSeg" | "vDesc" | "vOutro" | "vIPI" | "vNF", number>;
  frete: string;
  volumes: string;
  itens: ItemNfe[];
  infCpl: string;
  protocolo: string;
  autorizadaEm: string;
  ambiente: string;
};

const desfazer = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

function tag(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? desfazer(m[1].trim()) : "";
}
const bloco = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>[\\s\\S]*?</${nome}>`))?.[0] ?? "";
const num = (s: string) => (s ? Number(s) : 0);

const MOD_FRETE: Record<string, string> = {
  "0": "0 - Por conta do emitente",
  "1": "1 - Por conta do destinatário",
  "2": "2 - Por conta de terceiros",
  "3": "3 - Próprio, do remetente",
  "4": "4 - Próprio, do destinatário",
  "9": "9 - Sem frete",
};

export function lerNfe(xml: string): Nfe {
  const inf = bloco(xml, "infNFe");
  if (!inf) throw new Error("XML sem infNFe");
  const ide = bloco(inf, "ide");
  const emit = bloco(inf, "emit");
  const ee = bloco(emit, "enderEmit");
  const dest = bloco(inf, "dest");
  const ed = bloco(dest, "enderDest");
  const tot = bloco(inf, "ICMSTot");
  const transp = bloco(inf, "transp");
  const prot = bloco(xml, "infProt");
  const chave = (inf.match(/Id="NFe(\d{44})"/)?.[1] ?? tag(prot, "chNFe")).replace(/\D/g, "");
  const endereco = (b: string) => [tag(b, "xLgr"), tag(b, "nro"), tag(b, "xCpl")].filter(Boolean).join(", ");
  const itens = [...inf.matchAll(/<det\s[^>]*>([\s\S]*?)<\/det>/g)].map(([, d]) => {
    const prod = bloco(d, "prod");
    const icms = bloco(d, "ICMS");
    return {
      codigo: tag(prod, "cProd"),
      descricao: tag(prod, "xProd"),
      ncm: tag(prod, "NCM"),
      cst: `${tag(icms, "orig")}${tag(icms, "CST") || tag(icms, "CSOSN")}`,
      cfop: tag(prod, "CFOP"),
      un: tag(prod, "uCom"),
      qtd: num(tag(prod, "qCom")),
      vUnit: num(tag(prod, "vUnCom")),
      vTotal: num(tag(prod, "vProd")),
    };
  });
  const vol = bloco(transp, "vol");
  return {
    chave,
    numero: tag(ide, "nNF"),
    serie: tag(ide, "serie"),
    natureza: tag(ide, "natOp"),
    tipo: tag(ide, "tpNF"),
    emissao: tag(ide, "dhEmi") || tag(ide, "dEmi"),
    saida: tag(ide, "dhSaiEnt") || tag(ide, "dSaiEnt"),
    emit: {
      nome: tag(emit, "xNome"),
      fantasia: tag(emit, "xFant"),
      cnpj: tag(emit, "CNPJ") || tag(emit, "CPF"),
      ie: tag(emit, "IE"),
      endereco: [endereco(ee), tag(ee, "xBairro")].filter(Boolean).join(" - "),
      municipio: tag(ee, "xMun"),
      uf: tag(ee, "UF"),
      cep: tag(ee, "CEP"),
      fone: tag(ee, "fone"),
    },
    dest: {
      nome: tag(dest, "xNome"),
      doc: tag(dest, "CNPJ") || tag(dest, "CPF") || tag(dest, "idEstrangeiro"),
      endereco: endereco(ed),
      bairro: tag(ed, "xBairro"),
      municipio: tag(ed, "xMun"),
      uf: tag(ed, "UF"),
      cep: tag(ed, "CEP"),
      fone: tag(ed, "fone"),
      ie: tag(dest, "IE"),
    },
    totais: {
      vBC: num(tag(tot, "vBC")),
      vICMS: num(tag(tot, "vICMS")),
      vBCST: num(tag(tot, "vBCST")),
      vST: num(tag(tot, "vST")),
      vProd: num(tag(tot, "vProd")),
      vFrete: num(tag(tot, "vFrete")),
      vSeg: num(tag(tot, "vSeg")),
      vDesc: num(tag(tot, "vDesc")),
      vOutro: num(tag(tot, "vOutro")),
      vIPI: num(tag(tot, "vIPI")),
      vNF: num(tag(tot, "vNF")),
    },
    frete: MOD_FRETE[tag(transp, "modFrete")] ?? tag(transp, "modFrete"),
    volumes: vol ? [tag(vol, "qVol"), tag(vol, "esp")].filter(Boolean).join(" ") : "",
    itens,
    infCpl: tag(bloco(inf, "infAdic"), "infCpl"),
    protocolo: tag(prot, "nProt"),
    autorizadaEm: tag(prot, "dhRecbto"),
    ambiente: tag(ide, "tpAmb"),
  };
}

// ---------------------------------------------------------------- Code 128C

// Larguras (barra, espaço, ...) dos 107 símbolos do Code 128; o 106 é o stop.
export const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

// Só dígitos, em número par (a chave tem 44): start C, pares, dígito verificador, stop.
export function code128C(digitos: string): number[] {
  if (!/^(\d\d)+$/.test(digitos)) throw new Error("Code 128C pede um número par de dígitos");
  const valores = [105, ...(digitos.match(/\d\d/g) ?? []).map(Number)];
  const dv = valores.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103;
  return [...valores, dv, 106].flatMap((v) => CODE128[v].split("").map(Number));
}

// ---------------------------------------------------------------- PDF

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const dataHora = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}` : iso;
};
const docFmt = (d: string) =>
  d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : d;
const cepFmt = (c: string) => c.replace(/^(\d{5})(\d{3})$/, "$1-$2");
const chaveFmt = (c: string) => c.replace(/(\d{4})(?=\d)/g, "$1 ");

export function gerarDanfe(n: Nfe): Uint8Array {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const M = 7;
  const L = 210 - 2 * M;
  pdf.setLineWidth(0.2);

  const campo = (x: number, y: number, w: number, h: number, rotulo: string, valor: string, o: { tam?: number; dir?: boolean; negrito?: boolean } = {}) => {
    pdf.rect(x, y, w, h);
    pdf.setFont("helvetica", "normal").setFontSize(5.5).text(rotulo.toUpperCase(), x + 1, y + 2.4);
    pdf.setFont("helvetica", o.negrito ? "bold" : "normal").setFontSize(o.tam ?? 8);
    const linhas = pdf.splitTextToSize(valor || "", w - 2) as string[];
    pdf.text(linhas.slice(0, Math.max(1, Math.floor((h - 3) / 3.4))), o.dir ? x + w - 1 : x + 1, y + 5.6, { align: o.dir ? "right" : "left" });
  };
  const titulo = (y: number, t: string) => {
    pdf.setFont("helvetica", "bold").setFontSize(6.5).text(t, M, y - 0.8);
  };

  // Canhoto
  let y = M;
  campo(M, y, L - 40, 10, `Recebemos de ${n.emit.nome} os produtos constantes da nota fiscal indicada ao lado`, "");
  campo(M, y + 10, 40, 8, "Data de recebimento", "");
  campo(M + 40, y + 10, L - 80, 8, "Identificação e assinatura do recebedor", "");
  pdf.rect(M + L - 40, y, 40, 18);
  pdf.setFont("helvetica", "bold").setFontSize(10).text("NF-e", M + L - 20, y + 6, { align: "center" });
  pdf.setFontSize(9).text(`Nº ${n.numero}`, M + L - 20, y + 11, { align: "center" }).text(`Série ${n.serie}`, M + L - 20, y + 15.5, { align: "center" });
  y += 21;
  pdf.setLineDashPattern([1, 1], 0).line(M, y - 1.5, M + L, y - 1.5).setLineDashPattern([], 0);

  // Emitente / DANFE / chave
  const hCab = 32;
  pdf.rect(M, y, 78, hCab);
  pdf.setFont("helvetica", "bold").setFontSize(8.5);
  pdf.text(pdf.splitTextToSize(n.emit.nome, 74) as string[], M + 2, y + 5);
  pdf.setFont("helvetica", "normal").setFontSize(7);
  const endEmit = [n.emit.fantasia, n.emit.endereco, `${n.emit.municipio} - ${n.emit.uf} - CEP ${cepFmt(n.emit.cep)}`, n.emit.fone ? `Fone ${n.emit.fone}` : ""].filter(Boolean);
  pdf.text(pdf.splitTextToSize(endEmit.join("\n"), 74) as string[], M + 2, y + 14);
  pdf.rect(M + 78, y, 32, hCab);
  pdf.setFont("helvetica", "bold").setFontSize(12).text("DANFE", M + 94, y + 6, { align: "center" });
  pdf.setFont("helvetica", "normal").setFontSize(6).text(["Documento Auxiliar da", "Nota Fiscal Eletrônica"], M + 94, y + 9.5, { align: "center" });
  pdf.setFontSize(7).text(["0 - Entrada", "1 - Saída"], M + 80, y + 17);
  pdf.rect(M + 101, y + 14.5, 6, 6);
  pdf.setFont("helvetica", "bold").setFontSize(10).text(n.tipo || "1", M + 104, y + 19, { align: "center" });
  pdf.setFontSize(8).text([`Nº ${n.numero}`, `Série ${n.serie}`, "Folha 1/{total}"], M + 94, y + 24.5, { align: "center" });
  const xC = M + 110;
  const wC = L - 110;
  pdf.rect(xC, y, wC, hCab);
  const barras = code128C(n.chave);
  const modulo = (wC - 6) / barras.reduce((s, b) => s + b, 0);
  let xb = xC + 3;
  barras.forEach((b, i) => {
    if (i % 2 === 0) pdf.setFillColor(0, 0, 0).rect(xb, y + 2, b * modulo, 11, "F");
    xb += b * modulo;
  });
  pdf.setFont("helvetica", "normal").setFontSize(5.5).text("CHAVE DE ACESSO", xC + 1, y + 16);
  pdf.setFont("helvetica", "bold").setFontSize(8).text(chaveFmt(n.chave), xC + wC / 2, y + 19.5, { align: "center" });
  pdf.setFont("helvetica", "normal").setFontSize(6.5).text(
    ["Consulta de autenticidade no portal nacional da NF-e", "www.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora"],
    xC + wC / 2,
    y + 24,
    { align: "center" }
  );
  y += hCab;
  campo(M, y, 110, 8, "Natureza da operação", n.natureza);
  campo(M + 110, y, L - 110, 8, "Protocolo de autorização de uso", `${n.protocolo}  ${dataHora(n.autorizadaEm)}`, { negrito: true });
  y += 8;
  campo(M, y, 65, 8, "Inscrição estadual", n.emit.ie);
  campo(M + 65, y, 65, 8, "Insc. estadual do subst. trib.", "");
  campo(M + 130, y, L - 130, 8, "CNPJ", docFmt(n.emit.cnpj));
  y += 11;

  // Destinatário
  titulo(y, "DESTINATÁRIO / REMETENTE");
  campo(M, y, 120, 8, "Nome / razão social", n.dest.nome);
  campo(M + 120, y, 40, 8, "CNPJ / CPF", docFmt(n.dest.doc));
  campo(M + 160, y, L - 160, 8, "Data da emissão", dataHora(n.emissao).slice(0, 10));
  y += 8;
  campo(M, y, 95, 8, "Endereço", n.dest.endereco);
  campo(M + 95, y, 45, 8, "Bairro / distrito", n.dest.bairro);
  campo(M + 140, y, 20, 8, "CEP", cepFmt(n.dest.cep));
  campo(M + 160, y, L - 160, 8, "Data da saída", dataHora(n.saida).slice(0, 10));
  y += 8;
  campo(M, y, 70, 8, "Município", n.dest.municipio);
  campo(M + 70, y, 35, 8, "Fone / fax", n.dest.fone);
  campo(M + 105, y, 15, 8, "UF", n.dest.uf);
  campo(M + 120, y, 40, 8, "Inscrição estadual", n.dest.ie);
  campo(M + 160, y, L - 160, 8, "Hora da saída", dataHora(n.saida).slice(11));
  y += 11;

  // Impostos
  titulo(y, "CÁLCULO DO IMPOSTO");
  const t = n.totais;
  const linha1: [string, number][] = [["Base de cálc. do ICMS", t.vBC], ["Valor do ICMS", t.vICMS], ["Base de cálc. ICMS S.T.", t.vBCST], ["Valor do ICMS subst.", t.vST], ["Valor total dos produtos", t.vProd]];
  const linha2: [string, number][] = [["Valor do frete", t.vFrete], ["Valor do seguro", t.vSeg], ["Desconto", t.vDesc], ["Outras despesas", t.vOutro], ["Valor do IPI", t.vIPI], ["Valor total da nota", t.vNF]];
  linha1.forEach(([r, v], i) => campo(M + (i * L) / 5, y, L / 5, 8, r, brl(v), { dir: true }));
  y += 8;
  linha2.forEach(([r, v], i) => campo(M + (i * L) / 6, y, L / 6, 8, r, brl(v), { dir: true, negrito: i === 5 }));
  y += 11;

  // Transporte
  titulo(y, "TRANSPORTADOR / VOLUMES TRANSPORTADOS");
  campo(M, y, 110, 8, "Frete por conta", n.frete);
  campo(M + 110, y, L - 110, 8, "Volumes", n.volumes);
  y += 11;

  // Produtos
  titulo(y, "DADOS DOS PRODUTOS / SERVIÇOS");
  const colunas: { r: string; w: number; dir?: boolean }[] = [
    { r: "Código", w: 16 },
    { r: "Descrição do produto / serviço", w: 72 },
    { r: "NCM", w: 15 },
    { r: "CST", w: 9 },
    { r: "CFOP", w: 10 },
    { r: "Un", w: 9 },
    { r: "Quant.", w: 15, dir: true },
    { r: "Valor unit.", w: 25, dir: true },
    { r: "Valor total", w: L - 171, dir: true },
  ];
  const cabecalho = (yy: number) => {
    let x = M;
    pdf.setFont("helvetica", "bold").setFontSize(5.5);
    for (const c of colunas) {
      pdf.rect(x, yy, c.w, 5);
      pdf.text(c.r.toUpperCase(), c.dir ? x + c.w - 1 : x + 1, yy + 3.4, { align: c.dir ? "right" : "left" });
      x += c.w;
    }
    return yy + 5;
  };
  const ALTURA_PAGINA = 297 - M;
  const RODAPE = 30;
  y = cabecalho(y);
  pdf.setFont("helvetica", "normal").setFontSize(7);
  for (const it of n.itens) {
    const desc = pdf.splitTextToSize(it.descricao, colunas[1].w - 2) as string[];
    const h = Math.max(5, desc.length * 3 + 2);
    if (y + h > ALTURA_PAGINA - RODAPE) {
      pdf.addPage();
      y = cabecalho(M);
      pdf.setFont("helvetica", "normal").setFontSize(7);
    }
    const valores = [it.codigo, desc, it.ncm, it.cst, it.cfop, it.un, qtd(it.qtd), brl(it.vUnit), brl(it.vTotal)];
    let x = M;
    colunas.forEach((c, i) => {
      pdf.rect(x, y, c.w, h);
      pdf.text(valores[i] as string | string[], c.dir ? x + c.w - 1 : x + 1, y + 3.4, { align: c.dir ? "right" : "left" });
      x += c.w;
    });
    y += h;
  }

  // Dados adicionais
  y = Math.max(y + 3, ALTURA_PAGINA - RODAPE + 3);
  titulo(y, "DADOS ADICIONAIS");
  const aviso = n.ambiente === "2" ? "SEM VALOR FISCAL - EMITIDA EM HOMOLOGAÇÃO. " : "";
  campo(M, y, L, RODAPE - 6, "Informações complementares", `${aviso}${n.infCpl}\n\n2ª via da DANFE gerada pelo SAC da Lojas Maia a partir do XML autorizado da NF-e (protocolo ${n.protocolo}).`, { tam: 7 });

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    if (p > 1) pdf.setFont("helvetica", "normal").setFontSize(7).text(`NF-e ${n.numero} série ${n.serie} · folha ${p}/${total}`, M + L, 297 - 3, { align: "right" });
  }
  pdf.putTotalPages("{total}");
  return new Uint8Array(pdf.output("arraybuffer"));
}
