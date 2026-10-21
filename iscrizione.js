/* =========================================================
   iscrizione.js — modulo pubblico di iscrizione ai pasti.
   Il link contiene una chiave (?k=…) che dice classe e gruppo (staff / corsisti).
   Non serve l'accesso: si legge il modulo e si invia la propria iscrizione con due funzioni
   di Supabase che controllano la chiave (supabase/iscrizioni.sql). Nessun dato degli altri è visibile.
   Sullo stesso telefono si può riaprire il link e correggere (token salvato in localStorage).
   ========================================================= */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
import { SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA, { auth: { persistSession: false } });
const $ = document.getElementById("modulo");
const chiave = new URLSearchParams(location.search).get("k") || "";
const memoria = "iscrizione." + chiave;
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const leggi = () => { try { return JSON.parse(localStorage.getItem(memoria)) || {}; } catch { return {}; } };
const scrivi = (v) => { try { localStorage.setItem(memoria, JSON.stringify(v)); } catch {} };

const PASTI = [
  ["ven", "🍕 Apericena del venerdì"],
  ["sabP", "🍽️ Pranzo del sabato"],
  ["sabC", "🎉 Cena del sabato"],
  ["dom", "🍝 Pranzo della domenica"],
];

let M = null;                 // il modulo (dal server)
let R = { nome: "", risposte: {} };
let errore = "";

async function avvia() {
  if (!chiave) return messaggio("🔗", "Link incompleto", "Chiedi a chi organizza il link giusto.");
  const { data, error } = await sb.rpc("weekend_modulo", { chiave });
  if (error || !data) return messaggio("🔗", "Link non valido", "Questo link non funziona più. Chiedi a chi organizza quello nuovo.");
  M = data;
  const salvato = leggi();
  if (salvato.nome) R = { nome: salvato.nome, risposte: salvato.risposte || {} };
  if (!M.aperto) return messaggio("🔒", "Iscrizioni chiuse", "Non si accettano più risposte. Per cambiamenti, scrivi a chi organizza.");
  if (salvato.inviato && !salvato.modifica) return grazie();
  disegna();
}

function messaggio(icona, titolo, testo) {
  $.innerHTML = `<div class="fatto"><div class="grande">${icona}</div><h1>${esc(titolo)}</h1><p class="tenue">${esc(testo)}</p></div>`;
}

const pastoAttivo = (k) => (M.modulo?.pasti?.[k]?.attivo ?? true) !== false;
const nomePiatto = (x) => (M.piatti || {})[x] || (x === "primo" ? "Primo" : "Secondo");

function disegna() {
  const mod = M.modulo || {}, r = R.risposte;
  const gruppo = M.gruppo === "staff" ? "Modulo per lo staff" : "Modulo per i corsisti";
  $.innerHTML = `
    <header class="is-testa"><div class="classe">${esc(M.classe || "")}</div>
      <h1>${esc(mod.titolo || "Iscrizione ai pasti")}</h1><div class="gruppo">${gruppo}</div></header>
    ${mod.testo ? `<p class="is-intro">${esc(mod.testo)}</p>` : ""}
    <section class="is-pasto"><h2>Come ti chiami?</h2>
      <p class="is-nota">Nome e cognome, così ti riconosciamo.</p>
      <input class="campo-nome" id="nome" autocomplete="name" placeholder="Nome e cognome" value="${esc(R.nome)}"></section>
    ${PASTI.filter(([k]) => pastoAttivo(k)).map(([k, titolo]) => {
      const nota = mod.pasti?.[k]?.nota || "";
      let extra = "";
      if (k === "sabP" && r.sabP === true) extra = `<div class="extra"><label>Cosa vuoi mangiare?</label><div class="scegli">
        ${["primo", "secondo"].map((x) => `<button type="button" data-piatto="${x}" class="${r.piatto === x ? "on" : ""}">${esc(nomePiatto(x))}</button>`).join("")}</div></div>`;
      if (k === "sabC" && r.sabC === true) {
        if (mod.pasti?.sabC?.ospiti !== false) extra += `<div class="extra"><label>Porti qualcuno con te? Quanti?</label>
          <div class="passi"><button type="button" data-passo="ospiti" data-d="-1" aria-label="meno">−</button><b>${r.ospiti || 0}</b><button type="button" data-passo="ospiti" data-d="1" aria-label="più">+</button></div></div>`;
        if (mod.chiediAuto !== false) extra += `<div class="extra"><label>Vieni in macchina e puoi dare passaggi? Quanti posti ha (te compreso)?</label>
          <div class="passi"><button type="button" data-passo="auto" data-d="-1" aria-label="meno">−</button><b>${r.auto ? r.auto : "no"}</b><button type="button" data-passo="auto" data-d="1" aria-label="più">+</button></div></div>`;
      }
      return `<section class="is-pasto"><h2>${esc(mod.pasti?.[k]?.titolo || titolo)}</h2>${nota ? `<p class="is-nota">${esc(nota)}</p>` : `<div style="height:10px"></div>`}
        <div class="si-no">${[[true, "Sì, ci sono"], [false, "No"]].map(([v, t]) => `<button type="button" data-pasto="${k}" data-v="${v}" class="${r[k] === v ? "on" : ""}">${t}</button>`).join("")}</div>${extra}</section>`;
    }).join("")}
    <button class="pulsante invia" id="invia">${leggi().inviato ? "Salva le modifiche" : "Invia"}</button>
    ${errore ? `<p class="errore">${esc(errore)}</p>` : ""}`;
}

$.addEventListener("input", (e) => { if (e.target.id === "nome") R.nome = e.target.value; });
$.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const r = R.risposte, d = b.dataset;
  if (d.pasto) {
    r[d.pasto] = d.v === "true";
    if (d.pasto === "sabP" && !r.sabP) delete r.piatto;
    if (d.pasto === "sabC" && !r.sabC) { delete r.ospiti; delete r.auto; }
  }
  if (d.piatto) r.piatto = d.piatto;
  if (d.passo) r[d.passo] = Math.max(0, Math.min(d.passo === "auto" ? 9 : 6, (+r[d.passo] || 0) + +d.d));
  if (d.passo === "auto" && r.auto === 1) r.auto = +d.d > 0 ? 2 : 0;   // un'auto ha almeno 2 posti
  if (b.id === "invia") return invia();
  if (b.id === "modifica") { scrivi({ ...leggi(), modifica: true }); return disegna(); }
  disegna();
});

async function invia() {
  errore = "";
  const nome = R.nome.trim(), r = R.risposte;
  const mancano = PASTI.filter(([k]) => pastoAttivo(k) && typeof r[k] !== "boolean");
  if (!nome) errore = "Scrivi nome e cognome.";
  else if (mancano.length) errore = "Rispondi a tutti i pasti (Sì o No).";
  else if (pastoAttivo("sabP") && r.sabP && !r.piatto) errore = "Scegli cosa mangiare sabato a pranzo.";
  if (errore) return disegna();
  const bottone = document.getElementById("invia");
  bottone.disabled = true; bottone.textContent = "Invio…";
  const salvato = leggi();
  const { data, error } = await sb.rpc("weekend_iscriviti", { chiave, nome, risposte: r, tok: salvato.token || null });
  if (error) { errore = error.message || "Non è stato possibile inviare. Riprova."; return disegna(); }
  scrivi({ token: data?.token || salvato.token, nome, risposte: r, inviato: true });
  grazie();
}

function grazie() {
  const s = leggi();
  $.innerHTML = `<div class="fatto"><div class="grande">✅</div><h1>Grazie, ${esc((s.nome || "").split(" ")[0])}!</h1>
    <p class="tenue">La tua iscrizione è arrivata. Se cambi idea, da questo telefono puoi riaprire il link e correggerla.</p>
    <button class="pulsante sec" id="modifica">Modifica le risposte</button></div>`;
}

avvia();
