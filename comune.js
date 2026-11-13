/* =========================================================
   comune.js — ciò che serve sia all'app (organizzatori) sia al modulo pubblico (iscrizione.html):
   icone, testi del modulo, regole dei pasti e disegno del modulo di iscrizione.

   IL MODULO (uno per link: S.imp.iscrizioni.moduli.corsisti / .staff)
     { titolo, testo, testi: {…scritte…}, pasti: [Pasto] }
   Pasto = { id, nome, quando, icona, attivo, info, tipo: "sino" | "menu", quota, ospiti, auto, testi: {piatto, ospiti, auto}, menu }
     tipo "sino": si chiede solo se c'è (+ quota da portare, es. apericena 5 €)
     tipo "menu": menu = { formula, prezzo, gruppi: [{ id, nome, formula, prezzo, piatti: [{id, nome}] }], extra: [{ id, nome, facoltativa, piatti }] }
       se ne sceglie UN piatto fra tutti i gruppi; un gruppo con prezzo/formula propri vince su quelli del menù;
       extra = scelte in più (es. contorno), una ciascuna.
   RISPOSTE (piatte, compatibili con quelle di prima): { [id]: true|false, piatto|piatto:ID, x:ID:XID, ospiti|ospiti:ID, auto|auto:ID }
     Per i pasti storici restano le chiavi di prima: "piatto" (sabP), "ospiti"/"auto" (sabC), "pagato" (ven).
   ========================================================= */

/* ---------- Icone (tratto unico, come nelle altre app: niente emoji) ---------- */
const P = (d) => `<path d="${d}"/>`, C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`,
  R = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const I = {
  posate: P("M7 3v6a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2 1.6-3 4.2-3 7.5V13h3"),
  calice: P("M7.5 3h9l-.4 4.6a4.1 4.1 0 0 1-8.2 0zM12 11.8V20.5M8.5 20.5h7M7.8 6.5h8.4"),
  ciotola: P("M3.5 11.5h17a8.5 8.5 0 0 1-17 0zM9 20.5h6M9.5 8.5c0-1.4 1-1.9 1-3.4M13.5 8.5c0-1.4 1-1.9 1-3.4"),
  pizza: P("M12 21L3.8 6.2c5.2-2.8 11.2-2.8 16.4 0zM5.4 9.1c4.2-1.9 9-1.9 13.2 0") + C(10.5, 11.5, .9) + C(13.5, 15, .9) + C(13.6, 11.3, .5),
  tazza: P("M5 9.5h11V14a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.3a2.5 2.5 0 0 1 0 5H16M8.5 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"),
  torta: P("M4 20.5h16M5 20.5V13h14v7.5M5 16.3c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0M12 13V9.5M12 7c.9-.6.9-1.7 0-3-.9 1.3-.9 2.4 0 3z"),
  pane: P("M4 13.5C4 9.4 7.6 6.5 12 6.5s8 2.9 8 7v3.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17zM9 10l-1.2 3.2M12.6 9.6l-1.2 3.4M16.2 10.2 15 13.2"),
  sole: C(12, 12, 4) + P("M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"),
  luna: P("M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"),
  piu: P("M12 5v14M5 12h14"), meno: P("M5 12h14"), spunta: P("M5 12.5l4.5 4.5L19 7"), chiudi: P("M6 6l12 12M18 6L6 18"),
  domanda: P("M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5") + C(12, 18, .6),
  matita: P("M4 20l1-4L16 5l3 3L8 19z") + P("M14 7l3 3"),
  cestino: P("M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"),
  copia: R(8.5, 8.5, 11.5, 11.5, 2.5) + P("M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"),
  su: P("M6 15l6-6 6 6"), giu: P("M6 9l6 6 6-6"), sinistra: P("M15 5l-7 7 7 7"), destra: P("M9 5l7 7-7 7"),
  link: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  lucchetto: R(5, 10.5, 14, 10, 2.5) + P("M8 10.5V8a4 4 0 0 1 8 0v2.5"),
  aperto: R(5, 10.5, 14, 10, 2.5) + P("M8 10.5V8a4 4 0 0 1 7.7-1.5"),
  occhio: P("M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z") + C(12, 12, 3),
  persone: C(9, 8, 3.2) + P("M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 4.8a3.2 3.2 0 0 1 0 6.4M18 14.3c1.8.8 3 2.7 3 5.7"),
  persona: C(12, 8, 3.5) + P("M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7"),
  auto: P("M4 16.5V13l1.8-5a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.9 1.3L20 13v3.5M4 13h16M4 16.5h16M5.5 16.5V19M18.5 16.5V19") + C(7.5, 14.8, .4) + C(16.5, 14.8, .4),
  sedia: P("M7 3.5v17M7 12h10v8.5M17 12V7M7 7h10"),
  lista: P("M9 6h11M9 12h11M9 18h11") + C(4.5, 6, .6) + C(4.5, 12, .6) + C(4.5, 18, .6),
  tabella: R(3.5, 4.5, 17, 15, 2.5) + P("M3.5 9.5h17M9.5 9.5v10"),
  euro: P("M17 6.8A6 6 0 0 0 7.6 12a6 6 0 0 0 9.4 5.2M5 10.2h8M5 13.8h8"),
  invia: P("M4 12l16-8-6 16-2.5-6.5z") + P("M11.5 13.5L20 4"),
  aggiorna: P("M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"),
  annulla: P("M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"),
  appunti: R(6, 4.5, 12, 16, 2.5) + P("M9.5 4.5V3.5h5v1M9 10h6M9 14h6M9 18h3"),
  modulo: R(5, 3.5, 14, 17, 2.5) + P("M8.5 8h7M8.5 12h7M8.5 16h4"),
  attenzione: P("M12 4l9 16H3zM12 10v4") + C(12, 17, .6),
  magia: P("M5 19L15 9M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M8 4v2M7 5h2"),
  scopa: P("M14 3l-4 9M8 12h8l2 9H6z"),
  ruota: P("M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"),
  tondo: C(12, 12, 7.5), rettangolo: R(3.5, 7, 17, 10, 2),
  unisci: R(3.5, 8, 8, 8, 1.5) + R(12.5, 8, 8, 8, 1.5),
  file: P("M6 3h8l4 4v14H6zM14 3v4h4"),
  scarica: P("M12 4v11M7 10l5 5 5-5M5 20h14"),
  freccia: P("M7 17L17 7M9 7h8v8"),
  posta: P("M4 7l8 6 8-6M4 6h16v12H4z"),
};
export const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ""}</svg>`;
export const ICONE_PASTI = ["calice", "posate", "ciotola", "pizza", "pane", "tazza", "torta", "sole", "luna"];

export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const nuovoId = () => Math.random().toString(36).slice(2, 9);
export const euro = (n) => (n || n === 0) && n !== "" ? `${String(+n).replace(".", ",")} €` : "";

/* ---------- Chiavi delle risposte (compatibili con i dati di prima) ---------- */
export const kPiatto = (k) => (k === "sabP" ? "piatto" : "piatto:" + k);
export const kOspiti = (k) => (k === "sabC" ? "ospiti" : "ospiti:" + k);
export const kAuto = (k) => (k === "sabC" ? "auto" : "auto:" + k);
export const kPagato = (k) => (k === "ven" ? "pagato" : "pagato:" + k);
export const kExtra = (k, x) => `x:${k}:${x}`;

/* ---------- Scritte del modulo (tutte modificabili) ---------- */
export const TESTI = { sopra: "", nome: "Come ti chiami?", nomeSeg: "Nome e cognome", si: "Sì, ci sono", no: "No", quota: "in contanti, precisi",
  mioMenu: "Il tuo pranzo", noGrazie: "No, grazie", invia: "Invia", salva: "Salva le modifiche", grazie: "Grazie!",
  grazieTesto: "La tua iscrizione è arrivata. Ti ricordiamo di portare le quote in contanti e precise. Se cambi idea, riapri questo link dallo stesso telefono e modifica le risposte.",
  modifica: "Cambia le risposte",
  chiuso: "Iscrizioni chiuse", chiusoTesto: "Abbiamo già confermato i numeri con i locali. Se hai bisogno di cambiare qualcosa, scrivi direttamente a chi organizza.",
  esTitolo: "Allergie o intolleranze?", esSotto: "Celiachia, allergie, diete particolari", esDomanda: "Raccontaci in breve di cosa hai bisogno",
  esEsempio: "Es. sono celiaca", esRassicura: "Ti contatteremo prima del weekend per organizzare tutto insieme a te e al locale. Queste informazioni le vedono solo gli organizzatori.",
  esPiatto: "Per il tuo piatto ci accordiamo direttamente con te.", esConcordare: "Preferisco concordare un piatto adatto a me",
  esConcordato: "Da concordare insieme" };
export const TESTI_PASTO = { piatto: "Scegli il tuo piatto", ospiti: "Vuoi portare qualcuno con te? Indica quante persone in più.", auto: "Vieni in macchina? Se puoi offrire un passaggio, indica quanti posti hai (te compreso)." };
export const ETICHETTE_TESTI = [["sopra", "In cima (sopra il titolo)"], ["nome", "Domanda sul nome"], ["nomeSeg", "Dentro il campo del nome"], ["si", "Pulsante sì"], ["no", "Pulsante no"],
  ["quota", "Accanto alla quota"], ["mioMenu", "Riquadro della scelta"], ["noGrazie", "Per saltare una scelta"], ["invia", "Pulsante di invio"], ["salva", "Pulsante per salvare le correzioni"],
  ["esTitolo", "Allergie: domanda"], ["esSotto", "Allergie: esempi"], ["esDomanda", "Allergie: cosa ti serve"], ["esEsempio", "Allergie: dentro il campo"],
  ["esRassicura", "Allergie: rassicurazione"], ["esConcordare", "Allergie: opzione per concordare il piatto"], ["esConcordato", "Allergie: piatto da concordare (riepilogo)"], ["grazie", "Dopo l'invio"], ["grazieTesto", "Messaggio dopo l'invio"], ["modifica", "Pulsante per correggere"], ["chiuso", "Iscrizioni chiuse"], ["chiusoTesto", "Messaggio a iscrizioni chiuse"]];

export const nuovoPasto = () => ({ id: nuovoId(), nome: "", quando: "", icona: "posate", attivo: true, info: "", tipo: "sino", quota: 0, ospiti: false, auto: false, testi: { ...TESTI_PASTO }, menu: null });
export const nuovoMenu = () => ({ formula: "", prezzo: null, gruppi: [{ id: nuovoId(), nome: "Primi", formula: "", prezzo: null, piatti: [{ id: nuovoId(), nome: "" }] }], extra: [] });

/** Dal modulo di prima (uguale per i due link, 4 pasti fissi) ai due moduli nuovi. Le chiavi restano quelle di prima. */
export function moduliDa(C = {}, piatti = {}) {
  const vecchio = C.pasti || {}, attivo = (k) => vecchio[k]?.attivo !== false, nota = (k) => vecchio[k]?.nota || "";
  const nome = (x) => piatti?.[x] || (x === "primo" ? "Primo" : "Secondo");
  const base = { ...TESTI_PASTO };
  const M = {
    titolo: C.titolo || "Iscrizione ai pasti", testo: C.testo || "", testi: { ...TESTI },
    pasti: [
      { id: "ven", nome: "Apericena", quando: "Venerdì sera", icona: "calice", attivo: attivo("ven"), info: nota("ven"), tipo: "sino", quota: 5, ospiti: false, auto: false, testi: { ...base }, menu: null },
      { id: "sabP", nome: "Pranzo", quando: "Sabato", icona: "posate", attivo: attivo("sabP"), info: nota("sabP"), tipo: "menu", quota: 0, ospiti: false, auto: false, testi: { ...base },
        menu: { formula: "", prezzo: null, extra: [], gruppi: [
          { id: "primo", nome: "Primo", formula: "", prezzo: null, piatti: [{ id: "primo", nome: nome("primo") }] },
          { id: "secondo", nome: "Secondo", formula: "", prezzo: null, piatti: [{ id: "secondo", nome: nome("secondo") }] }] } },
      { id: "sabC", nome: "Cena", quando: "Sabato sera", icona: "pizza", attivo: attivo("sabC"), info: nota("sabC"), tipo: "sino", quota: 0,
        ospiti: vecchio.sabC?.ospiti !== false, auto: C.chiediAuto !== false, testi: { ...base }, menu: null },
      { id: "dom", nome: "Pranzo", quando: "Domenica", icona: "ciotola", attivo: attivo("dom"), info: nota("dom"), tipo: "sino", quota: 0, ospiti: false, auto: false, testi: { ...base }, menu: null },
    ],
  };
  return { corsisti: M, staff: structuredClone(M) };
}
/** Completa un modulo (campi mancanti dopo aggiornamenti dell'app) */
export function completa(M) {
  M.testi = { ...TESTI, ...(M.testi || {}) };
  for (const p of M.pasti || []) { p.testi = { ...TESTI_PASTO, ...(p.testi || {}) }; if (p.tipo === "menu" && !p.menu) p.menu = nuovoMenu(); }
  return M;
}

/* ---------- Regole dei menù ---------- */
export const tuttiPiatti = (p) => (p.menu?.gruppi || []).flatMap((g) => g.piatti);
export const gruppoDi = (p, piattoId) => p.menu?.gruppi.find((g) => g.piatti.some((x) => x.id === piattoId));
export const haPrezzi = (m) => !!m?.gruppi.some((g) => g.prezzo || g.formula);
/** Quanto paga chi ha scelto quel piatto (pasto con menù) o la quota (pasto sì/no) */
export function prezzoDi(p, piattoId) {
  if (p.tipo !== "menu") return +p.quota || 0;
  const g = gruppoDi(p, piattoId);
  return +(g?.prezzo ?? p.menu.prezzo) || 0;
}

/* ---------- Il modulo come lo vede chi si iscrive ----------
   st = { r: risposte, nome, qui: modifica dei testi sul posto, errore, classe, gruppo, giaInviato }
   Con st.qui ogni scritta è modificabile (data-ed = percorso dentro il modulo), i pulsanti diventano semplici riquadri. */
export function disegnaModulo(M, st) {
  M = completa(M);
  const T = M.testi, r = st.r || {};
  const ed = (path, val) => st.qui ? `<span class="ed" contenteditable="plaintext-only" spellcheck="false" data-ed='${esc(JSON.stringify(path))}'>${esc(val)}</span>` : esc(val);
  const tasto = (attr, cls, inner) => st.qui ? `<div class="${cls}">${inner}</div>` : `<button type="button" ${attr} class="${cls}">${inner}</button>`;
  const passi = (k, v) => `<div class="passi">${tasto(`data-passo="${k}" data-d="-1" aria-label="meno"`, "", ic("meno"))}<b>${v}</b>${tasto(`data-passo="${k}" data-d="1" aria-label="più"`, "", ic("piu"))}</div>`;
  const carta = (p, i) => {
    const m = p.menu, PP = ["pasti", i], ci = st.qui ? true : r[p.id];
    let prezzo = "";
    if (p.tipo === "sino" && p.quota) prezzo = `<div class="formula"><span class="formula-prezzo">${euro(p.quota)}</span><span>${ed([...PP, "testi", "quota"], p.testi.quota ?? T.quota)}</span></div>`;   // la scritta accanto alla quota è di ogni pasto
    if (p.tipo === "menu" && (m.formula || m.prezzo || st.qui)) prezzo = `<div class="formula"><span class="formula-prezzo">${euro(m.prezzo) || ic("posate")}</span><span>${ed([...PP, "menu", "formula"], m.formula)}</span></div>`;
    if (p.tipo === "menu" && haPrezzi(m)) prezzo += `<div class="formule">${m.gruppi.map((g, j) => [g, j]).filter(([g]) => g.prezzo || g.formula)
      .map(([g, j]) => `<div><b>${ed([...PP, "menu", "gruppi", j, "nome"], g.nome)}</b><span>${ed([...PP, "menu", "gruppi", j, "formula"], g.formula)}</span><em>${euro(g.prezzo ?? m.prezzo)}</em></div>`).join("")}</div>`;
    let extra = "";
    if (ci === true && p.tipo === "menu") {
      const scelto = r[kPiatto(p.id)];
      extra += `<div class="extra"><label>${ed([...PP, "testi", "piatto"], p.testi.piatto)}</label>
        ${m.gruppi.map((g, j) => `<div class="scelte-gruppo">${m.gruppi.length > 1 || st.qui ? `<div class="sg-titolo"><span>${ed([...PP, "menu", "gruppi", j, "nome"], g.nome)}</span>${haPrezzi(m) && (g.prezzo ?? m.prezzo) ? `<span>${euro(g.prezzo ?? m.prezzo)}</span>` : ""}</div>` : ""}
          <div class="scelte">${g.piatti.map((pi, k) => tasto(`data-piatto="${p.id}|${pi.id}"`, scelto === pi.id && !st.qui ? "on" : "", `<span class="cerchio"></span>${ed([...PP, "menu", "gruppi", j, "piatti", k, "nome"], pi.nome)}`)).join("")}</div></div>`).join("")}
        ${es === true ? `<div class="scelte concordare">${tasto(`data-piatto="${p.id}|-"`, scelto === "-" && !st.qui ? "on" : "", `<span class="cerchio"></span>${ed(["testi", "esConcordare"], T.esConcordare)}`)}</div>` : ""}</div>`;
      if (scelto !== "-" || st.qui) extra += m.extra.map((e, j) => `<div class="extra"><label>${ed([...PP, "menu", "extra", j, "nome"], e.nome)}</label>
        <div class="scelte">${e.piatti.map((pi, k) => tasto(`data-extra="${p.id}|${e.id}|${pi.id}"`, r[kExtra(p.id, e.id)] === pi.id && !st.qui ? "on" : "", `<span class="cerchio"></span>${ed([...PP, "menu", "extra", j, "piatti", k, "nome"], pi.nome)}`)).join("")}
        ${e.facoltativa || r.esigenza === true ? tasto(`data-extra="${p.id}|${e.id}|-"`, r[kExtra(p.id, e.id)] === "-" && !st.qui ? "on" : "", `<span class="cerchio"></span><span class="tenue">${ed(["testi", "noGrazie"], T.noGrazie)}</span>`) : ""}</div></div>`).join("");
      if (scelto || st.qui) {
        const nomi = [scelto === "-" ? T.esConcordato : tuttiPiatti(p).find((q) => q.id === scelto)?.nome, ...m.extra.map((e) => e.piatti.find((q) => q.id === r[kExtra(p.id, e.id)])?.nome)].filter(Boolean);
        extra += `<div class="totale"><span>${ed(["testi", "mioMenu"], T.mioMenu)}<small>${esc(nomi.join(" + ")) || "…"}</small></span><b>${(scelto ? prezzoDi(p, scelto) : +m.prezzo) ? euro(scelto ? prezzoDi(p, scelto) : m.prezzo) : ""}</b></div>`;
      }
    }
    if (ci === true && p.ospiti) extra += `<div class="extra"><label>${ed([...PP, "testi", "ospiti"], p.testi.ospiti)}</label>${passi(kOspiti(p.id), +r[kOspiti(p.id)] || 0)}</div>`;
    if (ci === true && p.auto) extra += `<div class="extra"><label>${ed([...PP, "testi", "auto"], p.testi.auto)}</label>${passi(kAuto(p.id), +r[kAuto(p.id)] || "no")}</div>`;
    const v = st.qui ? undefined : r[p.id];
    return `<section class="is-pasto"><h2><span class="tondino">${ic(p.icona || "posate")}</span><span>${ed([...PP, "nome"], p.nome)}<span class="quando">${ed([...PP, "quando"], p.quando)}</span></span></h2>
      ${p.info || st.qui ? `<p class="is-nota">${ed([...PP, "info"], p.info)}</p>` : ""}${prezzo}
      <div class="si-no">${tasto(`data-pasto="${p.id}" data-v="true"`, `s ${v === true ? "on" : ""}`, `${ic("spunta", "p")} ${ed(["testi", "si"], T.si)}`)}${tasto(`data-pasto="${p.id}" data-v="false"`, `n ${v === false ? "on" : ""}`, ed(["testi", "no"], T.no))}</div>${extra}</section>`;
  };
  // allergie e intolleranze: chi risponde sì scrive cosa gli serve e non sceglie il piatto (ci si accorda a voce)
  const es = st.qui ? true : r.esigenza;
  const esigenze = () => `<section class="is-pasto"><h2><span class="tondino">${ic("domanda")}</span><span>${ed(["testi", "esTitolo"], T.esTitolo)}<span class="quando">${ed(["testi", "esSotto"], T.esSotto)}</span></span></h2>
    <div class="si-no">${tasto(`data-esigenza="true"`, `s ${r.esigenza === true && !st.qui ? "on" : ""}`, "Sì")}${tasto(`data-esigenza="false"`, `n ${r.esigenza === false && !st.qui ? "on" : ""}`, "No")}</div>
    ${es === true ? `<div class="extra"><label>${ed(["testi", "esDomanda"], T.esDomanda)}</label>
      ${st.qui ? `<div class="campo-nome tenue">${ed(["testi", "esEsempio"], T.esEsempio)}</div>` : `<textarea class="campo-nome area" id="esigenza-nota" rows="2" maxlength="300" placeholder="${esc(T.esEsempio)}">${esc(r.esigenzaNota || "")}</textarea>`}
      <div class="rassicura">${ic("persona", "p")}<span>${ed(["testi", "esRassicura"], T.esRassicura)}</span></div></div>` : ""}</section>`;
  const sopra = [T.sopra || st.classe || ""].filter(Boolean)[0];
  return `<div class="mod-pub ${st.qui ? "in-modifica" : ""}">
    <header class="is-testa">${sopra || st.qui ? `<div class="classe">${st.qui ? ed(["testi", "sopra"], T.sopra || st.classe || "") : esc(sopra)}</div>` : ""}<h1>${ed(["titolo"], M.titolo)}</h1></header>
    ${M.testo || st.qui ? `<p class="is-intro">${ed(["testo"], M.testo)}</p>` : ""}
    <section class="is-pasto"><h2 class="solo">${ed(["testi", "nome"], T.nome)}</h2>
      <input class="campo-nome" id="nome" autocomplete="name" placeholder="${esc(T.nomeSeg)}" value="${esc(st.nome || "")}" ${st.qui ? "disabled" : ""}></section>
    ${M.esigenze !== false ? esigenze() : ""}
    ${M.pasti.map((p, i) => [p, i]).filter(([p]) => p.attivo !== false).map(([p, i]) => carta(p, i)).join("")}
    ${st.qui ? `<div class="pulsante invia">${ic("invia", "p")} ${ed(["testi", "invia"], T.invia)}</div>
      <section class="is-pasto dopo"><div class="cerchio-ok piccolo-ok">${ic("spunta")}</div><h2 class="solo">${ed(["testi", "grazie"], T.grazie)}</h2>
        <p class="tenue">${ed(["testi", "grazieTesto"], T.grazieTesto)}</p><div class="pulsante sec">${ed(["testi", "modifica"], T.modifica)}</div></section>`
    : `<button type="button" class="pulsante invia" id="invia">${ic("invia", "p")} ${esc(st.giaInviato ? T.salva : T.invia)}</button>`}
    ${st.errore && !st.qui ? `<p class="errore">${esc(st.errore)}</p>` : ""}</div>`;
}

/** Applica un tocco sul modulo alle risposte. Ritorna true se qualcosa è cambiato. */
export function toccoModulo(M, r, b) {
  const d = b.dataset;
  if (d.pasto) {
    r[d.pasto] = d.v === "true";
    if (!r[d.pasto]) for (const k of Object.keys(r)) if (k === kPiatto(d.pasto) || k === kOspiti(d.pasto) || k === kAuto(d.pasto) || k.startsWith(`x:${d.pasto}:`)) delete r[k];
    return true;
  }
  if (d.esigenza) {
    r.esigenza = d.esigenza === "true";
    if (!r.esigenza) { delete r.esigenzaNota; for (const k of Object.keys(r)) if (r[k] === "-" && (k === "piatto" || k.startsWith("piatto:"))) delete r[k]; }
    return true;
  }
  if (d.piatto) { const [k, id] = d.piatto.split("|"); r[kPiatto(k)] = id; if (id === "-") for (const x of Object.keys(r)) if (x.startsWith(`x:${k}:`)) delete r[x]; return true; }
  if (d.extra) { const [k, x, id] = d.extra.split("|"); r[kExtra(k, x)] = id; return true; }
  if (d.passo) {
    const auto = d.passo.startsWith("auto");
    let v = Math.max(0, Math.min(auto ? 9 : 6, (+r[d.passo] || 0) + +d.d));
    if (auto && v === 1) v = +d.d > 0 ? 2 : 0;   // un'auto ha almeno 2 posti
    if (v) r[d.passo] = v; else delete r[d.passo];
    return true;
  }
  return false;
}

/** Cosa manca prima di inviare ("" = tutto a posto) */
export function controllaModulo(M, nome, r) {
  if (!String(nome || "").trim()) return "Scrivi nome e cognome.";
  if (M.esigenze !== false && typeof r.esigenza !== "boolean") return "Rispondi alla domanda su allergie e intolleranze.";
  if (r.esigenza && !String(r.esigenzaNota || "").trim()) return "Raccontaci in breve di cosa hai bisogno.";
  const pasti = M.pasti.filter((p) => p.attivo !== false);
  if (pasti.some((p) => typeof r[p.id] !== "boolean")) return "Rispondi a tutti i pasti.";
  const manca = pasti.find((p) => r[p.id] && p.tipo === "menu" && (!r[kPiatto(p.id)] || (!r.esigenza && r[kPiatto(p.id)] !== "-" && p.menu.extra.some((e) => e.piatti.length && !r[kExtra(p.id, e.id)]))));
  return manca ? `Completa la scelta per «${manca.nome}${manca.quando ? " · " + manca.quando : ""}».` : "";
}

/** Il riepilogo dopo l'invio: un pasto per riga, con i piatti e quanto paga */
export function riepilogoModulo(M, r) {
  return `<ul class="ricevuta">${r.esigenza ? `<li><span>${ic("domanda", "p")} ${esc(M.testi?.esTitolo || "Allergie o intolleranze")}<small>${esc(r.esigenzaNota || "")}</small></span><b>${ic("spunta", "p")}</b></li>` : ""}${M.pasti.filter((p) => p.attivo !== false).map((p) => {
    if (!r[p.id]) return `<li><span>${ic(p.icona, "p")} ${esc(p.nome)} <span class="tenue">${esc(p.quando)}</span></span><span class="tenue">${esc(M.testi?.no || "No")}</span></li>`;
    const nomi = p.tipo === "menu" ? [r[kPiatto(p.id)] === "-" ? (M.testi?.esConcordato || "Da concordare") : tuttiPiatti(p).find((q) => q.id === r[kPiatto(p.id)])?.nome, ...p.menu.extra.map((e) => e.piatti.find((q) => q.id === r[kExtra(p.id, e.id)])?.nome)].filter(Boolean) : [];
    const costo = prezzoDi(p, r[kPiatto(p.id)]);
    return `<li><span>${ic(p.icona, "p")} ${esc(p.nome)} <span class="tenue">${esc(p.quando)}</span>${nomi.length ? `<small>${esc(nomi.join(" + "))}</small>` : ""}${+r[kOspiti(p.id)] ? `<small>+${r[kOspiti(p.id)]}</small>` : ""}</span><b>${costo ? euro(costo) : ic("spunta", "p")}</b></li>`;
  }).join("")}</ul>`;
}

/** Toglie dalle risposte ciò che il modulo attuale non chiede più (pasti tolti, piatti cambiati, domande spente).
    Serve quando qualcuno riapre il link dopo che gli organizzatori hanno modificato il modulo. Ritorna true se ha tolto qualcosa. */
export function pulisciRisposte(M, r) {
  const prima = JSON.stringify(r);
  const attivi = new Map(M.pasti.filter((p) => p.attivo !== false).map((p) => [p.id, p]));
  const pastoDi = (k) => k === "piatto" ? "sabP" : k === "ospiti" || k === "auto" ? "sabC" : (k.match(/^(?:piatto|ospiti|auto):(.+)$/) || k.match(/^x:([^:]+):/) || [])[1];
  for (const k of Object.keys(r)) {
    if (k === "esigenza" || k === "esigenzaNota") { if (M.esigenze === false) delete r[k]; continue; }
    if (typeof r[k] === "boolean") { if (!attivi.has(k)) delete r[k]; continue; }
    const p = attivi.get(pastoDi(k));
    if (!p || r[p.id] !== true) { delete r[k]; continue; }
    if (k === kPiatto(p.id)) { if (p.tipo !== "menu" || (r[k] === "-" ? r.esigenza !== true : !tuttiPiatti(p).some((x) => x.id === r[k]))) delete r[k]; }
    else if (k.startsWith("x:")) { const e = p.menu?.extra.find((x) => k === kExtra(p.id, x.id)); if (!e || (r[k] !== "-" && !e.piatti.some((x) => x.id === r[k]))) delete r[k]; }
    else if (k === kOspiti(p.id)) { if (!p.ospiti) delete r[k]; }
    else if (k === kAuto(p.id)) { if (!p.auto) delete r[k]; }
  }
  return JSON.stringify(r) !== prima;
}
