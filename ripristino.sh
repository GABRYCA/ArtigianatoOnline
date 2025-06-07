#!/bin/bash

# Script di ripristino usando un backup.
# ESECUZIONE:
# 1. Mettere questo script nella NUOVA cartella del progetto (vuota).
# 2. Rendere eseguibile lo script: chmod +x restore.sh
# 3. Lancia: ./ripristino.sh /percorso_completo_cartella_di_backup (quello che si ottiene con pwd all'interno della cartella di backup)
# Esempio: ./ripristino.sh /home/gca/backups/2025-06-07_12-30-00

set -e

# Verifica percorso backup
if [ -z "$1" ]; then
  echo "! ERRORE: Devi specificare il percorso della cartella di backup come argomento."
  echo "Uso: $0 /percorso/della/cartella_di_backup"
  exit 1
fi

BACKUP_DIR=$1

if [ ! -d "$BACKUP_DIR" ]; then
  echo "! ERRORE: La cartella di backup '$BACKUP_DIR' non esiste."
  exit 1
fi

PROJECT_NAME=$(basename "$(pwd)")
echo ">>> Rilevato nome del progetto Docker: ${PROJECT_NAME}"
echo ">>> Inizio ripristino dalla cartella: ${BACKUP_DIR}"

# ------------------------------------------------------------------------------
echo -e "\n>>> [1/6] Ripristino dei file di configurazione..."
# ------------------------------------------------------------------------------
cp "${BACKUP_DIR}/docker-compose.yml" .
cp "${BACKUP_DIR}/.env" .
if [ -f "${BACKUP_DIR}/postgres-init.tar.gz" ]; then
    tar xzf "${BACKUP_DIR}/postgres-init.tar.gz" -C .
fi

# Caricamento variabili dal .env.
export $(grep -v '^#' .env | xargs)

echo -e "\n>>> [2/6] Caricamento delle immagini Docker da backup..."
sudo docker load -i "${BACKUP_DIR}/backend_image.tar"
sudo docker load -i "${BACKUP_DIR}/frontend_image.tar"

echo -e "\n>>> [3/6] Creazione e ripristino dei volumi di Nginx Proxy Manager..."
sudo docker volume create "${PROJECT_NAME}_npm-data"
sudo docker volume create "${PROJECT_NAME}_npm-letsencrypt"

sudo docker run --rm \
  -v "${PROJECT_NAME}_npm-data:/data" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar xzf /backup/npm_data.tar.gz -C /data

sudo docker run --rm \
  -v "${PROJECT_NAME}_npm-letsencrypt:/etc/letsencrypt" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar xzf /backup/npm_letsencrypt.tar.gz -C /etc/letsencrypt

echo -e "\n>>> [4/6] Avvio del servizio database per il ripristino..."
sudo docker compose up -d db
echo "In attesa che il database si inizializzi (10 secondi)..."
sleep 10

echo -e "\n>>> [5/6] Importazione del dump del database SQL..."
gunzip < "${BACKUP_DIR}/db_backup.sql.gz" | sudo docker compose exec -T db psql -U "${DB_USER}" -d "${DB_NAME}"

echo -e "\n>>> [6/6] Avvio di tutti gli altri servizi..."
sudo docker compose up -d

echo ""
echo "=========================================="
echo "  RIPRISTINO COMPLETATO CON SUCCESSO!"
echo "=========================================="
echo "L'applicazione dovrebbe essere ora accessibile."
echo "Puoi controllare lo stato dei container con: docker compose ps"