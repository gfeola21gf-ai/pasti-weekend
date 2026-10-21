/* =========================================================
   app.js — Pasti del weekend.
   1. ELENCO dei partecipanti (importato: nome + staff/corsista) = chi deve esserci
   2. RISPOSTE del Google Modulo, importate da un file (Excel o CSV) = abbinate per nome.
      Il file si legge nel browser e si salva su Supabase (solo organizzatori): nessun link pubblico.
   3. CORREZIONI a mano su Supabase (condivise tra organizzatori) = valgono più del modulo
   Telefono: una scheda per pasto. Schermo largo (Mac, iPad orizzontale): tabella con tutti i pasti.
   ========================================================= */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
import { SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA);
const $app = document.getElementById("app");
const $foglio = document.getElementById("foglio");
const GRUPPI = { staff: "Staff", corsisti: "Corsisti" };
const largo = matchMedia("(min-width: 900px)");

/* ---------- I campi che cerchiamo nel modulo ----------
   "parole" servono a riconoscere da sola la colonna giusta (intestazione = domanda del modulo).
   L'ordine conta: prima le domande più specifiche. */
const CAMPI = [
  { k: "nome",   etic: "Nome e cognome",               parole: ["nome"] },
  { k: "gruppo", etic: "Staff o corsista (facoltativa)", parole: ["staff", "corsist", "ruolo", "gruppo"] },
  { k: "piatto", etic: "Sab. pranzo: cosa mangia", parole: ["cosa vuoi mangiare", "cosa mangi", "primo o secondo", "piatto", "portata", "scegli", "preferisc", "primo", "secondo"] },
  { k: "ospiti", etic: "Sab. cena: accompagnatori",    parole: ["accompagn", "porti qualcuno", "ospit", "+1", "porterai"] },
  { k: "ven",    etic: "Venerdì apericena",            parole: ["venerd", "aperic"] },
  { k: "sabP",   etic: "Sabato pranzo",                parole: ["pranzo del sabato", "pranzo di sabato", "sabato pranzo", "sabato a pranzo", "pranzo sabato"] },
  { k: "sabC",   etic: "Sabato cena",                  parole: ["cena"] },
  { k: "dom",    etic: "Domenica pranzo",              parole: ["domenica"] },
];

const PASTI = [
  { k: "ven",  tab: "Ven", icona: "🍕", titolo: "Apericena del venerdì", sotto: "Pizza · 5 € a testa" },
  { k: "sabP", tab: "Sab pranzo", icona: "🍽️", titolo: "Pranzo del sabato", sotto: "Ristorante · menù fisso" },
  { k: "sabC", tab: "Sab cena", icona: "🎉", titolo: "Cena di festa", sotto: "Sabato sera · pizza" },
  { k: "dom",  tab: "Dom", icona: "🍝", titolo: "Pranzo della domenica", sotto: "Trattoria · menù alla carta" },
];

/* ---------- Stato ---------- */
const S = {
  utente: null,
  scheda: leggiLocale("pasti.scheda") || (largo.matches ? "tutti" : "ven"),
  filtro: "tutti",       // tutti | si | ignoti | vuoti
  ordine: leggiLocale("pasti.ordine") || "alfa",   // alfa | stato
  classi: [],                                      // [{ id, nome, ordine }]
  classe: leggiLocale("pasti.classe"),             // classe aperta (null = schermata delle classi)
  gruppo: "tutti",       // tutti | staff | corsisti
  cerca: "",
  imp: { modulo: { mappa: {} }, elenco: [] },   // condivise su Supabase
  modulo: null,          // { intest, righe, mappa, errore }
  correzioni: new Map(), // id → riga di weekend_persone
  organizzatori: [],
  carica: false,
};

function leggiLocale(k) { try { return localStorage.getItem(k); } catch { return null; } }
function scriviLocale(k, v) { try { localStorage.setItem(k, v); } catch {} }
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norma = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
/** Chiave per abbinare i nomi: senza accenti, maiuscole e ordine ("Rossi Mario" = "mario rossi") */
const chiave = (nome) => norma(nome).replace(/[^a-z0-9' ]/g, " ").split(" ").filter(Boolean).sort().join(" ");

/* ---------- Stessa persona, scritta in modo diverso ----------
   Conta la sostanza: oltre a maiuscole, accenti e ordine, vanno bene secondi nomi in più ("Mario Giuseppe Rossi"),
   parole unite o staccate ("De Luca" = "Deluca", "D'Amico" = "Damico"), doppie ("Matia" = "Mattia") e un errore
   di battitura nelle parole lunghe. Prudenza: "Marco"/"Mario" o "Alessandro"/"Alessandra" restano persone diverse. */
const parole = (nome) => norma(nome).replace(/['’`]/g, "").replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean).map((t) => t.replace(/(.)\1+/g, "$1"));
function distanza(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function stessoNome(a, b) {
  const A = parole(a), B = parole(b);
  if (!A.length || !B.length) return false;
  const usati = new Set(), restoA = [];
  for (const t of A) { const j = B.findIndex((u, i) => !usati.has(i) && u === t); if (j >= 0) usati.add(j); else restoA.push(t); }
  const restoB = B.filter((_, i) => !usati.has(i)), comuni = usati.size;
  if (!restoA.length && !restoB.length) return true;
  if ((!restoA.length || !restoB.length) && comuni >= 2) return true;               // secondo nome in più
  const unite = (r) => [r.join(""), [...r].reverse().join("")];
  if (restoA.length && restoB.length && comuni >= 1 && unite(restoA).some((x) => unite(restoB).includes(x))) return true; // De Luca = Deluca
  if (restoA.length === 1 && restoB.length === 1 && comuni >= 1) {                  // un errore di battitura
    const [x, y] = [restoA[0], restoB[0]];
    if (Math.min(x.length, y.length) >= 6 && distanza(x, y) <= 1 && x.slice(0, -1) !== y.slice(0, -1)) return true;
  }
  return false;
}
/** Cerca tra le persone già note qualcuno con lo stesso nome (prima uguale, poi "simile") */
const trovaSimile = (mappa, nome) => mappa.get("p:" + chiave(nome)) || [...mappa.values()].find((p) => stessoNome(p.nome, nome));
const gruppoDa = (t) => { t = norma(t); return /staff|docent|tutor|organizz/.test(t) ? "staff" : /corsist|partecip|alliev|student/.test(t) ? "corsisti" : ""; };

/* ---------- Lettura dei file (CSV, Excel) ---------- */

/** Trasforma il testo CSV in righe (gestisce virgolette e "a capo" dentro le celle) */
function leggiCsv(testo) {
  // Excel in italiano salva i CSV con il punto e virgola: lo riconosco dalla prima riga
  const prima = testo.split(/\r?\n/, 1)[0];
  const sep = (prima.match(/;/g) || []).length > (prima.match(/,/g) || []).length ? ";" : ",";
  const righe = []; let riga = [], cella = "", virg = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (virg) {
      if (c === '"' && testo[i + 1] === '"') { cella += '"'; i++; }
      else if (c === '"') virg = false;
      else cella += c;
    } else if (c === '"') virg = true;
    else if (c === sep) { riga.push(cella); cella = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(cella); righe.push(riga); riga = []; cella = "";
    } else cella += c;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  return righe.filter((r) => r.some((x) => x.trim()));
}

/** Indovina quale colonna corrisponde a quale campo.
    Guarda anche le RISPOSTE: la colonna del piatto ha risposte libere ("Amatriciana…"), quelle delle presenze "Sì / No". */
function indovinaMappa(intest, righe = []) {
  const mappa = {}, prese = new Set();
  const quotaSiNo = (j) => {
    const v = righe.map((r) => norma(r[j])).filter(Boolean);
    return v.length ? v.filter((x) => /^(s[iì]|no|non)\b/.test(x)).length / v.length : 0.5;
  };
  const adatta = (k, j) => k === "piatto" ? quotaSiNo(j) < 0.5 : ["ven", "sabP", "sabC", "dom"].includes(k) ? quotaSiNo(j) >= 0.5 : true;
  for (const c of CAMPI) {
    // prima le parole più precise (l'ordine in "parole" conta), poi le altre
    for (const p of c.parole) {
      const i = intest.findIndex((h, j) => !prese.has(j) && norma(h).includes(p) && adatta(c.k, j) && !/cronolog|timestamp|email/.test(norma(h)));
      if (i >= 0) { mappa[c.k] = intest[i]; prese.add(i); break; }
    }
  }
  // Una sola domanda a scelta multipla tipo "A quali pasti partecipi?" → vale per più campi
  const multi = intest.find((h) => /pasti|partecip|presenz/.test(norma(h)));
  if (multi) for (const k of ["ven", "sabP", "sabC", "dom"]) if (!mappa[k]) mappa[k] = multi;
  return mappa;
}

/** Riconosce l'opzione di un pasto dentro una risposta a scelta multipla */
function citaPasto(k, testo) {
  return testo.split(/[,;\n]/).map(norma).some((o) =>
    k === "ven" ? /venerd|aperic/.test(o)
    : k === "sabP" ? /pranzo/.test(o) && /sabato/.test(o)
    : k === "sabC" ? /cena/.test(o)
    : k === "dom" ? /domenic/.test(o) : false);
}

function siNo(valore, k, condivisa) {
  const t = norma(valore);
  if (!t) return undefined;
  if (condivisa) return citaPasto(k, valore);
  if (/^(no|non)\b/.test(t)) return false;
  return true;   // "Sì", "Certo", "Ci sarò", ecc.
}

/** Da una riga del modulo ai valori dei pasti */
function valoriDaRiga(riga, intest, mappa) {
  const cella = (k) => { const i = intest.indexOf(mappa[k]); return i >= 0 ? riga[i] ?? "" : ""; };
  const usi = {};
  for (const k of Object.keys(mappa)) usi[mappa[k]] = (usi[mappa[k]] || 0) + 1;
  const v = {};
  for (const k of ["ven", "sabP", "sabC", "dom"]) if (mappa[k]) {
    const x = siNo(cella(k), k, usi[mappa[k]] > 1);
    if (x !== undefined) v[k] = x;
  }
  if (mappa.piatto) {
    const t = norma(cella("piatto"));
    if (t) {
      v.piatto = piattoDa(t);
      const n = +(t.match(/^(\d+)\s/) || [])[1];   // "2 amatriciane" → 2 porzioni
      if (n > 1) v.porzioni = n;
      if (v.sabP === undefined) v.sabP = true;
    }
  }
  if (mappa.ospiti) {
    const t = norma(cella("ospiti")), n = t.match(/\d+/);
    if (n) v.ospiti = +n[0]; else if (t) v.ospiti = /^(no|non|nessun)/.test(t) ? 0 : 1;
    if (v.ospiti > 0 && v.sabC === undefined) v.sabC = true;
  }
  return v;
}

/* ---------- I due piatti del sabato a pranzo ----------
   Nel modulo le risposte sono i nomi dei piatti ("Amatriciana…", "Cotoletta…"): l'app li riconduce a "primo"/"secondo"
   e mostra i nomi veri (S.imp.piatti, modificabili in ⚙️). */
const SECONDI = /secondo|contorno|cotolett|carne|pollo|pesce|bistecc|arrost|scaloppin|polpett|salsicc|patate|insalat|verdur|cicoria|tagliata|filetto/;
const radice = (nome) => { const t = norma(nome); return t.slice(0, Math.max(4, t.length - 2)); };
function piattoDa(t) {
  t = norma(t).replace(/^\d+\s*/, "");
  const P = S.imp.piatti || {};
  if (/\bprimo\b/.test(t)) return "primo";
  if (P.primo && t.includes(radice(P.primo))) return "primo";
  if (P.secondo && t.includes(radice(P.secondo))) return "secondo";
  return SECONDI.test(t) ? "secondo" : "primo";
}
const nomePiatto = (x) => (S.imp.piatti || {})[x] || (x === "primo" ? "Primo" : "Secondo");
/** Dai nomi trovati nelle risposte: "Amatriciana (inclusa acqua…)" → "Amatriciana" */
function nomiPiattiDa(intest, righe, mappa) {
  const i = intest.indexOf(mappa.piatto);
  if (i < 0) return null;
  const conta = { primo: {}, secondo: {} };
  for (const r of righe) {
    const raw = (r[i] || "").trim();
    if (!raw || /^\d/.test(raw)) continue;
    const corto = raw.split(/\s*\(|\s+con\s+|\s*,/i)[0].trim();
    const k = SECONDI.test(norma(raw)) ? "secondo" : "primo";
    conta[k][corto] = (conta[k][corto] || 0) + 1;
  }
  const migliore = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0];
  const nomi = { primo: migliore(conta.primo), secondo: migliore(conta.secondo) };
  return nomi.primo || nomi.secondo ? nomi : null;
}

/** Le risposte importate (salvate su Supabase) → modulo con la mappa delle colonne */
function caricaModulo() {
  const { intest, righe, mappa: scelta } = S.imp.modulo || {};
  if (!intest?.length) { S.modulo = null; return; }
  const mappa = { ...indovinaMappa(intest, righe || []) };
  for (const [k, h] of Object.entries(scelta || {})) { if (h === "") delete mappa[k]; else if (intest.includes(h)) mappa[k] = h; }
  S.modulo = { intest, righe: righe || [], mappa };
  // nomi dei piatti: se non li hai ancora scelti, li prendo dalle risposte
  if (!S.imp.piatti?.scelti) { const n = nomiPiattiDa(intest, righe || [], mappa); if (n) S.imp.piatti = { primo: n.primo || "Primo", secondo: n.secondo || "Secondo" }; }
}

/** Legge un file tabella (CSV, TXT, Excel .xlsx/.xls, .ods) → righe di testo. Excel con SheetJS, caricato solo se serve. */
async function leggiFileTabella(file) {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".pdf")) throw new Error("Il PDF non si può leggere bene: scarica le risposte come Excel o CSV.");
  if (nome.endsWith(".zip")) throw new Error("È un file .zip: aprilo con un doppio clic e scegli il file .csv che c'è dentro.");
  if (/\.(csv|txt|tsv)$/.test(nome)) {
    const testo = await file.text();
    return nome.endsWith(".tsv") || (testo.includes("\t") && !testo.includes(",") && !testo.includes(";"))
      ? testo.split(/\r?\n/).filter((r) => r.trim()).map((r) => r.split("\t")) : leggiCsv(testo);
  }
  const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const libro = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  // il foglio con più righe (di solito "Risposte del modulo 1")
  const fogli = libro.SheetNames.map((n) => XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: false, defval: "" }));
  return fogli.sort((a, b) => b.length - a.length)[0].map((r) => r.map((c) => String(c ?? ""))).filter((r) => r.some((x) => x.trim()));
}

/* Colonne che NON salviamo mai su Supabase: non servono all'app e possono essere dati personali o sulla salute */
const SENSIBILI = /mail|telefon|cellular|cell\b|whatsapp|allerg|intolleran|dieta|alimentaz|salute|codice fiscale|indirizzo|nascita|documento|iban|note/;

/** Per ogni persona del file: la "firma" delle sue risposte (per capire cosa è cambiato tra un import e l'altro) */
function firme(intest, righe) {
  const out = new Map();
  if (!intest?.length) return out;
  const iNome = intest.indexOf(indovinaMappa(intest, righe).nome);
  if (iNome < 0) return out;
  for (const r of righe) {
    const nome = (r[iNome] || "").trim();
    if (nome) out.set(chiave(nome), JSON.stringify(intest.map((h, i) => (/cronolog|timestamp/.test(norma(h)) ? "" : norma(r[i])))));
  }
  return out;
}

async function importaRisposte(file) {
  try {
    const [intest0 = [], ...righe0] = await leggiFileTabella(file);
    const tieni = intest0.map((h, i) => (h.trim() && !SENSIBILI.test(norma(h)) ? i : -1)).filter((i) => i >= 0);
    const tolte = intest0.filter((h, i) => h.trim() && !tieni.includes(i));
    const intest = tieni.map((i) => intest0[i].trim());
    const righe = righe0.map((r) => tieni.map((i) => (r[i] ?? "").trim())).filter((r) => r.some(Boolean));
    if (!indovinaMappa(intest, righe).nome) throw new Error("Non trovo la colonna con il nome: è il file delle risposte del modulo?");
    const scelta = S.imp.modulo?.mappa || {};
    // chi ha risposte nuove o cambiate rispetto al file importato prima → «🆕 aggiornato»
    const prima = firme(S.imp.modulo?.intest, S.imp.modulo?.righe), dopo = firme(intest, righe);
    const aggiornati = prima.size ? [...dopo].filter(([k, f]) => prima.get(k) !== f).map(([k]) => "p:" + k) : [];
    S.imp.modulo = { file: file.name, quando: new Date().toISOString(), intest, righe, mappa: scelta, aggiornati };
    caricaModulo(); disegna(); await salvaImp("importazione delle risposte");
    alert(`Fatto: ${righe.length} risposte importate da «${file.name}».` + (tolte.length ? `\n\nNon salvate (dati personali non necessari): ${tolte.join(", ")}` : ""));
  } catch (e) { alert("Non riesco a importare il file: " + e.message); }
}

/* ---------- Elenco partecipanti: da testo incollato o file ----------
   Una persona per riga. Il gruppo si capisce da una parola nella riga ("staff", "corsista")
   oppure da righe-titolo da sole ("STAFF", "CORSISTI") che valgono per le righe sotto.
   Va bene anche copiare le colonne da Excel/Fogli (Nome, Cognome, Gruppo). */
function leggiElenco(testo) {
  const fuori = new Map();
  let corrente = "corsisti", alRovescio = false;
  for (const riga of testo.split(/\r?\n/)) {
    const parti = riga.split(/\t|;|,/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
    if (!parti.length) continue;
    if (parti.length === 1 && gruppoDa(parti[0]) && parti[0].split(" ").length <= 2 && /^[A-Za-zÀ-ÿ ]+:?$/.test(parti[0])) { corrente = gruppoDa(parti[0]); continue; }
    if (/^(nome|cognome|nominativo)$/i.test(parti[0])) {          // intestazione: "Cognome, Nome" → giro i nomi
      alRovescio = /^cognome$/i.test(parti[0]) && parti.some((x) => /^nome$/i.test(x));
      continue;
    }
    const pg = parti.find((x) => gruppoDa(x) && x.split(" ").length <= 2);
    const nomi = parti.filter((x) => x !== pg && !x.includes("@") && !/^\+?\d[\d\s]+$/.test(x));
    const nome = (alRovescio ? nomi.slice(0, 2).reverse() : nomi.slice(0, 2)).join(" ").replace(/^\d+[.)]\s*/, "");
    if (!nome) continue;
    fuori.set(chiave(nome), { nome, gruppo: pg ? gruppoDa(pg) : corrente });
  }
  return [...fuori.values()];
}

/* ---------- Unione: persone = elenco + modulo + correzioni ---------- */
/* Gruppo automatico: chi è nell'elenco = corsista (salvo "staff" scritto nell'elenco);
   chi risponde al modulo ma NON è nell'elenco = staff (lo staff non sta nell'elenco dei corsisti).
   Una scelta a mano (dati.gruppo) vale sempre di più. */
function persone(tutti = false, eliminati = false) {
  const tutte = new Map();
  for (const e of S.imp.elenco || []) {
    if (trovaSimile(tutte, e.nome)) continue;   // doppione nell'elenco
    const id = "p:" + chiave(e.nome);
    tutte.set(id, { id, nome: e.nome, gruppo: e.gruppo || "corsisti", inElenco: true, risposto: false, modulo: {}, mano: {}, scritto: new Set() });
  }
  const m = S.modulo;
  if (m?.mappa.nome) {
    const iNome = m.intest.indexOf(m.mappa.nome), iGr = m.intest.indexOf(m.mappa.gruppo);
    for (const riga of m.righe) {
      const nome = (riga[iNome] || "").trim();
      if (!nome) continue;
      const id = "p:" + chiave(nome);
      const p = trovaSimile(tutte, nome) || { id, nome, gruppo: "", inElenco: false, mano: {}, scritto: new Set() };
      if (chiave(nome) !== chiave(p.nome)) p.scritto.add(nome);   // nel modulo l'ha scritto così
      p.modulo = valoriDaRiga(riga, m.intest, m.mappa);   // l'ultima risposta vince
      p.risposto = true;
      if (!p.inElenco) p.gruppo = (iGr >= 0 && gruppoDa(riga[iGr])) || "staff";
      tutte.set(p.id, p);
    }
  }
  // iscrizioni dal link (le più recenti vincono): il gruppo lo decide il link usato
  for (const r of [...(S.iscrizioni || [])].sort((a, b) => a.aggiornata_il.localeCompare(b.aggiornata_il))) {
    const nome = (r.nome || "").trim();
    if (!nome) continue;
    const p = trovaSimile(tutte, nome) || { id: "p:" + chiave(nome), nome, gruppo: "", inElenco: false, mano: {}, scritto: new Set() };
    if (chiave(nome) !== chiave(p.nome)) p.scritto.add(nome);
    p.modulo = valoriIscrizione(r);
    p.risposto = true; p.iscritto = true;
    p.gruppo = r.gruppo;
    tutte.set(p.id, p);
  }
  // correzioni: prima quelle della persona giusta, poi quelle rimaste "orfane" di un doppione ora riconosciuto
  const corr = [...S.correzioni.values()].sort((a, b) => (tutte.has(b.id) ? 1 : 0) - (tutte.has(a.id) ? 1 : 0));
  for (const c of corr) {
    let p = tutte.get(c.id), dati = c.dati || {};
    if (!p && c.id.startsWith("p:") && (p = trovaSimile(tutte, c.nome))) {
      const { eliminato, gruppo, nome, ...risposte } = dati;   // del doppione tengo solo le risposte corrette a mano
      dati = { ...risposte, ...p.mano };
    }
    p = p || { id: c.id, nome: c.nome, gruppo: c.gruppo, modulo: {}, soloMano: true, inElenco: true, risposto: true, scritto: new Set() };
    p.mano = dati;
    if (dati.nome) p.nome = dati.nome;
    p.gruppoAuto = p.gruppoAuto || p.gruppo;
    if (dati.gruppo) p.gruppo = dati.gruppo;
    tutte.set(p.id, p);
  }
  let lista = [...tutte.values()];
  // eliminate: nascoste ovunque (anche se ricompaiono reimportando il file); si ripristinano in ⚙️ → Gruppi
  lista = lista.filter((p) => !!p.mano.eliminato === eliminati);
  if (!tutti && S.gruppo !== "tutti") lista = lista.filter((p) => p.gruppo === S.gruppo);
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}
/** Valore effettivo: la correzione a mano vince sul modulo. "ignoto" = scelto a mano «? Non so» */
const val = (p, k) => { const v = p.mano[k] !== undefined ? p.mano[k] : p.modulo[k]; return v === "ignoto" ? undefined : v; };
const aMano = (p, ...ks) => ks.some((k) => p.mano[k] !== undefined);
const vuoto = (p) => !p.risposto && !Object.keys(p.mano).length;   // in elenco, nessuna risposta né correzione

/* ---------- Annulla (⌘Z / Ctrl+Z e freccetta ↶) ----------
   Prima di ogni modifica salvo come tornare indietro: S.storia = [{ testo, annulla() }], al massimo 50.
   Vale per la classe aperta (cambiando classe la memoria si azzera) e per la schermata delle classi. */
const STORIA_MAX = 50;
S.storia = [];
function ricorda(testo, annulla) {
  if (S.annullando) return;            // mentre annullo non registro nuove azioni
  S.storia.push({ testo, annulla });
  if (S.storia.length > STORIA_MAX) S.storia.shift();
  aggiornaFreccia();
}
async function annullaUltima() {
  const u = S.storia.pop();
  aggiornaFreccia();
  if (!u) return avvisoBreve("Niente da annullare");
  S.annullando = true;
  try { await u.annulla(); } catch (e) { alert("Non riesco ad annullare: " + e.message); }
  finally { S.annullando = false; }
  disegna();
  avvisoBreve("Annullato: " + u.testo);
}
function azzeraStoria() { S.storia = []; aggiornaFreccia(); }
const $freccia = document.createElement("button");
$freccia.className = "annulla-btn"; $freccia.hidden = true; $freccia.textContent = "↶";
$freccia.setAttribute("aria-label", "Annulla l'ultima azione");
$freccia.addEventListener("click", annullaUltima);
document.body.append($freccia);
function aggiornaFreccia() {
  $freccia.hidden = !S.utente || !S.storia.length;
  if (S.storia.length) $freccia.title = `Annulla: ${S.storia.at(-1).testo} (⌘Z)`;
}
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
  if (e.target.matches?.("input, textarea, select, [contenteditable]")) return;   // lì vale l'annulla del testo
  e.preventDefault();
  annullaUltima();
});

/** Rimette una correzione com'era (o la toglie se prima non c'era) */
async function ripristinaRiga(classe, id, riga) {
  if (classe !== S.classe) return;
  if (riga) S.correzioni.set(id, structuredClone(riga)); else S.correzioni.delete(id);
  if (DEMO) return;
  const r = riga ? await sb.from("weekend_persone").upsert({ ...riga, classe }, { onConflict: "classe,id" })
    : await sb.from("weekend_persone").delete().eq("classe", classe).eq("id", id);
  if (r.error) throw r.error;
}
/** Prima di cambiare/eliminare una correzione: ricordo com'era */
function ricordaRiga(testo, id) {
  const prima = S.correzioni.get(id), classe = S.classe;
  const copia = prima ? structuredClone(prima) : null;
  ricorda(testo, () => ripristinaRiga(classe, id, copia));
}

/* ---------- Salvataggio su Supabase ---------- */
async function correggi(p, cambi, testo) {
  ricordaRiga(testo || `modifica di ${p.nome}`, p.id);
  const dati = { ...p.mano, ...cambi };
  for (const k of Object.keys(dati)) if (dati[k] === null) delete dati[k];
  const riga = { classe: S.classe, id: p.id, nome: p.nome, gruppo: p.gruppo || "", dati, aggiornato_il: new Date().toISOString() };
  S.correzioni.set(p.id, riga);
  disegna();
  if (DEMO) return;
  const { error } = await sb.from("weekend_persone").upsert(riga, { onConflict: "classe,id" });
  if (error) alert("Non salvato: " + error.message);
}

/** Salva le impostazioni della classe (elenco, risposte, posti…). Ricorda com'erano prima, per l'annulla. */
async function salvaImp(testo = "ultima modifica") {
  const prima = S.impSalvato, classe = S.classe;
  S.impSalvato = structuredClone(S.imp);
  if (prima) ricorda(testo, async () => {
    if (classe !== S.classe) return;
    S.imp = structuredClone(prima); S.impSalvato = structuredClone(prima);
    caricaModulo();
    await scriviImp();
  });
  await scriviImp();
}
async function scriviImp() {
  if (DEMO) return;
  const { error } = await sb.from("weekend_impostazioni").upsert({ id: S.classe, dati: S.imp });
  if (error) alert("Non salvato: " + error.message);
}

async function caricaTutto() {
  if (DEMO) return disegna();
  if (!S.classe) return caricaClassi();
  S.carica = true; disegna();
  const classe = S.classe;
  const [imp, corr, org, iscr] = await Promise.all([
    sb.from("weekend_impostazioni").select("dati").eq("id", classe).maybeSingle(),
    sb.from("weekend_persone").select("*").eq("classe", classe),
    sb.from("weekend_organizzatori").select("email").order("email"),
    sb.from("weekend_iscrizioni").select("*").eq("classe", classe),
  ]);
  if (iscr.data) S.iscrizioni = iscr.data;
  if (classe !== S.classe) return;   // nel frattempo è stata aperta un'altra classe
  S.imp = { modulo: { mappa: {} }, elenco: [], ...(imp.data?.dati || {}) };
  S.impSalvato = structuredClone(S.imp);
  if (corr.data) S.correzioni = new Map(corr.data.map((r) => [r.id, r]));
  if (org.data) S.organizzatori = org.data.map((r) => r.email);
  caricaModulo();
  S.carica = false; disegna();
}

/* ---------- Classi (corsi): ognuna con i suoi dati ---------- */
async function caricaClassi() {
  if (DEMO) return disegna();
  const { data, error } = await sb.from("weekend_classi").select("*").order("ordine").order("creata_il");
  if (error) { alert("Non riesco a leggere le classi: " + error.message); return; }
  S.classi = data || [];
  if (!S.classe) disegna();
}

function disegnaClassi() {
  return `<div class="contenuto stretto classi">
    <header class="testata"><h1>🍕 Pasti del weekend</h1></header>
    <h2 class="titolo-classi">Le tue classi</h2>
    <ul class="lista-classi">${S.classi.map((c, i) => `<li>
      <button class="apri-classe" data-apri-classe="${esc(c.id)}"><b>${esc(c.nome)}</b><span>Apri ›</span></button>
      <div class="azioni-classe">
        <button data-sposta-classe="${esc(c.id)}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="Sposta su" aria-label="Sposta su">↑</button>
        <button data-sposta-classe="${esc(c.id)}" data-dir="1" ${i === S.classi.length - 1 ? "disabled" : ""} title="Sposta giù" aria-label="Sposta giù">↓</button>
        <button data-rinomina-classe="${esc(c.id)}" title="Rinomina" aria-label="Rinomina">✎</button>
        <button data-elimina-classe="${esc(c.id)}" class="rosso" title="Elimina" aria-label="Elimina">🗑</button>
      </div></li>`).join("") || `<li class="vuoto">Nessuna classe: creane una qui sotto.</li>`}</ul>
    <form class="nuova-classe" data-nuova-classe><input type="text" name="nome" placeholder="Nome della nuova classe (es. Mind novembre 2026)" required>
      <button class="pulsante">＋ Crea</button></form>
    <p class="piccolo" style="text-align:center">Entrato come ${esc(S.utente.email)} · <a href="#" data-az="esci">Esci</a></p></div>`;
}

function apriClasse(id) {
  azzeraStoria();
  S.classe = id; scriviLocale("pasti.classe", id);
  S.imp = { modulo: { mappa: {} }, elenco: [] }; S.modulo = null; S.correzioni = new Map(); S.iscrizioni = [];
  S.cerca = ""; S.filtro = "tutti"; S.bollinoScelto = null; S.tavoloScelto = null;
  if (DEMO) { if (id === "demo") Object.assign(S, structuredClone(DEMO_DATI)), (S.correzioni = new Map()); S.impSalvato = structuredClone(S.imp); caricaModulo(); return disegna(); }
  caricaTutto();
}

async function azioneClasse(d) {
  if (d.az === "classi") { azzeraStoria(); S.classe = null; scriviLocale("pasti.classe", ""); return caricaClassi().then(disegna); }
  if (d.apriClasse) return apriClasse(d.apriClasse);
  const c = S.classi.find((x) => x.id === (d.spostaClasse || d.rinominaClasse || d.eliminaClasse));
  if (!c) return;
  if (d.rinominaClasse) {
    const nome = prompt("Nuovo nome della classe:", c.nome)?.trim();
    if (!nome) return;
    const vecchio = c.nome;
    ricorda(`rinomina di «${vecchio}»`, async () => { c.nome = vecchio; if (!DEMO) await sb.from("weekend_classi").update({ nome: vecchio }).eq("id", c.id); });
    c.nome = nome; disegna();
    if (!DEMO) await sb.from("weekend_classi").update({ nome }).eq("id", c.id);
  }
  if (d.spostaClasse) {
    const i = S.classi.indexOf(c), j = i + +d.dir;
    if (j < 0 || j >= S.classi.length) return;
    const ordinePrima = S.classi.map((x) => x.id);
    ricorda(`spostamento di «${c.nome}»`, async () => {
      S.classi.sort((a, b) => ordinePrima.indexOf(a.id) - ordinePrima.indexOf(b.id));
      S.classi.forEach((x, k) => (x.ordine = k));
      if (!DEMO) await sb.from("weekend_classi").upsert(S.classi.map(({ id, nome, ordine }) => ({ id, nome, ordine })));
    });
    [S.classi[i], S.classi[j]] = [S.classi[j], S.classi[i]];
    S.classi.forEach((x, k) => (x.ordine = k));
    disegna();
    if (!DEMO) await sb.from("weekend_classi").upsert(S.classi.map(({ id, nome, ordine }) => ({ id, nome, ordine })));
  }
  if (d.eliminaClasse) {
    if (!confirm(`Eliminare la classe «${c.nome}»?\n\nSi cancellano anche elenco, risposte, spunte, macchinate e posti di questa classe. Non si può annullare.`)) return;
    const posizione = S.classi.indexOf(c);
    let copia = { imp: null, persone: [], iscrizioni: [] };
    if (!DEMO) {
      const [imp, pers, iscr] = await Promise.all([sb.from("weekend_impostazioni").select("*").eq("id", c.id).maybeSingle(),
        sb.from("weekend_persone").select("*").eq("classe", c.id), sb.from("weekend_iscrizioni").select("*").eq("classe", c.id)]);
      copia = { imp: imp.data, persone: pers.data || [], iscrizioni: iscr.data || [] };
    }
    ricorda(`eliminazione di «${c.nome}»`, async () => {
      S.classi.splice(posizione, 0, c);
      if (DEMO) return;
      await sb.from("weekend_classi").insert({ id: c.id, nome: c.nome, ordine: c.ordine });
      if (copia.imp) await sb.from("weekend_impostazioni").upsert(copia.imp);
      if (copia.persone.length) await sb.from("weekend_persone").upsert(copia.persone, { onConflict: "classe,id" });
      if (copia.iscrizioni.length) await sb.from("weekend_iscrizioni").upsert(copia.iscrizioni);
    });
    S.classi = S.classi.filter((x) => x !== c); disegna();
    if (DEMO) return;
    await sb.from("weekend_persone").delete().eq("classe", c.id);
    await sb.from("weekend_iscrizioni").delete().eq("classe", c.id);
    await sb.from("weekend_impostazioni").delete().eq("id", c.id);
    const { error } = await sb.from("weekend_classi").delete().eq("id", c.id);
    if (error) alert("Errore: " + error.message);
  }
}

async function nuovaClasse(nome) {
  const c = { id: "c" + Date.now().toString(36), nome, ordine: S.classi.length };
  ricorda(`creazione di «${nome}»`, async () => {
    S.classi = S.classi.filter((x) => x.id !== c.id);
    if (!DEMO) { await sb.from("weekend_impostazioni").delete().eq("id", c.id); await sb.from("weekend_classi").delete().eq("id", c.id); }
  });
  S.classi.push(c); disegna();
  if (DEMO) return;
  const { error } = await sb.from("weekend_classi").insert(c);
  if (error) { alert("Non creata: " + error.message); S.classi = S.classi.filter((x) => x !== c); disegna(); }
}

/* ---------- Riepiloghi ---------- */
function riepilogo(k, tutte) {
  const ci = tutte.filter((p) => val(p, k) === true);
  if (k === "ven") {
    const pagati = ci.filter((p) => val(p, "pagato")).length;
    return { cifre: [[ci.length, "mangiano"], [pagati, "hanno pagato"], [(ci.length - pagati) * 5 + " €", "da raccogliere"]],
      nota: `Cassa: ${pagati * 5} € raccolti su ${ci.length * 5} €` };
  }
  if (k === "sabP") {
    const porz = (x) => ci.filter((p) => val(p, "piatto") === x).reduce((s, p) => s + (+p.modulo.porzioni || 1), 0);
    const conPiatto = ci.filter((p) => val(p, "piatto")).length;
    const primi = porz("primo"), secondi = porz("secondo");
    const senza = ci.length - conPiatto;
    return { cifre: [[ci.length, "a pranzo"], [primi, esc(nomePiatto("primo"))], [secondi, esc(nomePiatto("secondo"))]],
      nota: senza ? `${senza} ${senza === 1 ? "persona deve" : "persone devono"} ancora scegliere` : "Tutti hanno scelto ✓" };
  }
  if (k === "sabC") {
    const ospiti = ci.reduce((s, p) => s + (+val(p, "ospiti") || 0), 0);
    const coperti = ci.length + ospiti;
    // macchinate: auto e posti solo di chi c'è a cena
    const auto = ci.filter((p) => +val(p, "auto") > 0), posti = auto.reduce((s, p) => s + +val(p, "auto"), 0);
    const notaAuto = !auto.length ? "🚗 nessuna auto segnata"
      : `🚗 ${auto.length} auto, ${posti} posti` + (posti < coperti ? ` · <b>${coperti - posti === 1 ? "manca 1 posto" : `mancano ${coperti - posti} posti`}</b>` : " · posti sufficienti ✓");
    return { cifre: [[ci.length, "del corso"], ["+" + ospiti, "ospiti"], [coperti, "coperti"]], nota: `Prenota per ${coperti} persone 🎉<br>${notaAuto}` };
  }
  const ignoti = tutte.filter((p) => val(p, k) === undefined).length;
  return { cifre: [[ci.length, "a pranzo"], [ignoti, "da sentire"]], nota: "" };
}
const cifreHtml = ({ cifre, nota }) => `<div class="righe">${cifre.map(([n, e]) => `<div class="cifra"><div class="grande">${n}</div><div class="etic">${e}</div></div>`).join("")}</div>${nota ? `<div class="nota">${nota}</div>` : ""}`;

/* ---------- Disegno ---------- */
function disegna() {
  aggiornaFreccia();
  if (!S.utente) return disegnaAccesso();
  if (S.utente.vietato) return disegnaVietato();
  if (!S.classe) { document.body.classList.remove("largo"); $app.innerHTML = disegnaClassi(); return; }
  if (S.scheda === "tutti" && !largo.matches) S.scheda = "ven";
  document.body.classList.toggle("largo", largo.matches);
  const pasto = PASTI.find((x) => x.k === S.scheda);
  if (S.scheda !== "posti") S.tavoloScelto = null;
  const nomeClasse = S.classi.find((c) => c.id === S.classe)?.nome || "";
  $app.innerHTML = barra() + `<div class="contenuto"><div class="classe-barra"><button data-az="classi">‹ Classi</button><b>${esc(nomeClasse)}</b></div>${S.scheda === "tutti" ? disegnaTutti() : S.scheda === "mancano" ? disegnaMancano() : S.scheda === "auto" ? disegnaAuto() : S.scheda === "posti" ? disegnaPosti() : pasto ? disegnaPasto(pasto) : disegnaImpostazioni()}</div>`;
  if (S.scheda === "posti") adattaPianta();
}

function barra() {
  const nMancano = S.utente ? persone(true).filter((p) => mancanze(p).length).length : 0;
  const corto = { ven: "Ven", sabP: "Sab pr.", sabC: "Sab cena", dom: "Dom" };
  const voci = [["tutti", "📋", "Tutti i pasti"], ...PASTI.map((p) => [p.k, p.icona, largo.matches ? p.tab : corto[p.k]]),
    ["posti", "🪑", "Posti"],
    ["auto", "🚗", largo.matches ? "Macchinate" : "Auto"],
    ["mancano", "📝", (largo.matches ? "Da completare" : "Mancano") + (nMancano ? ` <em class="conta">${nMancano}</em>` : "")],
    ["imp", "🔗", largo.matches ? "Iscrizioni ed elenco" : "Iscrizioni"]];
  return `<nav class="barra">${largo.matches ? `<div class="marchio">🍕 Pasti del weekend</div>` : ""}
    ${voci.filter(([k]) => k !== "tutti" || largo.matches).map(([k, i, t]) => `<button data-scheda="${k}" class="${S.scheda === k ? "si" : ""}"><span>${i}</span>${t}</button>`).join("")}</nav>`;
}

function testata(titolo, sotto) {
  return `<header class="testata"><h1>${titolo}<small>${sotto}</small></h1>
    <button class="tondo ${S.carica ? "gira" : ""}" data-az="aggiorna" aria-label="Aggiorna">⟳</button></header>`;
}

function filtri(conPresenti = true) {
  const seg = (nome, voci) => `<div class="seg">${voci.map(([f, t]) => `<button data-${nome}="${f}" class="${S[nome] === f ? "si" : ""}">${t}</button>`).join("")}</div>`;
  return `<div class="filtri"><input type="search" placeholder="Cerca…" value="${esc(S.cerca)}" data-cerca>
    ${seg("gruppo", [["tutti", "Tutti"], ["staff", "Staff"], ["corsisti", "Corsisti"]])}
    ${seg("filtro", conPresenti ? [["tutti", "Tutti"], ["si", "Ci sono"], ["no", "Non ci sono"], ["ignoti", "? / Non compilato"]] : [["tutti", "Tutti"], ["vuoti", "Non compilato"]])}
    <div class="ordine"><span class="piccolo">Ordine</span>${seg("ordine", [["alfa", "A–Z"], ["stato", conPresenti ? "Per risposta" : "Per compilazione"]])}</div></div>`;
}

function avvisi(tutte) {
  const out = [];
  const vuoti = tutte.filter(vuoto);
  // cliccabile: mostra solo chi non ha compilato (di nuovo → tutti). Con pochi nomi li scrivo direttamente.
  if (vuoti.length) {
    const nomi = vuoti.length <= 5 ? ": " + vuoti.map((p) => esc(p.nome)).join(", ") : "";
    const attivo = S.filtro === "vuoti";
    out.push(`<button class="avviso cliccabile ${attivo ? "attivo" : ""}" data-filtro="${attivo ? "tutti" : "vuoti"}">📭 ${vuoti.length} ${vuoti.length === 1 ? "persona non ha" : "persone non hanno"} ancora compilato il modulo${nomi}
      <span>${attivo ? "Mostra tutti ›" : "Vedi chi ›"}</span></button>`);
  }
  if (!S.carica && !tutte.length && !S.imp.elenco?.length && !S.modulo)
    out.push(`<p class="avviso">Nessuna persona ancora: vai su <b>⚙️ Modulo ed elenco</b> e importa l'elenco dei partecipanti e il file delle risposte.</p>`);
  return out.join("");
}

/* ---------- Ordine dell'elenco ----------
   Sempre: prima i Corsisti, poi lo Staff (mai mescolati), ognuno in ordine alfabetico.
   "Per risposta": dentro ogni gruppo prima chi c'è, poi chi non c'è, poi senza risposta (sempre alfabetici).
   Nella vista "Tutti i pasti" (k = null) le categorie sono: hanno risposto / non hanno compilato. */
function sezioni(lista, k) {
  const out = [];
  const gruppi = S.gruppo === "tutti" ? ["corsisti", "staff"] : [S.gruppo];
  const stati = k
    ? [[(p) => val(p, k) === true, "✓ Ci sono"], [(p) => val(p, k) === false, "✗ Non ci sono"], [(p) => val(p, k) === undefined, "? Senza risposta"]]
    : [[(p) => !vuoto(p), "Hanno risposto"], [(p) => vuoto(p), "Non hanno compilato"]];
  for (const g of gruppi) {
    const ps = lista.filter((p) => (p.gruppo === "staff" ? "staff" : "corsisti") === g);
    if (!ps.length) continue;
    if (gruppi.length > 1) out.push({ titolo: g === "staff" ? "Staff" : "Corsisti", n: ps.length, livello: 1 });
    if (S.ordine !== "stato") { out.push(...ps); continue; }
    for (const [vale, titolo] of stati) {
      const sub = ps.filter(vale);
      if (sub.length) out.push({ titolo, n: sub.length, livello: 2 }, ...sub);
    }
  }
  return out;
}
const titoloSezione = (x) => `<span class="sez-${x.livello}">${x.titolo}</span> <span class="piccolo">${x.n}</span>`;

function filtra(tutte, k) {
  let lista = tutte;
  if (S.filtro === "si" && k) lista = lista.filter((p) => val(p, k) === true);
  if (S.filtro === "no" && k) lista = lista.filter((p) => val(p, k) === false);
  if (S.filtro === "ignoti" && k) lista = lista.filter((p) => val(p, k) === undefined);
  if (S.filtro === "vuoti") lista = lista.filter(vuoto);
  if (S.cerca) lista = lista.filter((p) => norma(p.nome).includes(norma(S.cerca)));
  return lista;
}

function disegnaPasto(pasto) {
  const k = pasto.k, tutte = persone();
  if (S.carica && !tutte.length) return testata(pasto.icona + " " + pasto.titolo, pasto.sotto) + `<p class="vuoto">Caricamento…</p>`;
  const lista = filtra(tutte, k);
  return testata(pasto.icona + " " + pasto.titolo, pasto.sotto) + `
    <section class="riepilogo">${cifreHtml(riepilogo(k, tutte))}</section>
    ${k === "sabC" ? `<button class="avviso cliccabile" data-scheda="auto">🚗 Dividi le persone nelle macchine <span>Macchinate ›</span></button>` : ""}
    ${avvisi(tutte)}${filtri()}
    <ul class="elenco pasto-${k}">${sezioni(lista, k).map((x) => x.titolo ? `<li class="sezione liv-${x.livello}">${titoloSezione(x)}</li>` : rigaPersona(x, k)).join("") || `<li class="piccolo">Nessuno qui.</li>`}</ul>
    <button class="aggiungi" data-az="nuova">＋ Aggiungi una persona</button>`;
}

/** Etichetta del gruppo: toccandola si passa da Staff a Corsista e viceversa */
const chipGruppo = (p) => `<button class="chip ${p.gruppo}" data-cambia-gruppo="${esc(p.id)}" title="Tocca per cambiare gruppo">${p.gruppo === "staff" ? "Staff" : "Corsista"}</button>`;

/** Sotto il nome: gruppo + da dove arrivano le risposte (documento, a mano, nessuna) */
function etichettaChi(p, campi) {
  const corrette = campi ? aMano(p, ...campi.filter((k) => k !== "gruppo" && k !== "pagato")) : false;
  const fonte = [];
  if (vuoto(p)) fonte.push(`<em class="vuota">non compilato</em>`);
  else if (p.soloMano) fonte.push(`<em class="f-mano">inserito a mano</em>`);
  else if (p.risposto) fonte.push(`<em class="f-doc" title="Risposte prese dal file del modulo">dal modulo</em>`);
  if (corrette && !p.soloMano) fonte.push(`<em class="f-mano">corretto a mano</em>`);
  if (p.risposto && (S.imp.modulo?.aggiornati || []).includes(p.id)) fonte.push(`<em class="f-nuovo" title="Risposte nuove o cambiate nell'ultimo file importato">aggiornato</em>`);
  return `<div class="chi"><button class="nome" data-scheda-persona="${esc(p.id)}"><b>${esc(p.nome)}</b></button>
    <span>${chipGruppo(p)} ${fonte.join(" ")}</span></div>`;
}

function cambiaGruppo(p, nuovo) {
  nuovo = nuovo || (p.gruppo === "staff" ? "corsisti" : "staff");
  // se torna al gruppo automatico, tolgo la scelta a mano
  return correggi(p, { gruppo: nuovo === (p.gruppoAuto || p.gruppo) && p.mano.gruppo !== undefined ? null : nuovo });
}

/** Selettore a tre pulsanti ✓ | ✗ | ?: un tocco sulla scelta giusta (la persona si sposta solo dopo) */
function tri(p, campo, etic) {
  const v = val(p, campo);
  const nomi = { ven: ["mangia", "non mangia"], pagato: ["ha pagato", "non ha pagato"] }[campo] || ["c'è", "non c'è"];
  return `<div class="tri">${etic ? `<span class="tri-etic">${etic}</span>` : ""}<div class="tri-b">${[[true, "✓", "si", nomi[0]], [false, "✗", "no", nomi[1]], ["?", "?", "boh", "non so"]].map(([x, ic, c, t]) =>
    `<button data-id="${esc(p.id)}" data-tri="${campo}" data-v="${x}" class="${c} ${(x === "?" ? v === undefined : v === x) ? "on" : ""}" title="${t}" aria-label="${t}">${ic}</button>`).join("")}</div></div>`;
}

/** Soldi: un solo pulsante «5 €», oro se li ha dati. Tocco = pagato ↔ non pagato */
const soldi = (p) => `<button class="soldi ${val(p, "pagato") === true ? "on" : ""}" data-id="${esc(p.id)}" data-soldi="1" title="${val(p, "pagato") === true ? "Ha dato i 5 € (tocca per annullare)" : "Tocca quando ti dà i 5 €"}">5 €</button>`;

/** Applica una scelta: uguale al modulo → tolgo la correzione; «?» su chi ha risposto → "ignoto" */
function applicaScelta(p, campo, v) {
  const dalModulo = p.modulo[campo], cambi = {};
  if (v === "?") cambi[campo] = dalModulo === undefined ? null : "ignoto";
  else cambi[campo] = v === dalModulo || (campo === "pagato" && v === false) ? null : v;
  if (campo === "pagato" && v === true && val(p, "ven") !== true) cambi.ven = true;   // chi paga, mangia
  return correggi(p, cambi);
}

function sceltaPiatto(p) {
  const c = val(p, "sabP") === true, pi = val(p, "piatto");
  return `<div class="scelta">${["primo", "secondo"].map((x) => `<button data-id="${esc(p.id)}" data-piatto="${x}" class="${pi === x ? "si" : ""}" ${c ? "" : "disabled"}>${esc(nomePiatto(x))}</button>`).join("")}</div>${+p.modulo.porzioni > 1 && pi ? `<span class="qta" title="porzioni">×${p.modulo.porzioni}</span>` : ""}`;
}
/** Macchinate: 🚗 = ha la macchina (si sblocca solo se c'è a cena), con i posti (guidatore compreso) */
function auto(p) {
  const c = val(p, "sabC") === true, n = +val(p, "auto") || 0, id = esc(p.id);
  if (!n) return `<button class="auto" data-id="${id}" data-auto="si" ${c ? "" : "disabled"} title="${c ? "Ha la macchina?" : "Prima segna che c'è a cena"}">🚗 <span>auto?</span></button>`;
  return `<div class="auto on ${c ? "" : "off"}"><button data-id="${id}" data-auto="no" title="Togli la macchina" ${c ? "" : "disabled"}>🚗</button>
    <button data-id="${id}" data-auto-posti="-1" aria-label="un posto in meno" ${c ? "" : "disabled"}>−</button><b>${n}</b><span>posti</span>
    <button data-id="${id}" data-auto-posti="1" aria-label="un posto in più" ${c ? "" : "disabled"}>+</button></div>`;
}

function contaOspiti(p) {
  const c = val(p, "sabC") === true, n = +val(p, "ospiti") || 0;
  return `<div class="contatore ${c ? "" : "off"}"><button data-id="${esc(p.id)}" data-ospiti="-1" aria-label="meno">−</button><b>+${n}</b><button data-id="${esc(p.id)}" data-ospiti="1" aria-label="più">+</button></div>`;
}
const CAMPI_PASTO = { ven: ["ven", "pagato"], sabP: ["sabP", "piatto"], sabC: ["sabC", "ospiti"], dom: ["dom"] };

function rigaPersona(p, k) {
  const extra = k === "ven" ? soldi(p) : k === "sabP" ? sceltaPiatto(p) : k === "sabC" ? contaOspiti(p) + auto(p) : "";
  return `<li class="${vuoto(p) ? "e-vuota" : ""}">${etichettaChi(p, CAMPI_PASTO[k])}<div class="controlli">${tri(p, k, k === "ven" ? "mangia" : "c'è")}${extra}</div></li>`;
}

/* ---------- Macchinate: dividere chi va a cena sabato tra le auto ----------
   Dati presi dalla cena di sabato: auto = chi c'è e ha posti (uno è del guidatore); da sistemare = chi c'è senza auto.
   Gli ospiti viaggiano con chi li porta (occupano posti nella stessa auto). Scelta salvata in dati.inAuto = id del guidatore.
   Non tutte le auto si usano (meno auto possibile): dati.autoUsata = false → il proprietario diventa passeggero. */
function macchinate() {
  const ci = persone(true).filter((p) => val(p, "sabC") === true);
  // posti che servono: la persona + i suoi ospiti, se vengono in auto con noi (dati.ospitiInAuto = false → vanno da soli)
  const posto = (p) => 1 + (p.mano.ospitiInAuto === false ? 0 : +val(p, "ospiti") || 0);
  const conAuto = ci.filter((p) => +val(p, "auto") > 0);
  const usata = (p) => p.mano.autoUsata !== false;
  const auto = conAuto.filter(usata).map((d) => ({ d, posti: +val(d, "auto"), occupati: posto(d), passeggeri: [] }));
  const ferme = conAuto.filter((p) => !usata(p));
  const perId = new Map(auto.map((a) => [a.d.id, a]));
  const daSistemare = [];
  for (const p of ci.filter((x) => !(+val(x, "auto") > 0) || !usata(x))) {
    const a = perId.get(p.mano.inAuto);
    if (a) { a.passeggeri.push(p); a.occupati += posto(p); } else daSistemare.push(p);
  }
  auto.forEach((a) => (a.liberi = a.posti - a.occupati));
  // quante auto bastano: le più grandi per prime, finché i posti coprono tutti
  const tot = ci.reduce((s, p) => s + posto(p), 0);
  let bastano = 0, somma = 0;
  for (const n of conAuto.map((p) => +val(p, "auto")).sort((a, b) => b - a)) { if (somma >= tot) break; somma += n; bastano++; }
  return { auto, ferme, daSistemare, posto, persone: tot, bastano: somma >= tot ? bastano : null };
}

/* Bollini: colore fisso per persona, nome breve (nome + iniziale del cognome se due hanno lo stesso nome) */
const COLORI_BOLLINO = ["#F5C542", "#5AA9F8", "#F28DB2", "#57D3A0", "#B39DFA", "#F7A35C", "#4DD0E1", "#EF6B6B", "#A3D65C", "#F9A8D4", "#C08457", "#94A3B8"];
function nomiBrevi(lista) {
  const primo = (p) => p.nome.trim().split(/\s+/)[0];
  const conta = {};
  lista.forEach((p) => { const k = norma(primo(p)); conta[k] = (conta[k] || 0) + 1; });
  return (p) => { const parti = p.nome.trim().split(/\s+/); return conta[norma(parti[0])] > 1 && parti[1] ? `${parti[0]} ${parti[1][0]}.` : parti[0]; };
}

function disegnaAuto() {
  const { auto, ferme, daSistemare, posto, persone: tot, bastano } = macchinate();
  const aCena = persone(true).filter((p) => val(p, "sabC") === true);
  const breve = nomiBrevi(aCena);
  // colori in ordine: tutti diversi finché la tavolozza basta
  const posizione = new Map(aCena.map((p, i) => [p.id, i]));
  const colore = (p) => COLORI_BOLLINO[(posizione.get(p.id) ?? 0) % COLORI_BOLLINO.length];
  const posti = auto.reduce((s, a) => s + a.posti, 0);
  const sel = S.bollinoScelto;
  // un bollino: pallino colorato, nome, posti che occupa (con gli ospiti); +N tocca = ospiti con noi / per conto loro
  const bollino = (p, inAuto = false) => {
    const n = +val(p, "ospiti") || 0, con = p.mano.ospitiInAuto !== false;
    return `<span class="bollino ${sel === p.id ? "scelto" : ""}" data-bollino="${esc(p.id)}" title="${esc(p.nome)}"><i style="background:${colore(p)}"></i>${esc(breve(p))}<b>${posto(p)}</b>${n
      ? `<button class="osp ${con ? "" : "via"}" data-ospiti-auto="${esc(p.id)}" title="${con ? "Ospiti in auto con noi (tocca se vanno per conto loro)" : "Ospiti per conto loro (tocca se vengono con noi)"}">+${n}</button>` : ""}${inAuto
      ? `<button class="via-auto" data-togli-auto="${esc(p.id)}" title="Togli dall'auto" aria-label="Togli ${esc(p.nome)} dall'auto">✕</button>` : ""}</span>`;
  };
  const stato = !auto.length && !ferme.length ? "Nessuna auto: segnale nella cena di sabato"
    : posti < tot ? `<span class="rosso">mancano ${tot - posti} posti</span>`
    : daSistemare.length ? `${daSistemare.length} da sistemare` : "tutti sistemati ✓";
  const sedili = (a) => Array.from({ length: Math.max(a.posti, a.occupati) }, (_, i) =>
    `<i class="${i < a.occupati ? (i < a.posti ? "pieno" : "troppo") : ""}"></i>`).join("");
  return testata("🚗 Macchinate", "Sabato sera · trascina i bollini nelle auto") + `
    <p class="mc-stato">${auto.length} auto · ${posti} posti · ${tot} persone · <b>${stato}</b>${bastano && auto.length > bastano ? ` · <span class="tenue">ne bastano ${bastano}</span>` : ""}</p>
    <section class="mc-pool" data-drop="pool">
      ${daSistemare.map((p) => bollino(p)).join("") || `<span class="tenue">${auto.length ? "Tutti hanno un posto" : "—"}</span>`}
      ${daSistemare.length && auto.length ? `<button class="mc-auto-btn" data-az="distribuisci">✨ automatico</button>` : ""}
    </section>
    <div class="mc-auto">${auto.map((a) => `<section class="mc-macchina ${a.liberi < 0 ? "troppa" : ""}" data-drop="${esc(a.d.id)}">
        <header><span class="mc-nome">🚗 ${esc(breve(a.d))}${+val(a.d, "ospiti") ? ` <small>+${val(a.d, "ospiti")}</small>` : ""}</span>
          <span class="mc-sedili">${sedili(a)}</span><span class="mc-liberi">${a.liberi < 0 ? `<span class="rosso">${-a.liberi} in più</span>` : a.liberi ? `${a.liberi} ${a.liberi === 1 ? "libero" : "liberi"}` : "piena"}</span>
          <button class="mc-lascia" data-auto-usata="no" data-id="${esc(a.d.id)}" title="Questa auto non la usiamo">non usarla</button></header>
        <div class="mc-dentro">${a.passeggeri.map((p) => bollino(p, true)).join("") || `<span class="tenue piccolo">trascina qui</span>`}</div>
      </section>`).join("")}</div>
    ${ferme.length ? `<p class="mc-ferme"><span class="tenue">Non usate:</span> ${ferme.map((d) => `<button data-auto-usata="si" data-id="${esc(d.id)}" title="Usa questa auto">🚗 ${esc(breve(d))} · ${+val(d, "auto")} <u>usa</u></button>`).join("")}</p>` : ""}`;
}

/* ---------- Trascinamento dei bollini (dito o mouse) ----------
   Si trascina un bollino su un'auto (o sulla zona in alto per toglierlo). Un tocco senza trascinare lo "sceglie":
   poi un tocco su un'auto ce lo mette (riserva per chi non riesce a trascinare). */
function spostaBollino(id, dove) {
  if (dove.startsWith("sedia:") || dove === "lista") return siedi(id, dove);
  const { auto, posto } = macchinate();
  const p = persone(true).find((x) => x.id === id);
  if (!p) return;
  if (dove === "pool") return correggi(p, { inAuto: null });
  const a = auto.find((x) => x.d.id === dove);
  if (!a || p.mano.inAuto === dove) return disegna();
  if (a.liberi < posto(p)) { avvisoBreve(`Nell'auto di ${a.d.nome.split(" ")[0]} non c'è posto`); return disegna(); }
  return correggi(p, { inAuto: dove });
}
function avvisoBreve(testo) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = testo;
  document.body.append(t); setTimeout(() => t.remove(), 2200);
}
let trascino = null;
/** Dove sto lasciando il bollino: la zona sotto il dito; nella piantina, se manco di poco, la sedia più vicina */
function zonaSotto(x, y) {
  const z = document.elementFromPoint(x, y)?.closest("[data-drop]");
  if (z || S.scheda !== "posti") return z;
  let migliore = null, dist = 46;   // circa un polpastrello
  for (const sd of $app.querySelectorAll(".sedia")) {
    const r = sd.getBoundingClientRect(), d = Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y);
    if (d < dist) { dist = d; migliore = sd; }
  }
  return migliore;
}
$app.addEventListener("pointerdown", (e) => {
  const b = e.target.closest("[data-bollino]");
  if (!b || e.target.closest("button")) return;
  trascino = { id: b.dataset.bollino, x: e.clientX, y: e.clientY, el: b, ombra: null };
  b.setPointerCapture(e.pointerId);
});
$app.addEventListener("pointermove", (e) => {
  if (!trascino) return;
  if (!trascino.ombra) {
    if (Math.hypot(e.clientX - trascino.x, e.clientY - trascino.y) < 6) return;
    trascino.ombra = trascino.el.cloneNode(true);
    trascino.ombra.classList.add("ombra");
    document.body.append(trascino.ombra);
    trascino.el.classList.add("in-viaggio");
  }
  trascino.ombra.style.left = e.clientX + "px"; trascino.ombra.style.top = e.clientY + "px";
  document.querySelectorAll(".sopra").forEach((x) => x.classList.remove("sopra"));
  trascino.ombra.hidden = true;
  const zona = zonaSotto(e.clientX, e.clientY);
  trascino.ombra.hidden = false;
  zona?.classList.add("sopra");
});
function fineTrascino(e, annulla) {
  if (!trascino) return;
  const t = trascino; trascino = null;
  document.querySelectorAll(".sopra").forEach((x) => x.classList.remove("sopra"));
  t.el.classList.remove("in-viaggio");
  if (!t.ombra) {   // tocco semplice
    if (annulla) return;
    if (t.el.closest(".sedia")) { S.bollinoScelto = null; return siedi(t.id, "lista"); }   // seduto: un clic lo alza
    S.bollinoScelto = S.bollinoScelto === t.id ? null : t.id; disegna();                  // altrimenti: lo scelgo
    return;
  }
  t.ombra.remove();
  if (annulla) return;
  const zona = zonaSotto(e.clientX, e.clientY);
  if (zona) { S.bollinoScelto = null; spostaBollino(t.id, zona.dataset.drop); }
}
$app.addEventListener("pointerup", (e) => fineTrascino(e, false));
$app.addEventListener("pointercancel", (e) => fineTrascino(e, true));
// riserva: bollino scelto + tocco su un'auto (o sulla zona in alto)
$app.addEventListener("click", (e) => {
  if (!S.bollinoScelto || e.target.closest("[data-bollino], button")) return;
  const zona = e.target.closest("[data-drop]");
  if (zona) { const id = S.bollinoScelto; S.bollinoScelto = null; spostaBollino(id, zona.dataset.drop); }
});

/** Riempie le auto con chi è da sistemare: prima chi occupa più posti, nell'auto con più posti liberi */
async function distribuisci() {
  const { auto, daSistemare, posto } = macchinate();
  // tutte le assegnazioni contano come UNA sola azione da annullare
  const prima = daSistemare.map((p) => [p.id, S.correzioni.get(p.id) ? structuredClone(S.correzioni.get(p.id)) : null]), classe = S.classe;
  ricorda("distribuzione automatica nelle auto", async () => { for (const [id, r] of prima) await ripristinaRiga(classe, id, r); });
  S.annullando = true;
  const coda = [...daSistemare].sort((a, b) => posto(b) - posto(a));
  let rimasti = 0;
  for (const p of coda) {
    const a = auto.filter((x) => x.liberi >= posto(p)).sort((x, y) => y.liberi - x.liberi)[0];
    if (!a) { rimasti++; continue; }
    a.liberi -= posto(p);
    await correggi(p, { inAuto: a.d.id });
  }
  S.annullando = false;
  if (rimasti) alert(`${rimasti} ${rimasti === 1 ? "persona non ha" : "persone non hanno"} trovato posto: serve un'altra auto.`);
}

/* ---------- Posti a tavola (sabato e domenica a pranzo) ----------
   Piantina vista dall'alto: tavoli rettangolari o tondi, da creare, spostare, ridimensionare, ruotare e unire.
   Le persone (chi c'è a quel pasto) si trascinano sulle sedie. Tutto in S.imp.posti[pasto] = { tavoli, sedute },
   tavolo = { id, n (numero), forma: "rett"|"tondo", x, y, w, h, posti }, sedute = { "idTavolo:indice": idPersona }. */
const PIANTA = { w: 1200, h: 760, g: 20 };
const PASTI_POSTI = [["sabP", "🍽️ Sab pranzo"], ["dom", "🍝 Dom pranzo"]];
const pastoPosti = () => (S.pastoPosti = S.pastoPosti || leggiLocale("pasti.posti") || "sabP");
function datiPosti(k = pastoPosti()) {
  S.imp.posti = S.imp.posti || {};
  return (S.imp.posti[k] = S.imp.posti[k] || { tavoli: [], sedute: {} });
}
const aGriglia = (v) => Math.round(v / PIANTA.g) * PIANTA.g;

/** Posizione delle sedie attorno al tavolo (coordinate relative al tavolo) */
function sedieDi(t) {
  const out = [], n = t.posti, d = 18;
  if (t.forma === "tondo") {
    const rx = t.w / 2 + d, ry = t.h / 2 + d;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; out.push({ x: t.w / 2 + rx * Math.cos(a), y: t.h / 2 + ry * Math.sin(a) }); }
    return out;
  }
  const orizz = t.w >= t.h, a = Math.ceil(n / 2), b = n - a;
  for (let i = 0; i < a; i++) out.push(orizz ? { x: (t.w * (i + 0.5)) / a, y: -d } : { x: -d, y: (t.h * (i + 0.5)) / a });
  for (let i = 0; i < b; i++) out.push(orizz ? { x: (t.w * (i + 0.5)) / b, y: t.h + d } : { x: t.w + d, y: (t.h * (i + 0.5)) / b });
  return out;
}

/** Due tavoli si toccano (bordi a contatto o sovrapposti)? */
const siToccano = (a, b) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

function disegnaPosti() {
  const k = pastoPosti(), P = datiPosti(k);
  const presenti = persone(true).filter((p) => val(p, k) === true);
  const perId = new Map(presenti.map((p) => [p.id, p]));
  const breve = nomiBrevi(presenti);
  const posizione = new Map(presenti.map((p, i) => [p.id, i]));
  const colore = (p) => COLORI_BOLLINO[(posizione.get(p.id) ?? 0) % COLORI_BOLLINO.length];
  // sedute valide: solo chi c'è a questo pasto e su sedie che esistono ancora
  const sedute = {};
  for (const [chiaveS, id] of Object.entries(P.sedute)) {
    const [tid, i] = chiaveS.split(":"); const t = P.tavoli.find((x) => x.id === tid);
    if (t && +i < t.posti && perId.has(id)) sedute[chiaveS] = id;
  }
  const seduti = new Set(Object.values(sedute));
  const sel = S.bollinoScelto;
  // colore per GRUPPO (staff / corsisti): sulla piantina si vede subito se si alternano
  const bollino = (p, piccolo = false) => `<span class="bollino g-${p.gruppo === "staff" ? "staff" : "corsisti"} ${piccolo ? "mini" : ""} ${sel === p.id ? "scelto" : ""}" data-bollino="${esc(p.id)}" title="${esc(p.nome)}">${esc(breve(p))}</span>`;
  const colonna = (g, titolo) => {
    const ps = presenti.filter((p) => (p.gruppo === "staff" ? "staff" : "corsisti") === g && !seduti.has(p.id));
    const tot = presenti.filter((p) => (p.gruppo === "staff" ? "staff" : "corsisti") === g).length;
    return `<div class="pl-col"><h3><i class="leg g-${g}"></i>${titolo} <span class="tenue">${ps.length}/${tot}</span></h3>${ps.map((p) => bollino(p)).join("") || `<span class="tenue piccolo">tutti seduti</span>`}</div>`;
  };
  const tSel = P.tavoli.find((t) => t.id === S.tavoloScelto);
  const vicini = tSel ? P.tavoli.filter((t) => t !== tSel && siToccano(t, tSel)) : [];
  const postiTot = P.tavoli.reduce((s, t) => s + t.posti, 0);
  const tavolo = (t) => {
    const occ = sedieDi(t).filter((_, i) => sedute[t.id + ":" + i]).length;
    return `<div class="tavolo ${t.forma} ${S.tavoloScelto === t.id ? "scelto" : ""}" data-tavolo="${t.id}" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px">
      <span class="t-etic">${t.n}<small>${occ}/${t.posti}</small></span>
      ${sedieDi(t).map((c, i) => { const id = sedute[t.id + ":" + i], p = id && perId.get(id);
        return `<div class="sedia ${p ? "piena" : ""}" data-drop="sedia:${t.id}:${i}" style="left:${c.x}px;top:${c.y}px" ${p ? `title="${esc(p.nome)} · clic per toglierlo, trascina per spostarlo"` : ""}>${p ? bollino(p, true) : ""}</div>`; }).join("")}
      ${S.tavoloScelto === t.id ? `<span class="t-ridim" data-ridim="${t.id}" title="Trascina per cambiare le dimensioni"></span>` : ""}
    </div>`;
  };
  return testata("🪑 Posti a tavola", "Piantina vista dall'alto · trascina le persone sulle sedie") + `
    <div class="seg pl-pasti">${PASTI_POSTI.map(([kk, t]) => `<button data-pasto-posti="${kk}" class="${kk === k ? "si" : ""}">${t}</button>`).join("")}</div>
    <p class="mc-stato">${presenti.length} a pranzo · ${seduti.size} seduti · ${P.tavoli.length} tavoli, ${postiTot} posti${postiTot < presenti.length ? ` · <span class="rosso">mancano ${presenti.length - postiTot} posti</span>` : ""}</p>
    <div class="pl">
      <aside class="pl-lista" data-drop="lista">${colonna("staff", "Staff")}${colonna("corsisti", "Corsisti")}</aside>
      <div class="pl-destra">
        <div class="pl-attrezzi">
          ${sel && seduti.has(sel) ? `<span><i class="pallino" style="background:${colore(perId.get(sel))}"></i><b>${esc(perId.get(sel).nome)}</b> <span class="tenue">· trascinala su un'altra sedia oppure</span></span>
            <button data-togli-posto="${esc(sel)}">✕ togli dal posto</button><button data-t-az="annulla-scelta" class="tenue">annulla</button>`
          : tSel ? `<b>Tavolo ${tSel.n}</b>
            <span class="pl-num"><button data-t-posti="-1" aria-label="un posto in meno">−</button>${tSel.posti} posti<button data-t-posti="1" aria-label="un posto in più">+</button></span>
            ${tSel.forma === "rett" ? `<button data-t-az="ruota" title="Ruota">↻<span class="lungo"> ruota</span></button>` : ""}
            <button data-t-az="forma" title="Cambia forma">${tSel.forma === "rett" ? "◯<span class=\"lungo\"> tondo</span>" : "▭<span class=\"lungo\"> rettangolare</span>"}</button>
            ${vicini.length && tSel.forma === "rett" ? `<button data-t-az="unisci" title="Unisci ai tavoli che tocca" class="evidenza">⧉ unisci<span class="lungo"> (${vicini.length})</span></button>` : ""}
            <button data-t-az="svuota" title="Fai alzare tutti">🧹<span class="lungo"> svuota</span></button>
            <button data-t-az="elimina" class="rosso" title="Elimina il tavolo">🗑<span class="lungo"> elimina</span></button>
            <button data-t-az="chiudi" title="Fatto">✓<span class="lungo"> fatto</span></button>`
          : `<button data-t-az="nuovo-rett">＋ Tavolo</button><button data-t-az="nuovo-tondo">＋ Tondo</button>
             <span class="tenue piccolo lungo">Tocca un tavolo per modificarlo · avvicina due tavoli e «unisci» per una tavolata</span>`}
        </div>
        <div class="pianta"><div class="pianta-dim"><div class="pianta-in" style="width:${PIANTA.w}px;height:${PIANTA.h}px">
          ${P.tavoli.map(tavolo).join("") || `<p class="pl-vuota">Nessun tavolo: crea il primo con «＋ Tavolo»</p>`}
        </div></div></div>
      </div>
    </div>`;
}

/** La piantina ha dimensioni fisse: la rimpicciolisco per farla stare nello spazio disponibile */
function adattaPianta() {
  const box = $app.querySelector(".pianta"), dim = box?.querySelector(".pianta-dim"), dentro = box?.querySelector(".pianta-in");
  if (!box) return;
  // Schermo grande: tutta la sala. Telefono: solo la zona dove ci sono i tavoli (più grande e leggibile);
  // non sotto il 45%: oltre, la piantina si scorre di lato invece di diventare illeggibile.
  // Schermo grande: tutta la sala. Telefono: solo la zona dove ci sono i tavoli (più grande e leggibile);
  // non sotto il 45%: oltre, la piantina si scorre di lato invece di diventare illeggibile.
  let w = PIANTA.w, h = PIANTA.h;
  if (box.clientWidth < 700) {
    const T = datiPosti().tavoli;
    w = Math.min(PIANTA.w, Math.max(480, ...T.map((t) => t.x + t.w + 60)));
    h = Math.min(PIANTA.h, Math.max(360, ...T.map((t) => t.y + t.h + 60)));
  }
  const scala = Math.min(1, Math.max(0.45, box.clientWidth / w));
  dentro.style.transform = `scale(${scala})`;
  Object.assign(dim.style, { width: w * scala + "px", height: h * scala + "px" });
  S.scalaPianta = scala;
}

function salvaPosti(testo = "modifica dei posti") { disegna(); salvaImp(testo); }

/** Siede una persona (o la riporta nella lista). Sedia occupata → scambio di posto. */
function siedi(id, dove) {
  const P = datiPosti();
  const prima = Object.keys(P.sedute).find((k) => P.sedute[k] === id);
  if (prima) delete P.sedute[prima];
  if (dove.startsWith("sedia:")) {
    const chiaveS = dove.slice(6), altro = P.sedute[chiaveS];
    if (altro && prima) P.sedute[prima] = altro;   // scambio
    P.sedute[chiaveS] = id;
  }
  salvaPosti(dove === "lista" ? "persona tolta dal posto" : "persona messa a sedere");
}

function nuovoTavolo(forma) {
  const P = datiPosti();
  const n = Math.max(0, ...P.tavoli.map((t) => t.n)) + 1;
  const [w, h] = forma === "tondo" ? [180, 180] : [260, 80];   // sedie distanziate: i nomi non si sovrappongono
  // primo spazio libero, da sinistra a destra e dall'alto in basso
  let x = 60, y = 60;
  const libero = (x, y) => !P.tavoli.some((t) => siToccano({ x: x - 40, y: y - 40, w: w + 80, h: h + 80 }, t));
  cerca: for (y = 60; y < PIANTA.h - h; y += 40) for (x = 60; x < PIANTA.w - w; x += 40) if (libero(x, y)) break cerca;
  const t = { id: "t" + Date.now().toString(36), n, forma, x, y, w, h, posti: 6 };
  P.tavoli.push(t); S.tavoloScelto = t.id; salvaPosti("nuovo tavolo");
}

function azioneTavolo(az) {
  const P = datiPosti(), t = P.tavoli.find((x) => x.id === S.tavoloScelto);
  if (az === "nuovo-rett") return nuovoTavolo("rett");
  if (az === "nuovo-tondo") return nuovoTavolo("tondo");
  if (!t) return;
  const libera = (tid) => Object.keys(P.sedute).forEach((k) => k.startsWith(tid + ":") && delete P.sedute[k]);
  if (az === "chiudi") { S.tavoloScelto = null; return disegna(); }
  const testoAz = { ruota: "rotazione del tavolo", forma: "forma del tavolo", svuota: "tavolo svuotato", elimina: "tavolo eliminato", unisci: "tavoli uniti" }[az] || "modifica del tavolo";
  if (az === "ruota") { [t.w, t.h] = [t.h, t.w]; }
  if (az === "forma") { t.forma = t.forma === "rett" ? "tondo" : "rett"; if (t.forma === "tondo") t.w = t.h = Math.max(t.w, t.h, 100); }
  if (az === "svuota") libera(t.id);
  if (az === "elimina") { if (!confirm(`Eliminare il tavolo ${t.n}? Chi è seduto torna nella lista.`)) return; libera(t.id); P.tavoli = P.tavoli.filter((x) => x !== t); S.tavoloScelto = null; }
  if (az === "unisci") {
    // tavolata: un unico rettangolo che copre i tavoli che si toccano; le persone restano sedute nell'ordine
    const gruppo = [t, ...P.tavoli.filter((x) => x !== t && x.forma === "rett" && siToccano(x, t))];
    const chi = gruppo.flatMap((g) => Array.from({ length: g.posti }, (_, i) => P.sedute[g.id + ":" + i]).filter(Boolean));
    gruppo.forEach((g) => libera(g.id));
    const x = Math.min(...gruppo.map((g) => g.x)), y = Math.min(...gruppo.map((g) => g.y));
    t.w = Math.max(...gruppo.map((g) => g.x + g.w)) - x; t.h = Math.max(...gruppo.map((g) => g.y + g.h)) - y; t.x = x; t.y = y;
    t.posti = gruppo.reduce((s, g) => s + g.posti, 0);
    P.tavoli = P.tavoli.filter((g) => g === t || !gruppo.includes(g));
    chi.forEach((id, i) => (P.sedute[t.id + ":" + i] = id));
  }
  salvaPosti(testoAz);
}

// trascinamento dei tavoli (sposta) e dell'angolo (ridimensiona)
let muovoTavolo = null;
$app.addEventListener("pointerdown", (e) => {
  if (S.scheda !== "posti" || e.target.closest("[data-bollino], button, .sedia")) return;
  const r = e.target.closest("[data-ridim]"), el = e.target.closest("[data-tavolo]");
  if (!el) return;
  const t = datiPosti().tavoli.find((x) => x.id === el.dataset.tavolo);
  muovoTavolo = { t, el, modo: r ? "ridim" : "sposta", x: e.clientX, y: e.clientY, o: { ...t }, mosso: false };
  el.setPointerCapture(e.pointerId);
  e.preventDefault();
});
$app.addEventListener("pointermove", (e) => {
  if (!muovoTavolo) return;
  const m = muovoTavolo, s = S.scalaPianta || 1, dx = (e.clientX - m.x) / s, dy = (e.clientY - m.y) / s;
  if (!m.mosso && Math.hypot(dx, dy) < 4) return;
  m.mosso = true;
  if (m.modo === "sposta") {
    m.t.x = Math.max(0, Math.min(PIANTA.w - m.t.w, aGriglia(m.o.x + dx)));
    m.t.y = Math.max(0, Math.min(PIANTA.h - m.t.h, aGriglia(m.o.y + dy)));
  } else {
    m.t.w = Math.max(60, aGriglia(m.o.w + dx)); m.t.h = Math.max(60, aGriglia(m.o.h + dy));
    if (m.t.forma === "tondo") m.t.h = m.t.w;
  }
  Object.assign(m.el.style, { left: m.t.x + "px", top: m.t.y + "px", width: m.t.w + "px", height: m.t.h + "px" });
});
$app.addEventListener("pointerup", () => {
  if (!muovoTavolo) return;
  const m = muovoTavolo; muovoTavolo = null;
  if (m.mosso) return salvaPosti(m.modo === "sposta" ? "spostamento del tavolo" : "dimensioni del tavolo");
  S.tavoloScelto = S.tavoloScelto === m.t.id ? null : m.t.id; disegna();   // tocco = scelgo il tavolo
});

/* ---------- Da completare: chi ha almeno un dato mancante, e quale ---------- */
const MANCANZE = [
  ["ven", "🍕 Venerdì", (p) => val(p, "ven") === undefined],
  ["pagato", "💶 5 €", (p) => val(p, "ven") === true && val(p, "pagato") !== true],
  ["sabP", "🍽️ Sab pranzo", (p) => val(p, "sabP") === undefined],
  ["piatto", "🍝 Piatto", (p) => val(p, "sabP") === true && !val(p, "piatto")],
  ["sabC", "🎉 Sab cena", (p) => val(p, "sabC") === undefined],
  ["dom", "🍝 Domenica", (p) => val(p, "dom") === undefined],
];
const mancanze = (p) => MANCANZE.filter(([, , manca]) => manca(p));

function disegnaMancano() {
  const tutte = persone();
  const filtroM = S.filtroMancano || "tutto";
  let lista = tutte.filter((p) => mancanze(p).some(([k]) => filtroM === "tutto" || k === filtroM || (filtroM === "sabP" && k === "piatto")));
  if (S.cerca) lista = lista.filter((p) => norma(p.nome).includes(norma(S.cerca)));
  const conta = (k) => tutte.filter((p) => mancanze(p).some(([m]) => m === k || (k === "sabP" && m === "piatto"))).length;
  const voci = [["tutto", "Tutto", tutte.filter((p) => mancanze(p).length).length], ["ven", "Venerdì", conta("ven")], ["pagato", "5 €", conta("pagato")],
    ["sabP", "Sab pranzo", conta("sabP")], ["sabC", "Sab cena", conta("sabC")], ["dom", "Domenica", conta("dom")]];
  const seg = `<div class="seg scorre">${voci.map(([f, t, n]) => `<button data-filtro-mancano="${f}" class="${filtroM === f ? "si" : ""}">${t} <span class="piccolo">${n}</span></button>`).join("")}</div>`;
  const gruppi = S.gruppo === "tutti" ? ["corsisti", "staff"] : [S.gruppo];
  let righe = "";
  for (const g of gruppi) {
    const ps = lista.filter((p) => (p.gruppo === "staff" ? "staff" : "corsisti") === g);
    if (!ps.length) continue;
    if (gruppi.length > 1) righe += `<li class="sezione liv-1">${titoloSezione({ titolo: g === "staff" ? "Staff" : "Corsisti", n: ps.length, livello: 1 })}</li>`;
    righe += ps.map((p) => `<li class="riga-m">${etichettaChi(p)}<div class="manca">${mancanze(p).map(([k, t]) =>
      k === "pagato" ? soldi(p) : `<div class="voce-m"><span>${t}</span>${k === "piatto" ? sceltaPiatto(p) : tri(p, k)}</div>`).join("")}</div></li>`).join("");
  }
  return testata("📝 Da completare", lista.length ? `${lista.length} ${lista.length === 1 ? "persona ha" : "persone hanno"} dati mancanti · scegli direttamente la risposta` : "Nessun dato mancante") + `
    <div class="filtri"><input type="search" placeholder="Cerca…" value="${esc(S.cerca)}" data-cerca>
      <div class="seg">${[["tutti", "Tutti"], ["staff", "Staff"], ["corsisti", "Corsisti"]].map(([f, t]) => `<button data-gruppo="${f}" class="${S.gruppo === f ? "si" : ""}">${t}</button>`).join("")}</div>
      ${seg}</div>
    <ul class="elenco mancano">${righe || `<li class="vuoto">Tutto completo 🎉</li>`}</ul>`;
}

/* Vista larga: tutti i pasti insieme */
function disegnaTutti() {
  const tutte = persone();
  const lista = filtra(tutte, null);
  const risposte = tutte.filter((p) => p.risposto).length;
  return testata("📋 Tutti i pasti", `${tutte.length} persone · ${risposte} hanno risposto al modulo`) + `
    <div class="quattro">${PASTI.map((p) => `<button class="riepilogo mini" data-scheda="${p.k}"><div class="titoletto">${p.icona} ${p.titolo}</div>${cifreHtml(riepilogo(p.k, tutte))}</button>`).join("")}</div>
    ${avvisi(tutte)}${filtri(false)}
    ${S.carica && !tutte.length ? `<p class="vuoto">Caricamento…</p>` : `
    <div class="tabella-box"><table class="tabella"><thead><tr><th>Persona</th>${PASTI.map((p) => `<th>${p.icona} ${p.tab}</th>`).join("")}</tr></thead>
    <tbody>${sezioni(lista, null).map((p) => p.titolo ? `<tr class="sezione liv-${p.livello}"><td colspan="5">${titoloSezione(p)}</td></tr>` : `<tr class="${vuoto(p) ? "e-vuota" : ""}"><td>${etichettaChi(p, Object.values(CAMPI_PASTO).flat())}</td>
      <td><div class="cella col">${tri(p, "ven", "mangia")}${soldi(p)}</div></td>
      <td><div class="cella col">${tri(p, "sabP")}${sceltaPiatto(p)}</div></td>
      <td><div class="cella col">${tri(p, "sabC")}<div class="cella">${contaOspiti(p)}${auto(p)}</div></div></td>
      <td><div class="cella">${tri(p, "dom")}</div></td></tr>`).join("") || `<tr><td colspan="5" class="piccolo">Nessuno qui.</td></tr>`}</tbody></table></div>`}
    <button class="aggiungi" data-az="nuova">＋ Aggiungi una persona</button>`;
}

function disegnaImpostazioni() {
  const m = S.modulo, imp = S.imp.modulo, elenco = S.imp.elenco || [];
  const quando = imp?.quando ? new Date(imp.quando).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const stato = m ? `<p class="stato ok">✓ ${m.righe.length} risposte · «${esc(imp.file || "file")}» importato ${quando}</p>` : `<p class="stato">Nessun file importato.</p>`;
  const mappa = m ? `<details ${m.mappa.nome ? "" : "open"}><summary class="piccolo">Quale domanda è quale? (riconosciute da sole, correggi se serve)</summary>
    <div class="mappa">${CAMPI.map((c) => `<span>${c.etic}</span><select data-mappa="${c.k}">
      <option value="">— nessuna —</option>${m.intest.map((h) => `<option ${m.mappa[c.k] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select>`).join("")}</div></details>` : "";
  const nStaff = elenco.filter((e) => e.gruppo === "staff").length;
  const C = confIscrizioni();
  const link = (g) => {
    const L = C.link[g], url = linkIscrizione(g), n = (S.iscrizioni || []).filter((r) => r.gruppo === g).length;
    return `<div class="link-card ${L.aperto === false ? "chiuso" : ""}">
      <div class="link-testa"><b>${g === "staff" ? "👔 Staff" : "🎓 Corsisti"}</b><span class="piccolo">${n} ${n === 1 ? "iscritto" : "iscritti"}</span>
        <button class="interr ${L.aperto === false ? "" : "on"}" data-link-aperto="${g}">${L.aperto === false ? "🔒 Chiuso" : "🟢 Aperto"}</button></div>
      <input type="text" readonly value="${esc(url)}" data-seleziona>
      <div class="azioni"><button class="pulsante" data-copia-link="${g}">📋 Copia link</button><a class="pulsante sec" href="${esc(url)}" target="_blank" rel="noopener">Apri ↗</a>
        <button class="pulsante sec" data-rigenera-link="${g}" title="Crea un link nuovo: quello vecchio smette di funzionare">↻ Nuovo link</button></div></div>`;
  };
  const pasto = (k, titolo) => {
    const P = C.pasti[k] || {};
    return `<div class="mod-pasto ${P.attivo === false ? "spento" : ""}">
      <label class="interruttore"><input type="checkbox" data-mod-attivo="${k}" ${P.attivo === false ? "" : "checked"}><span>${titolo}</span></label>
      <input type="text" data-mod-nota="${k}" value="${esc(P.nota || "")}" placeholder="Nota (es. quota, orario, luogo)">
      ${k === "sabP" ? `<div class="piatti"><input type="text" data-piatto-nome="primo" value="${esc(nomePiatto("primo"))}" aria-label="Primo piatto" placeholder="Primo"><input type="text" data-piatto-nome="secondo" value="${esc(nomePiatto("secondo"))}" aria-label="Secondo piatto" placeholder="Secondo"></div>` : ""}
      ${k === "sabC" ? `<label class="interruttore piccolo"><input type="checkbox" data-mod-ospiti ${P.ospiti === false ? "" : "checked"}><span>Chiedi se porta ospiti</span></label>
        <label class="interruttore piccolo"><input type="checkbox" data-mod-auto ${C.chiediAuto === false ? "" : "checked"}><span>Chiedi se viene in macchina e quanti posti ha</span></label>` : ""}
    </div>`;
  };
  const risposte = [...(S.iscrizioni || [])].sort((a, b) => b.aggiornata_il.localeCompare(a.aggiornata_il));
  const breve = (r) => [["ven", "Ven"], ["sabP", "Sab pr."], ["sabC", "Sab cena"], ["dom", "Dom"]].filter(([k]) => typeof r.risposte[k] === "boolean")
    .map(([k, t]) => `<span class="${r.risposte[k] ? "si" : "no"}">${t}${k === "sabP" && r.risposte.piatto ? " · " + esc(nomePiatto(r.risposte.piatto)) : ""}${k === "sabC" && r.risposte.ospiti ? " +" + r.risposte.ospiti : ""}${k === "sabC" && r.risposte.auto ? " 🚗" + r.risposte.auto : ""}</span>`).join("");
  return testata("🔗 Iscrizioni", "I link per iscriversi, il modulo e le risposte") + `<div class="due">
    <section class="scheda"><h2>I link di iscrizione</h2>
      <p>Manda il link giusto a ciascun gruppo: chi lo apre si iscrive dal telefono, senza account. Le risposte arrivano subito qui e in tutte le schermate.</p>
      ${link("corsisti")}${link("staff")}</section>
    <section class="scheda"><h2>Il modulo</h2>
      <label class="campo">Titolo</label><input type="text" data-mod-titolo value="${esc(C.titolo || "")}" placeholder="Iscrizione ai pasti">
      <label class="campo">Messaggio iniziale</label><textarea data-mod-testo rows="3" placeholder="Es. Ciao! Dicci a quali pasti ci sarai entro giovedì.">${esc(C.testo || "")}</textarea>
      <label class="campo">Pasti da chiedere</label>
      ${pasto("ven", "🍕 Apericena del venerdì")}${pasto("sabP", "🍽️ Pranzo del sabato")}${pasto("sabC", "🎉 Cena del sabato")}${pasto("dom", "🍝 Pranzo della domenica")}
      <p class="piccolo">Le modifiche valgono subito per entrambi i link. <a href="${esc(linkIscrizione("corsisti"))}" target="_blank" rel="noopener">Vedi l'anteprima ↗</a></p></section>
    <section class="scheda risposte-iscr"><h2>Risposte arrivate <span class="tenue">${risposte.length}</span></h2>
      ${risposte.map((r) => `<div class="risp"><div><b>${esc(r.nome)}</b> <span class="piccolo">${r.gruppo === "staff" ? "Staff" : "Corsista"} · ${new Date(r.aggiornata_il).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        <div class="risp-pasti">${breve(r)}</div></div><button class="cestino" data-elimina-iscr="${esc(r.id)}" title="Elimina questa risposta" aria-label="Elimina la risposta di ${esc(r.nome)}">🗑</button></div>`).join("")
        || `<p class="tenue">Ancora nessuna. Manda i link!</p>`}</section>
    <section class="scheda"><h2>Elenco dei corsisti</h2>
      <p>${elenco.length ? `<b>${elenco.length} persone</b>: ${nStaff} staff, ${elenco.length - nStaff} corsisti.` : "Ancora vuoto."}
      Serve a sapere chi <i>dovrebbe</i> iscriversi: chi è in elenco e non si iscrive appare come «non ha compilato». Il gruppo di chi si iscrive lo decide il link usato.</p>
      <p>Incolla un nome per riga (anche copiando le colonne da Excel o Fogli) oppure scegli un file. Puoi mettere in elenco anche qualcuno dello staff scrivendo «staff» sulla riga.</p>
      <textarea data-elenco rows="7" placeholder="Anna Bianchi&#10;Luca Verdi&#10;Giulia Neri&#10;…"></textarea>
      <label class="pulsante sec file">📄 Oppure scegli un file (Excel, CSV, testo)<input type="file" accept=".xlsx,.xls,.ods,.csv,.txt,.tsv" data-file-elenco hidden></label>
      <div class="azioni"><button class="pulsante" data-az="elenco-aggiungi">Aggiungi all'elenco</button>
      ${elenco.length ? `<button class="pulsante sec" data-az="elenco-sostituisci">Sostituisci tutto</button>` : ""}</div>
      ${elenco.length ? `<details><summary class="piccolo">Vedi l'elenco</summary>${elenco.slice().sort((a, b) => a.nome.localeCompare(b.nome, "it")).map((e) => `<div class="org">${esc(e.nome)} <span class="piccolo">${GRUPPI[e.gruppo]}</span><button data-togli-elenco="${esc(chiave(e.nome))}">Togli</button></div>`).join("")}</details>` : ""}
    </section>
    ${sezioneGruppi()}
    <section class="scheda"><h2>Organizzatori</h2><p>Solo queste persone possono vedere e modificare i dati. Per aggiungerne una: prima crea lei l'account dall'app, poi scrivi qui la sua email.</p>
      ${S.organizzatori.map((e) => `<div class="org">${esc(e)}${e === S.utente.email ? " <span class='piccolo'>(tu)</span>" : `<button data-togli-org="${esc(e)}">Togli</button>`}</div>`).join("")}
      <input type="email" placeholder="email di un altro organizzatore" data-nuovo-org style="margin-top:8px">
      <button class="pulsante sec" data-az="aggiungi-org">Aggiungi</button>
      <p class="piccolo">Entrato come ${esc(S.utente.email)} · <a href="#" data-az="esci">Esci</a></p></section>
    <section class="scheda vecchio"><details><summary><b>Importa da un file (vecchio metodo, Google Moduli)</b></summary>
      <p><b>Scarica le risposte</b> in uno di questi modi:<br>
      • dal Foglio delle risposte: <b>File → Scarica → Microsoft Excel (.xlsx)</b><br>
      • dal Modulo: <b>Risposte → ⋮ → Scarica risposte (.csv)</b> (arriva in uno .zip: aprilo con un doppio clic)</p>
      <label class="pulsante largo file">📥 Importa il file delle risposte<input type="file" accept=".xlsx,.xls,.ods,.csv,.txt,.tsv" data-file-risposte hidden></label>
      ${stato}
      <p>Quando arrivano nuove risposte, scarica e importa di nuovo: il file nuovo sostituisce il vecchio, le spunte fatte a mano restano.
      Le risposte si abbinano all'elenco <b>per nome</b> (maiuscole, accenti e ordine nome/cognome non contano).</p>
      ${mappa}
      <p class="piccolo">🔒 Il file viene letto qui sul tuo dispositivo e salvato su Supabase, visibile solo agli organizzatori. Colonne come email, telefono, allergie e note <b>non vengono salvate</b>.
      I colori di Excel non contano: il gruppo (staff/corsista) lo decide l'elenco.</p>
    </details></section>
</div>`;
}

/* ---------- Il modulo di iscrizione (configurazione nelle impostazioni della classe) ---------- */
const nuovaChiave = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), (x) => (x % 36).toString(36)).join("");
function confIscrizioni() {
  const C = (S.imp.iscrizioni = S.imp.iscrizioni || {});
  C.link = C.link || {};
  let nuove = false;
  for (const g of ["staff", "corsisti"]) if (!C.link[g]?.chiave) { C.link[g] = { chiave: nuovaChiave(), aperto: true }; nuove = true; }
  C.pasti = C.pasti || { ven: { attivo: true }, sabP: { attivo: true }, sabC: { attivo: true, ospiti: true }, dom: { attivo: true } };
  // link creati la prima volta: li salvo subito (non è un'azione da annullare)
  if (nuove && !DEMO) setTimeout(() => { S.impSalvato = structuredClone(S.imp); scriviImp(); }, 0);
  return C;
}
const linkIscrizione = (g) => new URL("iscrizione.html?k=" + (S.imp.iscrizioni?.link?.[g]?.chiave || ""), location.href).href;

/** Una risposta del modulo → i valori dei pasti (come quelli letti dal vecchio file) */
function valoriIscrizione(r) {
  const x = r.risposte || {}, v = {};
  for (const k of ["ven", "sabP", "sabC", "dom"]) if (typeof x[k] === "boolean") v[k] = x[k];
  if (v.sabP && (x.piatto === "primo" || x.piatto === "secondo")) v.piatto = x.piatto;
  if (v.sabC && +x.ospiti > 0) v.ospiti = +x.ospiti;
  if (v.sabC && +x.auto > 1) v.auto = +x.auto;
  return v;
}

/* Tutte le persone con il loro gruppo, da cambiare a mano */
function sezioneGruppi() {
  const tutte = persone(true);
  if (!tutte.length && !persone(true, true).length) return "";
  const q = norma(S.cercaGruppi || "");
  const riga = (p) => `<div class="riga-g"><span><b>${esc(p.nome)}</b> <span class="piccolo">${p.mano.gruppo !== undefined ? "scelto a mano" : p.inElenco ? "in elenco" : "dal modulo, non in elenco"}</span></span>
    <div class="destra"><div class="seg">${[["corsisti", "Corsista"], ["staff", "Staff"]].map(([g, t]) => `<button data-metti-gruppo="${g}" data-id="${esc(p.id)}" class="${p.gruppo === g ? "si" : ""}">${t}</button>`).join("")}</div>
    <button class="cestino" data-elimina="${esc(p.id)}" aria-label="Elimina ${esc(p.nome)}" title="Elimina">🗑</button></div></div>`;
  const via = persone(true, true);
  const nStaff = tutte.filter((p) => p.gruppo === "staff").length;
  return `<section class="scheda gruppi"><h2>Gruppi: chi è staff e chi è corsista</h2>
    <p>${nStaff} staff · ${tutte.length - nStaff} corsisti. Il gruppo è deciso in automatico; qui puoi cambiarlo a mano (anche toccando l'etichetta accanto a ogni nome).</p>
    <input type="search" placeholder="Cerca un nome…" value="${esc(S.cercaGruppi || "")}" data-cerca-gruppi>
    <div class="griglia-g">${tutte.filter((p) => !q || norma(p.nome).includes(q)).map(riga).join("")}</div>
    ${via.length ? `<details class="eliminate"><summary class="piccolo">🗑 Persone eliminate (${via.length})</summary>
      ${via.map((p) => `<div class="org">${esc(p.nome)} <span class="piccolo">${GRUPPI[p.gruppo] || ""}</span><button data-ripristina="${esc(p.id)}">Ripristina</button></div>`).join("")}</details>` : ""}</section>`;
}

function disegnaAccesso(msg = "") {
  $app.innerHTML = `<div class="contenuto stretto"><header class="testata"><h1>🍕 Pasti del weekend<small>Organizzazione dei pasti del corso</small></h1></header>
    <section class="scheda"><h2>Entra</h2>
      <label class="campo">Email</label><input type="email" id="email" autocomplete="username">
      <label class="campo">Password</label><input type="password" id="password" autocomplete="current-password">
      <button class="pulsante largo" data-az="entra">Entra</button>
      <button class="pulsante sec largo" data-az="registrati">Crea un account</button>
      ${msg ? `<p class="stato err">${esc(msg)}</p>` : ""}
      <p>Usa lo stesso account di Annona e Le mie routine.</p></section></div>`;
}

function disegnaVietato() {
  $app.innerHTML = `<div class="contenuto stretto"><header class="testata"><h1>🍕 Pasti del weekend</h1></header>
    <section class="scheda"><h2>Quasi fatto</h2><p>Sei entrato come <b>${esc(S.utente.email)}</b>, ma non sei ancora tra gli organizzatori.
    Il tuo account c'è già: ora chiedi a chi organizza di aggiungere la tua email in ⚙️ → Organizzatori, poi ricarica.</p>
    <button class="pulsante" data-az="ricarica">Ricarica</button> <button class="pulsante sec" data-az="esci">Esci</button></section></div>`;
}

/* ---------- Foglio persona (tutti i pasti, rinomina, gruppo, torna al modulo) ---------- */
function apriPersona(id) {
  const p = persone(true).find((x) => x.id === id);
  const nuova = !p;
  const q = p || { id: "", nome: "", gruppo: "corsisti", modulo: {}, mano: {}, soloMano: true };
  const riga = (campo, etic, conBoh = true) => {
    const v = val(q, campo);
    return `<div class="riga-f"><span>${etic}${q.modulo[campo] !== undefined ? ` <span class="piccolo">(modulo: ${q.modulo[campo] ? "sì" : "no"})</span>` : ""}</span>
      <div class="seg">${[[true, "Sì"], [false, "No"], ...(conBoh ? [["?", "?"]] : [])].map(([x, t]) => `<button data-f-campo="${campo}" data-f-val="${x}" class="${(x === "?" ? v === undefined : conBoh ? v === x : (v === true) === x) ? "si" : ""}">${t}</button>`).join("")}</div></div>`;
  };
  $foglio.innerHTML = `<div class="dentro"><h2>${nuova ? "Nuova persona" : esc(q.nome)}</h2>
    ${nuova ? "" : `<p class="piccolo">${vuoto(q) ? "Non ha ancora compilato il modulo" : !q.inElenco ? "Ha risposto ma non è nell'elenco corsisti" : q.risposto ? "Ha risposto al modulo" : "Aggiunto a mano"}${Object.keys(q.mano).length ? " · alcune risposte sono corrette a mano" : ""}</p>`}
    ${q.scritto?.size ? `<p class="piccolo">Nel modulo ha scritto: ${[...q.scritto].map((n) => `«${esc(n)}»`).join(", ")} — riconosciuto come la stessa persona.</p>` : ""}
    <label class="campo">Nome e cognome</label><input type="text" id="f-nome" value="${esc(q.nome)}">
    <div class="riga-f"><span>Gruppo</span><div class="seg">${[["corsisti", "Corsista"], ["staff", "Staff"]].map(([g, t]) => `<button data-f-gruppo="${g}" class="${q.gruppo === g ? "si" : ""}">${t}</button>`).join("")}</div></div>
    ${riga("ven", "🍕 Venerdì: mangia")}${riga("pagato", "💶 Ha dato 5 €", false)}${riga("sabP", "🍽️ Sabato pranzo")}
    <div class="riga-f"><span>Sabato: cosa mangia${+q.modulo.porzioni > 1 ? ` <span class="piccolo">(×${q.modulo.porzioni} porzioni)</span>` : ""}</span><div class="seg">${["primo", "secondo"].map((x) => `<button data-f-campo="piatto" data-f-val="${x}" class="${val(q, "piatto") === x ? "si" : ""}">${esc(nomePiatto(x))}</button>`).join("")}</div></div>
    ${riga("sabC", "🎉 Sabato cena")}
    <div class="riga-f"><span>🚗 Auto per la cena <span class="piccolo">(posti, 0 = no)</span></span><div class="contatore"><button data-f-auto="-1">−</button><b id="f-auto">${+val(q, "auto") || 0}</b><button data-f-auto="1">+</button></div></div>
    <div class="riga-f"><span>Ospiti alla cena</span><div class="contatore"><button data-f-ospiti="-1">−</button><b id="f-osp">+${+val(q, "ospiti") || 0}</b><button data-f-ospiti="1">+</button></div></div>
    ${riga("dom", "🍝 Domenica pranzo")}
    <button class="pulsante largo" data-f="salva">Fatto</button>
    ${!nuova && Object.keys(q.mano).length && !q.soloMano ? `<button class="pulsante sec largo" data-f="reset">Torna alle risposte del modulo</button>` : ""}
    ${!nuova ? `<button class="pulsante sec largo rosso" data-f="elimina">🗑 Elimina persona</button>` : ""}
    <button class="pulsante sec largo" data-f="chiudi">Annulla</button></div>`;
  $foglio.hidden = false;
  const bozza = { ...q.mano };
  let gruppo = q.gruppo;
  $foglio.onclick = async (e) => {
    const b = e.target.closest("button");
    if (e.target === $foglio) return chiudi();
    if (!b) return;
    if (b.dataset.fGruppo) { gruppo = b.dataset.fGruppo; b.parentNode.querySelectorAll("button").forEach((x) => x.classList.toggle("si", x === b)); }
    if (b.dataset.fCampo) {
      const c = b.dataset.fCampo, fv = b.dataset.fVal;
      const v = c === "piatto" ? fv : fv === "?" ? (q.modulo[c] === undefined ? null : "ignoto") : fv === "true";
      bozza[c] = v;
      if (c === "piatto") bozza.sabP = true;
      b.parentNode.querySelectorAll("button").forEach((x) => x.classList.toggle("si", x === b));
    }
    if (b.dataset.fAuto) {
      const n = Math.min(9, Math.max(0, (bozza.auto ?? (+val(q, "auto") || 0)) + +b.dataset.fAuto));
      bozza.auto = n || null; $foglio.querySelector("#f-auto").textContent = n;
    }
    if (b.dataset.fOspiti) {
      const n = Math.max(0, (bozza.ospiti ?? (+val(q, "ospiti") || 0)) + +b.dataset.fOspiti);
      bozza.ospiti = n; $foglio.querySelector("#f-osp").textContent = "+" + n;
    }
    if (b.dataset.f === "chiudi") chiudi();
    if (b.dataset.f === "salva") {
      const nome = $foglio.querySelector("#f-nome").value.trim();
      if (!nome) return alert("Scrivi il nome");
      if (nuova) { q.nome = nome; q.gruppo = gruppo; q.id = "mano:" + crypto.randomUUID(); }
      else {
        if (nome !== q.nome) bozza.nome = nome;
        if (gruppo !== q.gruppo) bozza.gruppo = gruppo;
      }
      chiudi(); await correggi(q, bozza);
    }
    if (b.dataset.f === "elimina") { if (await elimina(q)) chiudi(); return; }
    if (b.dataset.f === "reset") {
      ricordaRiga(`ritorno al modulo di ${q.nome}`, q.id);
      S.correzioni.delete(q.id); chiudi(); disegna();
      if (DEMO) return;
      const { error } = await sb.from("weekend_persone").delete().eq("classe", S.classe).eq("id", q.id);
      if (error) alert("Errore: " + error.message);
    }
  };
}
/** Elimina una persona: quelle aggiunte a mano spariscono del tutto, le altre (elenco/modulo) vengono nascoste */
async function elimina(p) {
  if (!confirm(`Eliminare ${p.nome}?` + (p.soloMano ? "" : "\n\nNon comparirà più nemmeno reimportando il file. Potrai ripristinarla da ⚙️ → Gruppi."))) return false;
  if (!p.soloMano) { await correggi(p, { eliminato: true }, `eliminazione di ${p.nome}`); return true; }
  ricordaRiga(`eliminazione di ${p.nome}`, p.id);
  S.correzioni.delete(p.id); disegna();
  if (DEMO) return true;
  const { error } = await sb.from("weekend_persone").delete().eq("classe", S.classe).eq("id", p.id);
  if (error) alert("Errore: " + error.message);
  return true;
}

function chiudi() { $foglio.hidden = true; $foglio.innerHTML = ""; }

/* ---------- Elenco: importa ---------- */
async function importaElenco(sostituisci) {
  const testo = $app.querySelector("[data-elenco]").value;
  const nuovi = leggiElenco(testo);
  if (!nuovi.length) return alert("Non trovo nomi: incolla un nome per riga.");
  if (sostituisci && !confirm(`Sostituire l'elenco attuale con ${nuovi.length} persone?`)) return;
  const tutti = new Map((sostituisci ? [] : S.imp.elenco || []).map((e) => [chiave(e.nome), e]));
  for (const e of nuovi) {
    const gia = [...tutti.keys()].find((k) => stessoNome(tutti.get(k).nome, e.nome));
    if (gia) tutti.delete(gia);
    tutti.set(chiave(e.nome), e);
  }
  S.imp.elenco = [...tutti.values()];
  disegna(); await salvaImp("importazione dell'elenco");
  alert(`Fatto: ${nuovi.length} persone importate (${S.imp.elenco.length} in elenco).`);
}

/* ---------- Tocchi ---------- */
$app.addEventListener("click", async (e) => {
  const b = e.target.closest("button, a");
  if (!b) return;
  const d = b.dataset;
  const trova = () => persone(true).find((p) => p.id === d.id);
  if (d.az === "classi" || d.apriClasse || d.spostaClasse || d.rinominaClasse || d.eliminaClasse) return azioneClasse(d);
  if (d.scheda) { S.scheda = d.scheda; S.filtro = "tutti"; scriviLocale("pasti.scheda", d.scheda); disegna(); scrollTo(0, 0); return; }
  if (d.filtro) { S.filtro = d.filtro; return disegna(); }
  if (d.gruppo) { S.gruppo = d.gruppo; return disegna(); }
  if (d.autoUsata && d.id) {
    const p = trova();
    // chi era nella sua auto torna da sistemare da solo (l'auto sparisce); lui diventa passeggero
    return correggi(p, d.autoUsata === "no" ? { autoUsata: false } : { autoUsata: null, inAuto: null });
  }
  if (d.ospitiAuto) { const p = persone(true).find((x) => x.id === d.ospitiAuto); return correggi(p, { ospitiInAuto: p.mano.ospitiInAuto === false ? null : false }); }
  if (d.pastoPosti) { S.pastoPosti = d.pastoPosti; scriviLocale("pasti.posti", d.pastoPosti); S.tavoloScelto = null; return disegna(); }
  if (d.togliPosto) { S.bollinoScelto = null; return siedi(d.togliPosto, "lista"); }
  if (d.tAz === "annulla-scelta") { S.bollinoScelto = null; return disegna(); }
  if (d.tAz) return azioneTavolo(d.tAz);
  if (d.tPosti) {
    const P = datiPosti(), t = P.tavoli.find((x) => x.id === S.tavoloScelto);
    t.posti = Math.max(1, Math.min(40, t.posti + +d.tPosti));
    // spazio per i nomi: il tavolo si allunga da solo (almeno ~64 cm di "piantina" per sedia)
    if (t.forma === "rett") { const lato = Math.ceil(t.posti / 2) * 86; if (t.w >= t.h) t.w = Math.max(t.w, aGriglia(lato)); else t.h = Math.max(t.h, aGriglia(lato)); }
    else { const giro = Math.max(180, aGriglia((t.posti * 90) / Math.PI)); t.w = t.h = Math.max(t.w, giro); }
    Object.keys(P.sedute).forEach((k) => { const [tid, i] = k.split(":"); if (tid === t.id && +i >= t.posti) delete P.sedute[k]; });
    return salvaPosti("posti del tavolo");
  }
  if (d.copiaLink) {
    try { await navigator.clipboard.writeText(linkIscrizione(d.copiaLink)); avvisoBreve("Link copiato ✓"); }
    catch { prompt("Copia questo link:", linkIscrizione(d.copiaLink)); }
    return;
  }
  if (d.linkAperto) { const L = confIscrizioni().link[d.linkAperto]; L.aperto = L.aperto === false; disegna(); return salvaImp(L.aperto ? "riapertura del link" : "chiusura del link"); }
  if (d.rigeneraLink) {
    if (!confirm("Creare un link nuovo? Quello vecchio smetterà di funzionare (le risposte già arrivate restano).")) return;
    confIscrizioni().link[d.rigeneraLink].chiave = nuovaChiave(); disegna(); return salvaImp("nuovo link");
  }
  if (d.eliminaIscr) {
    const r = S.iscrizioni.find((x) => x.id === d.eliminaIscr);
    if (!r || !confirm(`Eliminare la risposta di ${r.nome}?`)) return;
    ricorda(`eliminazione della risposta di ${r.nome}`, async () => { S.iscrizioni.push(r); if (!DEMO) await sb.from("weekend_iscrizioni").insert(r); });
    S.iscrizioni = S.iscrizioni.filter((x) => x !== r); disegna();
    if (!DEMO) { const { error } = await sb.from("weekend_iscrizioni").delete().eq("id", r.id); if (error) alert("Errore: " + error.message); }
    return;
  }
  if (d.mettiIn) return correggi(trova(), { inAuto: d.mettiIn });
  if (d.togliAuto) return correggi(persone(true).find((p) => p.id === d.togliAuto), { inAuto: null });
  if (d.az === "distribuisci") return distribuisci();
  if (d.filtroMancano) { S.filtroMancano = d.filtroMancano; return disegna(); }
  if (d.ordine) { S.ordine = d.ordine; scriviLocale("pasti.ordine", d.ordine); return disegna(); }
  if (d.schedaPersona) return apriPersona(d.schedaPersona);
  if (d.cambiaGruppo) return cambiaGruppo(persone(true).find((p) => p.id === d.cambiaGruppo));
  if (d.elimina) return elimina(persone(true).find((p) => p.id === d.elimina));
  if (d.ripristina) return correggi(persone(true, true).find((p) => p.id === d.ripristina), { eliminato: null });
  if (d.mettiGruppo) { const p = persone(true).find((x) => x.id === d.id); if (p.gruppo !== d.mettiGruppo) cambiaGruppo(p, d.mettiGruppo); return; }
  if (d.soldi && d.id) { const p = trova(); return applicaScelta(p, "pagato", val(p, "pagato") !== true); }
  if (d.tri && d.id) { const v = d.v === "true" ? true : d.v === "false" ? false : "?"; const p = trova(); if ((v === "?" ? val(p, d.tri) === undefined : val(p, d.tri) === v)) return; return applicaScelta(p, d.tri, v); }
  if (d.piatto) { const p = trova(); return correggi(p, { piatto: val(p, "piatto") === d.piatto ? null : d.piatto }); }
  if (d.auto) return correggi(trova(), { auto: d.auto === "si" ? 4 : null });
  if (d.autoPosti) { const p = trova(); return correggi(p, { auto: Math.min(9, Math.max(1, (+val(p, "auto") || 4) + +d.autoPosti)) }); }
  if (d.ospiti) { const p = trova(); return correggi(p, { ospiti: Math.max(0, (+val(p, "ospiti") || 0) + +d.ospiti) }); }
  if (d.togliElenco) {
    S.imp.elenco = S.imp.elenco.filter((x) => chiave(x.nome) !== d.togliElenco);
    disegna(); return salvaImp("persona tolta dall'elenco");
  }
  switch (d.az) {
    case "aggiorna": return caricaTutto();
    case "nuova": return apriPersona(null);
    case "ricarica": return location.reload();
    case "esci": e.preventDefault(); await sb.auth.signOut(); S.utente = null; return disegna();
    case "entra": case "registrati": return entra(d.az === "registrati");
    case "elenco-aggiungi": return importaElenco(false);
    case "elenco-sostituisci": return importaElenco(true);
    case "aggiungi-org": {
      const email = $app.querySelector("[data-nuovo-org]").value.trim().toLowerCase();
      if (!email.includes("@")) return;
      const { error } = await sb.from("weekend_organizzatori").insert({ email });
      if (error) return alert(error.message);
      S.organizzatori.push(email); return disegna();
    }
  }
  if (d.togliOrg && confirm("Togliere " + d.togliOrg + "?")) {
    await sb.from("weekend_organizzatori").delete().eq("email", d.togliOrg);
    S.organizzatori = S.organizzatori.filter((x) => x !== d.togliOrg); disegna();
  }
});

$app.addEventListener("submit", (e) => {
  if (!e.target.matches("[data-nuova-classe]")) return;
  e.preventDefault();
  const nome = e.target.nome.value.trim();
  if (nome) nuovaClasse(nome);
});

$app.addEventListener("input", (e) => {
  if (e.target.matches("[data-cerca], [data-cerca-gruppi]")) {
    const sel = e.target.matches("[data-cerca]") ? "[data-cerca]" : "[data-cerca-gruppi]";
    if (sel === "[data-cerca]") S.cerca = e.target.value; else S.cercaGruppi = e.target.value;
    const pos = e.target.selectionStart;
    disegna();
    const i = $app.querySelector(sel); i.focus(); i.setSelectionRange(pos, pos);
  }
});

$app.addEventListener("change", async (e) => {
  const s = e.target;
  if (s.dataset.mappa) {
    S.imp.modulo.mappa = { ...S.imp.modulo.mappa, [s.dataset.mappa]: s.value };
    await salvaImp("colonna del modulo"); caricaModulo(); disegna();
  }
  // modifiche al modulo di iscrizione
  if (s.matches("[data-mod-titolo], [data-mod-testo], [data-mod-nota], [data-mod-attivo], [data-mod-ospiti], [data-mod-auto]")) {
    const C = confIscrizioni();
    if (s.dataset.modTitolo !== undefined) C.titolo = s.value.trim();
    if (s.dataset.modTesto !== undefined) C.testo = s.value.trim();
    if (s.dataset.modNota) (C.pasti[s.dataset.modNota] ||= {}).nota = s.value.trim();
    if (s.dataset.modAttivo) (C.pasti[s.dataset.modAttivo] ||= {}).attivo = s.checked;
    if (s.dataset.modOspiti !== undefined) (C.pasti.sabC ||= {}).ospiti = s.checked;
    if (s.dataset.modAuto !== undefined) C.chiediAuto = s.checked;
    disegna(); return salvaImp("modifica del modulo");
  }
  if (s.dataset.piattoNome) {
    S.imp.piatti = { ...S.imp.piatti, [s.dataset.piattoNome]: s.value.trim() || (s.dataset.piattoNome === "primo" ? "Primo" : "Secondo"), scelti: true };
    caricaModulo(); disegna(); await salvaImp("nome del piatto");
  }
  if (s.matches("[data-file-risposte]") && s.files[0]) return importaRisposte(s.files[0]);
  if (s.matches("[data-file-elenco]") && s.files[0]) {
    try {
      const righe = await leggiFileTabella(s.files[0]);
      $app.querySelector("[data-elenco]").value = righe.map((r) => r.filter((x) => x.trim()).join("\t")).join("\n");
    } catch (err) { alert(err.message); }
  }
});

async function entra(nuovo) {
  const email = $app.querySelector("#email").value.trim(), password = $app.querySelector("#password").value;
  if (!email || password.length < 6) return disegnaAccesso("Scrivi email e una password di almeno 6 caratteri");
  const { data, error } = nuovo ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
  if (error) return disegnaAccesso(/invalid/i.test(error.message) ? "Email o password sbagliate" : error.message);
  if (nuovo && !data.session) return disegnaAccesso("Ti abbiamo mandato un'email: conferma l'indirizzo e poi entra.");
  avvia();
}

async function avvia() {
  const { data } = await sb.auth.getSession();
  S.utente = data.session?.user ?? null;
  if (!S.utente) return disegna();
  const { data: ok } = await sb.rpc("weekend_sono_organizzatore");
  if (!ok) { S.utente.vietato = true; return disegna(); }
  await caricaClassi();
  if (S.classe && S.classi.some((c) => c.id === S.classe)) await caricaTutto();
  else { S.classe = null; disegna(); }
}

// Aggiornamento automatico: quando torni sull'app e ogni minuto mentre è aperta
const pronto = () => S.utente && !S.utente.vietato && S.classe;
document.addEventListener("visibilitychange", () => { if (!document.hidden && pronto()) caricaTutto(); });
setInterval(() => {
  const scrivendo = document.activeElement?.matches("input, select, textarea");
  if (!document.hidden && pronto() && $foglio.hidden && !scrivendo && !trascino && !muovoTavolo) caricaTutto();
}, 60000);
largo.addEventListener("change", () => { if (S.utente) disegna(); });
addEventListener("resize", () => { if (S.scheda === "posti") adattaPianta(); });

/* Modalità prova (?demo): dati finti, niente Supabase. Per vedere com'è fatta l'app. */
const DEMO = new URLSearchParams(location.search).has("demo");
let DEMO_DATI = null;
if (DEMO) {
  const intest = ["Informazioni cronologiche", "Nome e cognome", "Venerdì apericena?", "Pranzo del sabato?", "Primo o secondo?", "Cena di sabato?", "Porti qualcuno?", "Pranzo domenica?"];
  S.imp.elenco = leggiElenco("Anna Bianchi\nLuca Verdi\nGiulia Neri\nPaolo Russo\nSara Conti\nMarco Ferri");
  S.imp.modulo = { file: "Risposte (prova).xlsx", quando: new Date().toISOString(), intest, mappa: {}, righe: [
    ["1", "Anna Bianchi", "Sì", "Sì", "Primo", "Sì", "1", "No"], ["1", "verdi luca", "Sì", "Sì", "Secondo", "Sì", "No", "Sì"],
    ["1", "Giulia Neri", "No", "Sì", "", "Sì", "2", "Sì"], ["1", "Paolo Russo", "Sì", "No", "", "Sì", "No", ""],
    ["1", "Mario Rossi", "Sì", "Sì", "Primo", "Sì", "No", "Sì"], ["1", "Francesca Moro", "Sì", "Sì", "Secondo", "No", "", "Sì"]] };
  caricaModulo();
  S.utente = { email: "prova@demo" };
  DEMO_DATI = structuredClone({ imp: S.imp, modulo: S.modulo });
  S.impSalvato = structuredClone(S.imp);
  S.classi = [{ id: "demo", nome: "Mind ottobre 2026 (prova)", ordine: 0 }, { id: "vuota", nome: "Classe vuota (prova)", ordine: 1 }];
  if (!S.classi.some((c) => c.id === S.classe)) S.classe = null;
  disegna();
} else avvia();
