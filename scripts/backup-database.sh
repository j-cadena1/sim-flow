#!/bin/bash
#
# Sim RQ Database Backup Script
# Backs up PostgreSQL database to local storage
# Usage: ./backup-database.sh
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sim-rq}"
DB_CONTAINER="${DB_CONTAINER:-sim-rq-db}"
DB_NAME="${DB_NAME:-sim-rq}"
DB_USER="${DB_USER:-sim-rq_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/sim-rq_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Sim RQ Database Backup ===${NC}"
echo "Timestamp: $(date)"
echo "Backup file: ${BACKUP_FILE}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if container is running
if ! docker ps | grep -q "${DB_CONTAINER}"; then
    echo -e "${RED}Error: Database container '${DB_CONTAINER}' is not running${NC}"
    exit 1
fi

# Perform backup
echo "Creating backup..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Check if backup was successful
if [ $? -eq 0 ] && [ -f "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✓ Backup successful${NC}"
    echo "  Size: ${BACKUP_SIZE}"
    echo "  Location: ${BACKUP_FILE}"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Clean up old backups (keep only last RETENTION_DAYS days)
echo "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "sim-rq_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "sim-rq_*.sql.gz" -type f | wc -l)
echo "Total backups in storage: ${BACKUP_COUNT}"

echo -e "${GREEN}=== Backup Complete ===${NC}"
