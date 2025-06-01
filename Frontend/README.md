# Frontend - Artigianato Online

> Piattaforma web moderna per la vendita di prodotti artigianali con interfaccia responsive e user-friendly.

---

## Indice

- [Stack Tecnologico](#stack-tecnologico)
- [Architettura](#architettura)
- [Funzionalità](#funzionalità-principali)
- [Dettagli Tecnici](#dettagli-tecnici)
- [Testing](#testing)

---

## Stack Tecnologico

| Tecnologia | Versione | Scopo |
|------------|----------|-------|
| **HTML5** | - | Struttura semantica |
| **CSS3** | - | Styling e responsive design |
| **Bootstrap** | 5.3.5 | Framework UI e grid system |
| **JavaScript** | ES6+ | Logica client-side |
| **jQuery** | - | DOM manipulation e AJAX |

---

## Architettura

```
Frontend/
├── account/                    # Gestione ordini e profilo utente
│   └── ordini.html            # Pagina per visualizzare storico ordini cliente
├── auth/                       # Sistema di autenticazione
│   └── autenticazione.html    # Form unificato login/registrazione con toggle
├── common/                     # Componenti riutilizzabili
│   ├── header.html            # Navbar responsive con menu dinamico per ruolo
│   ├── footer.html            # Footer con link utili e info legali
│   └── css/style.css          # Stili personalizzati e override Bootstrap
├── images/                     # Assets statici
├── js/                         # Script JavaScript modulari
│   └── headerfooterloader.js  # Caricamento dinamico header/footer via AJAX
├── legal/                      # Pagine conformità legale
│   ├── privacy.html           # Informativa privacy GDPR compliant
│   └── tos.html               # Termini e condizioni d'uso
├── index.html                  # Homepage con vetrina prodotti
├── prodotto.html              # Dettaglio prodotto con immagini e descrizione
├── account.html               # Profilo utente e impostazioni
├── carrello.html              # Carrello acquisti con calcolo totali
├── checkout.html              # Processo acquisto multi-step
├── dashboard.html             # Dashboard multi-ruolo (cliente/artigiano/admin)
└── status.html                # Visualizzazione stato API
```

---

## Funzionalità Principali

### 🔐 Sistema di Autenticazione
- **Login/Registrazione Unificato**: Pagina singola con toggle tra modalità login e registrazione
- **Gestione Ruoli Completa**:
    - `cliente`: accesso a catalogo, carrello, ordini personali
    - `artigiano`: gestione prodotti propri, dashboard vendite, ordini ricevuti
    - `admin`: controllo totale utenti, prodotti, ordini, categorie
- **JWT Security**: Token automaticamente allegato alle richieste API protette
- **Persistent Login**: Sessione mantenuta tramite localStorage con scadenza automatica
- **UI Dinamica**: Menu di navigazione e opzioni che si adattano in base al ruolo utente
- **Logout Sicuro**: Pulizia completa dello storage e redirect alla homepage

### 🛒 Sistema E-commerce Completo

#### Catalogo e Ricerca
- **Vetrina Homepage**: Grid responsiva con prodotti in evidenza
- **Filtri Avanzati**: Per categoria, prezzo, artigiano, disponibilità
- **Ricerca Testuale**: Search box con risultati in tempo reale
- **Paginazione**: Navigazione fluida tra pagine di prodotti
- **Dettaglio Prodotto**: Pagina dedicata con immagini e descrizione

#### Gestione Carrello
- **Carrello Persistente**: Mantiene prodotti anche dopo chiusura browser
- **Aggiornamento Dinamico**: Quantità e totali si aggiornano in tempo reale
- **Validazione Stock**: Controllo disponibilità prima dell'aggiunta
- **Calcolo Spese**: Subtotale e spedizione calcolati automaticamente
- **Salvataggio Temporaneo**: Recupero carrello in caso di disconnessione

#### Processo di Checkout
- **Checkout Guidato**: Steps chiari (dati, pagamento, conferma)
- **Validazione Dati**: Controlli su indirizzi di spedizione e fatturazione
- **Metodi Pagamento**: Supporto per carta di credito, PayPal, bonifico
- **Riepilogo Ordine**: Dettaglio completo prima della conferma finale

### 👤 Dashboard Multi-ruolo Avanzata

#### Dashboard Cliente
- **Profilo Personale**: Modifica dati anagrafici, password, preferenze
- **Storico Ordini**: Lista completa con filtri per data, stato, importo
- **Tracking Spedizioni**: Monitoraggio in tempo reale con aggiornamenti automatici
- **Lista Desideri**: Salvataggio prodotti preferiti per acquisti futuri
- **Indirizzario**: Gestione indirizzi di spedizione multipli

#### Dashboard Artigiano
- **Gestione Prodotti**: CRUD completo (create, read, update, delete)
- **Inventory Management**: Controllo stock, alert scorte minime
- **Ordini Ricevuti**: Lista ordini con filtri per stato e data
- **Profilo Negozio**: Descrizione attività

#### Dashboard Admin
- **Controllo Totale Prodotti**: Moderazione, approvazione, rimozione
- **Sistema Ordini**: Oversight completo su tutti gli ordini della piattaforma
- **Gestione Categorie**: CRUD categorie con struttura gerarchica

---

## Dettagli Tecnici

### Componenti Dinamici
```javascript
// Caricamento automatico header/footer
headerfooterloader.js // jQuery-based component loading
```

### Gestione Stato
- **Autenticazione**: JWT token in localStorage
- **Carrello**: prodotti salvati localmente
- **API Communication**: fetch/AJAX per backend integration

### Sicurezza Client-side
- Validazione input HTML5 + JavaScript custom
- Token JWT automatico nelle richieste API
- Sanitizzazione dati in ingresso

---

## Testing

### Test Manuali
| Scenario | Pagina | Input | Output Atteso |
|----------|--------|-------|---------------|
| ✅ Login valido | `autenticazione.html` | Credenziali corrette | Redirect a dashboard |
| ❌ Login invalido | `autenticazione.html` | Password errata | Messaggio di errore |
| 🛒 Aggiungi carrello | `prodotto.html` | Click "Aggiungi" | Prodotto nel carrello |
| 💳 Checkout | `checkout.html` | Conferma ordine | Ordine creato |
| 📦 Tracking | `status.html` | Verifica stato | Display status |

### Compatibilità Browser
- ✅ **Chrome**
- ✅ **Firefox**
- ✅ **Safari**
- ✅ **Edge**

---

## Licenza

Questo progetto è rilasciato sotto licenza Apache 2.0. Consulta il file LICENSE per maggiori dettagli.
