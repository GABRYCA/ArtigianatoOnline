#!/bin/bash

# Script di backup. Crea un backup del progetto docker nella cartella 'backups'

set -e

PROJECT_NAME=$(basename "$(pwd)")
BACKUPS_ROOT_DIR="$(pwd)/backups"

BACKUP_DIR="${BACKUPS_ROOT_DIR}/$(date +%F_%H-%M-%S)"


# Controlla se il file .env esiste, è fondamentale per le credenziali del DB
if [ ! -f .env ]; then
    echo "! ERRORE: File .env non trovato. Impossibile procedere con il backup del database."
    echo "Copia .env.example in .env e configuralo prima di eseguire lo script."
    exit 1
fi

export $(grep -v '^#' .env | xargs)

echo ">>> Creazione della cartella di backup: ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"

# BACKUP DEL DATABASE POSTGRESQL
echo ">>> [1/5] Backup del database '${DB_NAME}' in corso (dump SQL)..."
sudo docker compose exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_DIR}/db_backup.sql.gz"

# BACKUP VOLUMI DI NGINX PROXY MANAGER
echo ">>> [2/5] Backup del volume dati di Nginx Proxy Manager..."
sudo docker run --rm \
  -v "${PROJECT_NAME}_npm-data:/data" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar czf "/backup/npm_data.tar.gz" -C /data .

echo ">>> [3/5] Backup del volume certificati di Nginx Proxy Manager (Let's Encrypt)..."
sudo docker run --rm \
  -v "${PROJECT_NAME}_npm-letsencrypt:/etc/letsencrypt" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar czf "/backup/npm_letsencrypt.tar.gz" -C /etc/letsencrypt .

# BACKUP FILE DI CONFIGURAZIONE
echo ">>> [4/5] Backup dei file di configurazione (docker-compose, .env, postgres-init)..."
cp docker-compose.yml .env "${BACKUP_DIR}/"
tar czf "${BACKUP_DIR}/postgres-init.tar.gz" -C . ./postgres-init

# BACKUP IMMAGINI DOCKER
echo ">>> [5/5] Backup delle immagini Docker personalizzate..."
sudo docker save -o "${BACKUP_DIR}/backend_image.tar" "${PROJECT_NAME}-backend"
sudo docker save -o "${BACKUP_DIR}/frontend_image.tar" "${PROJECT_NAME}-frontend"

echo ""
echo "=========================================="
echo "  BACKUP COMPLETATO CON SUCCESSO!"
echo "=========================================="
echo "I file di backup sono stati salvati in:"
echo "$BACKUP_DIR"
echo ""
echo "Contenuto del backup:"
ls -lh "$BACKUP_DIR"