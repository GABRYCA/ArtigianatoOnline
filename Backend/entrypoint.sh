#!/bin/sh

# Uscita immediate in caso d'errore
set -e

# Variabili da docker compose
DB_HOST="$DB_HOST"
DB_PORT="$DB_PORT"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
# PGPASSWORD=$DB_PASSWORD

echo "entrypoint Backend avviato. In attesa del database $DB_HOST:$DB_PORT..."

counter=0
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q -U "$DB_USER" -d "$DB_NAME"; do
  counter=$((counter+1))
  if [ $counter -ge 12 ]; then
    echo "Timeout: impossibile collegarsi al database."
    exit 1
  fi
  echo "Database non trovato. Nuovo tentativo di connessione tra 5 secondi..."
  sleep 5
done

echo "Database pronto!"

# Seeding
export PGPASSWORD=$DB_PASSWORD
echo "Verifico se sia già stato fatto il seeding..."

admin_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM users WHERE email = 'admin@artigianato.it' LIMIT 1;")

unset PGPASSWORD

if [ "$admin_exists" = "1" ]; then
  echo "Seeding non necessario (o è già presente un utente admin)."
else
  echo "Esecuzione seeding (npm run seed)..."
  npm run seed
  echo "Seeding completato."
fi

echo "Avvio del backend (npm start)..."
exec "$@"