# Artigianato Online - Esame Pratico
Esame pratico del corso di tecnologie innovative per lo sviluppo Web.

## Team:
- 756564 - Caretti Gabriele
- 758697 - Como Riccardo

### Strumenti:
- Docker e Docker Compose
- Node.js
- Bootstrap 5.3.5
- Express.js
- PostgreSQL
- Nginx (+ Nginx Proxy Manager)

### Istruzioni:
- Compilare a dovere il .env (root), modificando il .env.example e rinominandolo in .env.
- Aggiungere un A record al dominio, si consiglia di usare Cloudflare, che punta all'IP del server.

#### VPS LINUX:
- Installare Docker e Docker Compose (Guida DigitalOcean: [leggi](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04)!)
- `docker-compose up -d --build` o `docker compose up -d --build` per avviare i servizi, direttamente dalla root del progetto, usando quindi docker-compose.yml.
    - Sarà automaticamente installato Postgresql e Node.js, e verrà avviato il server Backend Express, Frontend con NGINX (Gestito da Nginx Proxy Manager) e Reverse-Proxy per API. Il database sarà popolato con alcuni dati di esempio.
    - Procedere con la sezione [Nginx Proxy Manager](#nginx-proxy-manager) per configurare SSL, reverse proxy e dominio.

### Utilizzo:
- Backend: `http://indirizzo_o_dominio.tld/api/<route>`.
- Swagger UI: `http://swagger.indirizzo_o_dominio.tld/api-docs`.
- Nginx Proxy Manager: `http://indirizzo_ip:81`.
- Frontend: `http://indirizzo_o_dominio.tld`.
    - Per testare il login, usare le credenziali di un utente già registrato
    - Utente:
  ```txt
  email: luca.bianchi@email.com
  password: passwordUtente1
  ```
    - Artigiano:
  ```txt
  email: anna.rossi@artigianato.it
  password: passwordArtigiano1
  ```
    - Admin:
  ```txt
  email: admin@artigianato.it
  password: passwordAdmin123
  ```

### Nginx Proxy Manager:
- Andare all'indirizzo: `http://indirizzo_o_dominio:81`
- Credenziali (Di default, cambiarle con le successive consigliate o a piacere):
```txt
email: admin@example.com
password: changeme
```
- Credenziali (Consigliate):
```txt
Full Name: Artigianato
Nickname: Admin
email: anonymousgca@anonymousgca.eu
password: PasswordArtigianato2025!
```
- Cliccare "Hosts" -> "Proxy Hosts" -> "Add Proxy Host"
    - Aggiungere il dominio (esempio: `artigianato.anonymousgca.eu`), Forward Hostname/IP: `frontend_nginx`. Forward Port: `80`. Attivare "Cache Assets" e "Block Common Exploits".
    - Passare alla tab **SSL**, premere su "None" e "Request a new SSL Certificate". Attivare "Force SSL" e "HTTP/2 Support". Attivare "I agree to the Let's Encrypt Terms of Service".
    - Premere "Save" e attendere che il certificato venga generato. Se tutto va a buon fine, il dominio sarà visibile in verde.
- Cliccare sui tre puntini a destra del dominio e premere "Edit". Entrare nella tab "Custom locations" e premere "Add location", Define location: `/api`, Forward Hostname/IP: `backend_node`, Forward Port: `3000`.
    - Premere l'icona dell'ingranaggio a destra e aggiungere le seguenti righe:
```txt
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```
- Premere "Save".
- **SWAGGER**:
    - Creare un A Record su Cloudflare con il nome `swagger-artigianato` che punta all'ip del server.
    - Tornare all'indirizzo: `http://indirizzo_o_dominio:81`
    - Cliccare "Hosts" -> "Proxy Hosts" -> "Add Proxy Host"
    - Aggiungere il dominio (esempio: `swagger-artigianato.anonymousgca.eu`), Forward Hostname/IP: `backend_node`. Forward Port: `3000`. Attivare "Cache Assets" e "Block Common Exploits".
    - Passare alla tab **SSL**, premere su "None" e "Request a new SSL Certificate". Attivare "Force SSL" e "HTTP/2 Support". Attivare "I agree to the Let's Encrypt Terms of Service".
    - Premere "Save" e attendere che il certificato venga generato. Se tutto va a buon fine, il dominio sarà visibile in verde.

### Redeploy:
- Alcuni servizi possono essere riavviati senza dover riavviare tutto (`docker-compose down` o `docker compose down` e `docker-compose up -d` o `docker compose up -d`). Per esempio, se si apportano modifiche al frontend, è possibile riavviare solo il servizio del frontend.
    - Esempio (sostituire frontend con altri servizi, come: backend, npm o db): `docker-compose up -d --no-deps --build frontend` (o `docker compose up -d --no-deps --build frontend`).

### Testato su Azure Cloud:
- Testato con il piano gratuito Student di Azure su una VPS Ubuntu ARM64.
- Nota: Le porte 80 e 443 potrebbero essere già aperte, ma per sicurezza, verificare.
    - La porta 81 va aperta (altrimenti non si riesce ad accedere a Nginx Proxy Manager aka. NPM)
    - In caso si voglia svolgere del debug remoto con postgres allora aprire anche 5432 (sconsigliato in produzione).
    - .github/workflows è un esempio di deploy automatico ad ogni modifica alla repository.