# 🍕 Pasti del weekend

Indirizzo: https://gfeola21gf-ai.github.io/pasti-weekend/ (su iPhone: Safari → Condividi → Aggiungi alla schermata Home).
Prova con dati finti: aggiungi `?demo` all'indirizzo.

## Classi
All'apertura scegli la **classe** (es. «Mind ottobre 2026»): ognuna ha elenco, risposte, spunte, macchinate e posti suoi.
«＋ Crea» per una nuova classe, ↑ ↓ per l'ordine, ✎ per rinominarla, 🗑 per eliminarla (con tutti i suoi dati).
Dentro una classe, «‹ Classi» in alto torna alla lista.

## 🔗 Iscrizioni (al posto dei Google Moduli)
In ogni classe, «🔗 Iscrizioni»: due link, **Corsisti** e **Staff**. Copia il link e mandalo al gruppo giusto: chi lo apre
si iscrive dal telefono (nome, pasti, piatto, ospiti, auto) senza account, e le risposte arrivano subito in tutte le schermate.
Dallo stesso telefono può riaprire il link e correggere. Puoi modificare titolo, messaggio, pasti (con note) e piatti;
«🟢 Aperto / 🔒 Chiuso» blocca le iscrizioni; «↻ Nuovo link» rende inutilizzabile quello vecchio.

## Su Mac e iPad in orizzontale
Barra a sinistra e scheda **📋 Tutti i pasti**: i 4 riepiloghi in alto e una tabella con tutte le persone e tutti i pasti.

## 1 · Elenco dei corsisti (⚙️ Modulo ed elenco)
Importa l'elenco dei **corsisti** (file Excel/CSV o testo incollato, un nome per riga).
- Chi è in elenco = **corsista**. Chi risponde al modulo ma **non è in elenco = staff**, in automatico.
- Chi è in elenco ma non ha risposto appare come **«non ha compilato»**: tocca l'avviso 📭 in alto per vedere chi è (di nuovo → tutti).
- **Cambiare gruppo a mano**: tocca l'etichetta «🎓 Corsista ⇄» / «👔 Staff ⇄» accanto al nome, oppure usa
  la sezione **3 · Gruppi** in ⚙️ (tutti in fila, con ricerca). Riportando qualcuno al gruppo automatico, la scelta a mano sparisce.
- **Eliminare una persona**: 🗑 accanto al nome in ⚙️ → 3 · Gruppi, oppure tocca il nome → «🗑 Elimina persona».
  Chi arriva dall'elenco o dal modulo resta nascosto anche reimportando il file; si ripristina da «🗑 Persone eliminate».
- **Stessa persona scritta diversamente**: l'app unisce da sola maiuscole/accenti/ordine, secondi nomi in più
  («Mario Giuseppe Rossi»), «De Luca» = «Deluca», «D'Amico» = «Damico», doppie («Matia» = «Mattia») e un errore di battitura
  nei nomi lunghi. Per prudenza «Marco»/«Mario», «Alessandro»/«Alessandra» restano persone diverse. Nella scheda della
  persona vedi come aveva scritto il nome nel modulo. Se resta un doppione, eliminalo o spostalo a mano.

## 2 · Importare le risposte del Google Modulo (niente link pubblici)
1. Scarica le risposte: dal Foglio **File → Scarica → Microsoft Excel (.xlsx)**, oppure dal Modulo
   **Risposte → ⋮ → Scarica risposte (.csv)** (arriva in uno .zip: aprilo con un doppio clic).
2. Nell'app: **⚙️ Modulo ed elenco → 📥 Importa il file delle risposte**.
3. Quando arrivano nuove risposte, ripeti: il file nuovo sostituisce il vecchio, le spunte fatte a mano restano.
Il file si legge sul dispositivo e si salva su Supabase (visibile solo agli organizzatori). Le colonne con email, telefono,
allergie, note ecc. **non vengono salvate**. Il PDF non è supportato: le tabelle nei PDF non si leggono in modo affidabile.

## Domande consigliate per i moduli
- Nome e cognome
- (facoltativa) Sei staff o corsista?
- Ci sei all'apericena del venerdì? (Sì/No)
- Ci sei al pranzo del sabato? (Sì/No)
- Al pranzo del sabato preferisci primo o secondo? (Primo/Secondo)
- Ci sei alla cena di sabato? (Sì/No)
- Porti qualcuno alla cena? Quanti? (0, 1, 2…)
- Ci sei al pranzo della domenica? (Sì/No)

## Uso
- **Annulla**: ⌘Z (Ctrl+Z) oppure la freccetta ↶ in alto a destra annulla l'ultima azione (anche più volte di fila).
- **Ordine** (in ogni schermata): «A–Z» oppure «Per risposta» (prima chi c'è, poi chi non c'è, poi senza risposta).
  Corsisti e Staff sono sempre separati, ognuno in ordine alfabetico, anche con «Tutti».
- **✓ verde** = c'è · **✗ rossa** = non c'è · **? tratteggiato** = nessuna risposta.
  Ogni risposta ha un selettore a tre pulsanti ✓ | ✗ | ?: un tocco sulla scelta giusta. Scegliere la stessa risposta del modulo toglie la correzione a mano.
- **Soldi del venerdì**: un solo pulsante «5 €»: toccalo quando te li danno (diventa oro), ritoccalo per annullare.
- **Macchinate (cena di sabato)**: «🚗 auto?» accanto a chi c'è a cena (bloccato per gli altri). Toccalo se ha la
  macchina: compaiono i posti (4, con − / +; guidatore compreso). Ritocca 🚗 per toglierla. In alto: auto, posti e posti mancanti.
- **🚗 Macchinate** (barra «Auto»): in alto una riga di stato; sotto i **bollini** di chi è da sistemare
  (pallino, nome, posti che occupa). **Trascinali** col dito o col mouse in un'auto (o fuori, per toglierli); in alternativa
  tocca un bollino e poi l'auto. Nell'auto i passeggeri sono in colonna, ✕ li toglie con un clic. Accanto al nome dell'auto i posti in piccolo (un posto è del guidatore). «non usarla» = auto lasciata a casa
  (in fondo «Non usate: … usa» per rimetterla). «+N» nel bollino = ospiti: tocca per «per conto loro» (barrato). «✨ automatico» riempie le auto.
- **🪑 Posti** (linguette Sab pranzo / Dom pranzo): piantina vista dall'alto. «＋ Tavolo» / «＋ Tondo» creano un tavolo;
  trascinalo per spostarlo, tocca per sceglierlo: posti −/+ (si allunga da solo), ruota, forma, svuota, elimina, quadratino
  blu nell'angolo = dimensioni. Avvicina due tavoli finché si toccano e «⧉ unisci» per una tavolata. A sinistra Staff | Corsisti
  (chi c'è a quel pranzo): trascina i bollini sulle sedie (sedia occupata = scambio); un clic su chi è seduto lo rimanda nella lista.
  Colori: **Staff giallo ocra**, **Corsisti blu**, per vedere subito se si alternano.
- Filtri di ogni pasto: Tutti · Ci sono · Non ci sono · ? / Non compilato.
- **📝 Da completare**: chi ha anche un solo dato mancante (venerdì, 5 €, sabato pranzo, piatto, sabato cena, domenica)
  e cosa manca, con il selettore già lì per rispondere subito. Filtri per tipo di dato, con i numeri.
- Sotto il nome: il gruppo (toccalo per cambiarlo) e da dove arrivano le risposte: «dal modulo», «corretto a mano»,
  «inserito a mano», «non ha compilato»; «aggiornato» = risposte nuove o cambiate nell'ultimo file importato.
- Tocca le spunte per correggere (diventano «a mano» e valgono più del modulo).
- Tocca un nome per vedere tutti i suoi pasti, rinominarlo o tornare alle risposte del modulo.
- «＋ Aggiungi una persona» per chi non ha compilato.
- Altri organizzatori: in ⚙️ aggiungi la loro email; loro creano un account dall'app.
