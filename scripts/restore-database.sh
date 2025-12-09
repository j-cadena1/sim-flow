#!/bin/bash
#
# Sim RQ Database Restore Script
# Restores PostgreSQL database from backup
# Usage: ./restore-database.sh /path/to/backup.sql.gz
#

set -e

# Configuration
DB_CONTAINER="${DB_CONTAINER:-sim-rq-db}"
DB_NAME="${DB_NAME:-sim-rq}"
DB_USER="${DB_USER:-sim-rq_user}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Sim RQ Database Restore ===${NC}"
echo "Timestamp: $(date)"

# Check if backup file was provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 /path/to/backup.sql.gz"
    echo ""
    echo "Available backups:"
    find /var/backups/sim-rq -name "sim-rq_*.sql.gz" -type f -printf "%T@ %p\n" | sort -rn | head -10 | awk '{print $2}'
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: Backup file '${BACKUP_FILE}' not found${NC}"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "Backup file: ${BACKUP_FILE}"
echo "Size: ${BACKUP_SIZE}"

# Check if container is running
if ! docker ps | grep -q "${DB_CONTAINER}"; then
    echo -e "${RED}Error: Database container '${DB_CONTAINER}' is not running${NC}"
    exit 1
fi

# Confirmation prompt
echo -e "${YELLOW}WARNING: This will replace ALL data in the database!${NC}"
read -p "Are you sure you want to restore? (type 'yes' to continue): " -r
if [ "$REPLY" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create a safety backup before restore
SAFETY_BACKUP="/tmp/sim-rq_pre_restore_$(date +"%Y%m%d_%H%M%S").sql.gz"
echo "Creating safety backup before restore..."
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${SAFETY_BACKUP}"
echo "Safety backup saved to: ${SAFETY_BACKUP}"

# Restore database
echo "Restoring database..."
gunzip < "${BACKUP_FILE}" | docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Restore successful${NC}"
    echo "  From: ${BACKUP_FILE}"
    echo "  Safety backup: ${SAFETY_BACKUP}"
else
    echo -e "${RED}✗ Restore failed${NC}"
    echo "Original database backup available at: ${SAFETY_BACKUP}"
    exit 1
fi

echo -e "${GREEN}=== Restore Complete ===${NC}"
