# Database Migrations

The database schema has been consolidated into `../init.sql`.

## For Fresh Installations
The `init.sql` file contains the complete schema and will be automatically run when the database container starts with an empty volume.

## For Existing Databases
If you need to apply changes to an existing database, create a new migration file here with the format:
```
YYYYMMDD_description.sql
```

Then apply it manually:
```bash
docker exec simrq-db psql -U "sim-rq_user" -d "sim-rq" -f /docker-entrypoint-initdb.d/migrations/YYYYMMDD_description.sql
```

## Archive
The `archive/` directory contains the original incremental migrations for historical reference. These are no longer needed for fresh installations.
