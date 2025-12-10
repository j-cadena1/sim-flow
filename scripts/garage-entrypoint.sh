#!/bin/sh
# Garage entrypoint with auto-initialization
# Runs initialization on first startup, then starts Garage server
#
# Environment variables:
#   S3_ACCESS_KEY_ID     - Access key ID for the bucket key
#   S3_SECRET_ACCESS_KEY - Secret access key for the bucket key
#   S3_BUCKET_NAME       - Name of the bucket to create (default: sim-rq-attachments)
#   GARAGE_ZONE          - Zone name for layout (default: dc1)
#   GARAGE_CAPACITY      - Storage capacity (default: 10G)
#
# Note: Uses /bin/sh for Alpine compatibility (Garage uses Alpine base image)

set -e

INIT_MARKER="/var/lib/garage/meta/.initialized"
BUCKET_NAME="${S3_BUCKET_NAME:-sim-rq-attachments}"
KEY_NAME="sim-rq-key"
ZONE="${GARAGE_ZONE:-dc1}"
CAPACITY="${GARAGE_CAPACITY:-10G}"

# Start Garage server in background
echo "[garage-init] Starting Garage server..."
/garage server &
GARAGE_PID=$!

# Function to cleanup on exit
cleanup() {
  echo "[garage-init] Shutting down..."
  kill $GARAGE_PID 2>/dev/null || true
  wait $GARAGE_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for Garage admin API to be ready
# Note: /health returns 503 until layout is configured, so we just check connectivity
echo "[garage-init] Waiting for Garage admin API..."
RETRIES=0
MAX_RETRIES=60
until curl -s http://localhost:3903/health > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "[garage-init] ERROR: Garage admin API not ready after ${MAX_RETRIES}s"
    exit 1
  fi
  sleep 1
done
echo "[garage-init] Garage admin API ready"

# Run initialization if not done yet
if [ ! -f "$INIT_MARKER" ]; then
  echo "[garage-init] ========================================="
  echo "[garage-init] First run - initializing Garage cluster"
  echo "[garage-init] ========================================="

  # 1. Configure layout
  echo "[garage-init] Step 1/4: Configuring cluster layout..."
  NODE_ID=$(/garage node id -q 2>/dev/null | head -1)
  if [ -z "$NODE_ID" ]; then
    echo "[garage-init] ERROR: Could not get node ID"
    exit 1
  fi
  echo "[garage-init] Node ID: $NODE_ID"

  /garage layout assign -z "$ZONE" -c "$CAPACITY" "$NODE_ID"
  /garage layout apply --version 1
  echo "[garage-init] Layout configured: zone=$ZONE, capacity=$CAPACITY"

  # 2. Create/import access key
  echo "[garage-init] Step 2/4: Creating access key '$KEY_NAME'..."
  if [ -n "$S3_ACCESS_KEY_ID" ] && [ -n "$S3_SECRET_ACCESS_KEY" ]; then
    # Import key with specified credentials
    if /garage key import -n "$KEY_NAME" --yes "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" > /dev/null 2>&1; then
      echo "[garage-init] Key imported with specified credentials"
      echo "[garage-init] Access Key ID: $S3_ACCESS_KEY_ID"
    else
      # Fallback: create with auto-generated credentials
      echo "[garage-init] WARNING: Could not import key with specified credentials"
      echo "[garage-init] Creating key with auto-generated credentials..."
      /garage key create "$KEY_NAME"
      echo "[garage-init] Key created. Credentials:"
      /garage key info "$KEY_NAME"
      echo "[garage-init] NOTE: Update S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env"
    fi
  else
    /garage key create "$KEY_NAME"
    echo "[garage-init] Key created with auto-generated credentials:"
    /garage key info "$KEY_NAME"
    echo "[garage-init] NOTE: Copy the above credentials to your .env file"
  fi

  # 3. Create bucket
  echo "[garage-init] Step 3/4: Creating bucket '$BUCKET_NAME'..."
  /garage bucket create "$BUCKET_NAME"
  echo "[garage-init] Bucket created"

  # 4. Grant permissions
  echo "[garage-init] Step 4/4: Granting key permissions on bucket..."
  /garage bucket allow --read --write "$BUCKET_NAME" --key "$KEY_NAME"
  echo "[garage-init] Permissions granted: read, write"

  # Mark as initialized
  touch "$INIT_MARKER"
  echo "[garage-init] ========================================="
  echo "[garage-init] Garage initialization complete!"
  echo "[garage-init] Bucket: $BUCKET_NAME"
  echo "[garage-init] Key: $KEY_NAME"
  echo "[garage-init] ========================================="
else
  echo "[garage-init] Garage already initialized (found $INIT_MARKER)"
fi

# Remove trap since we want Garage to keep running
trap - EXIT

# Bring Garage to foreground and wait
echo "[garage-init] Garage server running (PID: $GARAGE_PID)"
wait $GARAGE_PID
