/* =========================================================
   iscrizione.js — modulo pubblico di iscrizione ai pasti.
   Il link contiene una chiave (?k=…) che dice classe e gruppo (staff / corsisti): ogni gruppo ha il SUO modulo
   (pasti, menù, prezzi e scritte scelti dagli organizzatori). Il disegno del modulo sta in comune.js.
   Non serve l'accesso: si legge il modulo e si invia la propria iscrizione con due funzioni di Supabase
   che controllano la chiave (supabase/iscrizioni.sql). Sullo stesso telefono si può riaprire il link e correggere.
   ========================================================= */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
import { SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA } from "./config.js";
import { ic, esc, moduliDa, completa, disegnaModulo, toccoModulo, controllaModulo, riepilogoModulo, pulisciRisposte, TESTI } from "./comune.js?v=20261113l";

const sb = createClient(SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA, { auth: { persistSession: false } });
const $ = document.getElementById("modulo");
const chiave = new URLSearchParams(location.search).get("k") || "";
const memoria = "iscrizione." + chiave;
const leggi = () => { try { return JSON.parse(localStorage.getItem(memoria)) || {}; } catch { return {}; } };
const scrivi = (v) => { try { localStorage.setItem(memoria, JSON.stringify(v)); } catch {} };

let D = null, M = null;       // risposta del server e modulo di questo link
let R = { nome: "", r: {} };
let errore = "", avviso = "";

async function avvia() {
  if (!chiave) return messaggio("link", "Link incompleto", "Chiedi a chi organizza il link giusto.");
  const { data, error } = await sb.rpc("weekend_modulo", { chiave });
  if (error || !data) return messaggio("link", "Link non valido", "Questo link non funziona più. Chiedi a chi organizza quello nuovo.");
  D = data;
  const C = D.modulo || {};
  M = completa(structuredClone(C.moduli?.[D.gruppo] || moduliDa(C, D.piatti)[D.gruppo]));
  document.title = M.titolo || "Iscrizione ai pasti";
  let salvato = leggi();
  // questo telefono si era già iscritto: chiedo al server se l'iscrizione esiste ancora (gli organizzatori possono averla cancellata)
  if (salvato.token) {
    const mia = await sb.rpc("weekend_mia_iscrizione", { chiave, tok: salvato.token });
    if (!mia.error && !mia.data) { try { localStorage.removeItem(memoria); } catch {} salvato = {}; }   // cancellata: si riparte da zero
    else if (mia.data) { salvato = { ...salvato, nome: mia.data.nome, risposte: mia.data.risposte || {} }; scrivi(salvato); }
  }
  if (salvato.nome) R = { nome: salvato.nome, r: structuredClone(salvato.risposte || {}) };
  if (!D.aperto) return messaggio("lucchetto", M.testi.chiuso, M.testi.chiusoTesto);
  // il modulo è cambiato dopo l'iscrizione: tolgo le scelte che non valgono più e chiedo di ricontrollare
  const cambiato = pulisciRisposte(M, R.r);
  if (salvato.inviato && (cambiato || controllaModulo(M, R.nome, R.r))) {
    avviso = "Il modulo è stato aggiornato: ricontrolla le tue risposte e salvale di nuovo.";
    return disegna();
  }
  if (salvato.inviato && !salvato.modifica) return grazie();
  disegna();
}

function messaggio(icona, titolo, testo) {
  $.innerHTML = `<div class="fatto"><div class="cerchio-ok neutro">${ic(icona, "g")}</div><h1>${esc(titolo || "")}</h1><p class="tenue">${esc(testo || "")}</p></div>`;
}

function disegna() {
  $.innerHTML = (avviso ? `<p class="avviso-mod">${ic("attenzione", "p")} ${esc(avviso)}</p>` : "") + disegnaModulo(M, { r: R.r, nome: R.nome, errore, classe: D.classe, giaInviato: !!leggi().inviato });
}

$.addEventListener("input", (e) => { if (e.target.id === "nome") R.nome = e.target.value; if (e.target.id === "esigenza-nota") R.r.esigenzaNota = e.target.value.slice(0, 300); });
$.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.id === "invia") return invia();
  if (b.id === "modifica") { scrivi({ ...leggi(), modifica: true }); errore = ""; return disegna(); }
  if (toccoModulo(M, R.r, b)) { errore = ""; disegna(); }
});

async function invia() {
  errore = controllaModulo(M, R.nome, R.r);
  if (errore) return disegna();
  const bottone = document.getElementById("invia");
  bottone.disabled = true; bottone.textContent = "Invio…";
  const salvato = leggi(), nome = R.nome.trim();
  const { data, error } = await sb.rpc("weekend_iscriviti", { chiave, nome, risposte: R.r, tok: salvato.token || null });
  if (error) { errore = error.message || "Non è stato possibile inviare. Riprova."; return disegna(); }
  scrivi({ token: data?.token || salvato.token, nome, risposte: R.r, inviato: true });
  avviso = "";
  scrollTo(0, 0);
  grazie();
}

/** «Grazie» + nome: tolgo la punteggiatura finale della scritta per non avere «Grazie!, Laura!» */
function titoloGrazie(testo, nome) {
  const g = String(testo || "Grazie").trim().replace(/[\s!.,;:]+$/, ""), n = String(nome || "").trim().split(/\s+/)[0];
  return esc(n ? `${g}, ${n}!` : `${g}!`);
}

function grazie() {
  const s = leggi(), T = M?.testi || TESTI;
  $.innerHTML = `<div class="mod-pub"><div class="fatto"><div class="cerchio-ok">${ic("spunta", "g")}</div><h1>${titoloGrazie(T.grazie, s.nome)}</h1>
    <p class="tenue">${esc(T.grazieTesto)}</p></div>
    ${riepilogoModulo(M, s.risposte || {})}
    <button class="pulsante sec largo" id="modifica" style="margin-top:14px">${ic("matita", "p")} ${esc(T.modifica)}</button></div>`;
}

avvia();
