import { describe, it, expect } from "vitest";
import { CODE128, code128C, gerarDanfe, lerNfe } from "./danfe";

const CHAVE = "25261000000000000100550010000012341000000017";
const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe versao="4.00" Id="NFe${CHAVE}">
<ide><natOp>Simples Faturamento</natOp><serie>1</serie><nNF>1234</nNF><dhEmi>2026-10-28T16:51:15-03:00</dhEmi><dhSaiEnt>2026-10-28T16:51:15-03:00</dhSaiEnt><tpNF>1</tpNF><tpAmb>1</tpAmb></ide>
<emit><CNPJ>00000000000100</CNPJ><xNome>LOJA TESTE LTDA</xNome><xFant>201 Teste</xFant><enderEmit><xLgr>AV TESTE</xLgr><nro>1</nro><xBairro>CENTRO</xBairro><xMun>Bayeux</xMun><UF>PB</UF><CEP>58110000</CEP></enderEmit><IE>123</IE></emit>
<dest><CPF>11122233344</CPF><xNome>CLIENTE TESTE</xNome><enderDest><xLgr>RUA A</xLgr><nro>10</nro><xBairro>BAIRRO B</xBairro><xMun>Bayeux</xMun><UF>PB</UF><CEP>58111000</CEP></enderDest></dest>
<det nItem="1"><prod><cProd>071161</cProd><xProd>PENTEADEIRA TESTE (COM LEDS) FREIJO/BRANCO</xProd><NCM>94036000</NCM><CFOP>5922</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>780.0000000000</vUnCom><vProd>780.00</vProd></prod><imposto><ICMS><ICMS40><orig>0</orig><CST>41</CST></ICMS40></ICMS></imposto></det>
<total><ICMSTot><vBC>0.00</vBC><vProd>780.00</vProd><vNF>780.00</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><infAdic><infCpl>CLIENTE RETIRA &amp; CIA</infCpl></infAdic></infNFe></NFe>
<protNFe versao="4.00"><infProt><chNFe>${CHAVE}</chNFe><dhRecbto>2026-10-28T16:51:18-03:00</dhRecbto><nProt>225260000000001</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;

describe("lerNfe", () => {
  it("tira do XML o que vai na DANFE", () => {
    const n = lerNfe(xml);
    expect(n).toMatchObject({ chave: CHAVE, numero: "1234", serie: "1", natureza: "Simples Faturamento", protocolo: "225260000000001", frete: "9 - Sem frete", infCpl: "CLIENTE RETIRA & CIA" });
    expect(n.dest).toMatchObject({ nome: "CLIENTE TESTE", doc: "11122233344", municipio: "Bayeux" });
    expect(n.itens).toEqual([{ codigo: "071161", descricao: "PENTEADEIRA TESTE (COM LEDS) FREIJO/BRANCO", ncm: "94036000", cst: "041", cfop: "5922", un: "UN", qtd: 1, vUnit: 780, vTotal: 780 }]);
    expect(n.totais.vNF).toBe(780);
  });
});

describe("code128C", () => {
  it("tabela: 107 símbolos distintos de 11 módulos (stop 13)", () => {
    expect(CODE128).toHaveLength(107);
    expect(new Set(CODE128).size).toBe(107);
    CODE128.forEach((p, i) => expect([...p].reduce((s, c) => s + Number(c), 0)).toBe(i === 106 ? 13 : 11));
  });
  it("start C, 22 pares, verificador e stop", () => {
    const larguras = code128C(CHAVE);
    expect(larguras.reduce((s, b) => s + b, 0)).toBe(11 * (1 + 22 + 1) + 13);
    expect(larguras.slice(0, 6).join("")).toBe("211232");
    const pares = CHAVE.match(/\d\d/g)!.map(Number);
    const dv = (105 + pares.reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
    expect(larguras.slice(6 * 23, 6 * 24).join("")).toBe(CODE128[dv]);
  });
});

describe("gerarDanfe", () => {
  it("gera um PDF", () => {
    const pdf = gerarDanfe(lerNfe(xml));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
