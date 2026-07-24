#!/usr/bin/env bash
# Provision pilot users with unique passwords from environment
# Usage: PILOT_DEMO_PASSWORD=xxx ./scripts/provision-pilot-users.sh
# Or provide individual passwords:
#   PILOT_ADMIN_PASSWORD=xxx PILOT_MANAGER_PASSWORD=xxx ...

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Read passwords from environment (with defaults for local dev only)
# In production/staging, these MUST be set via secure CI/CD secrets
ADMIN_PASSWORD="${PILOT_ADMIN_PASSWORD:-${PILOT_DEMO_PASSWORD:-}}"
MANAGER_PASSWORD="${PILOT_MANAGER_PASSWORD:-${PILOT_DEMO_PASSWORD:-}}"
EMP1_PASSWORD="${PILOT_EMP1_PASSWORD:-${PILOT_DEMO_PASSWORD:-}}"
EMP2_PASSWORD="${PILOT_EMP2_PASSWORD:-${PILOT_DEMO_PASSWORD:-}}"
EMP3_PASSWORD="${PILOT_EMP3_PASSWORD:-${PILOT_DEMO_PASSWORD:-}}"

# Validate all passwords are set
if [[ -z "$ADMIN_PASSWORD" || -z "$MANAGER_PASSWORD" || -z "$EMP1_PASSWORD" || -z "$EMP2_PASSWORD" || -z "$EMP3_PASSWORD" ]]; then
    echo -e "${RED}Error: All pilot user passwords must be set via environment variables.${NC}"
    echo "Required: PILOT_ADMIN_PASSWORD, PILOT_MANAGER_PASSWORD, PILOT_EMP1_PASSWORD, PILOT_EMP2_PASSWORD, PILOT_EMP3_PASSWORD"
    echo "Or set PILOT_DEMO_PASSWORD for a single shared password (not recommended for production)."
    exit 1
fi

# Warn if using shared password
if [[ "$ADMIN_PASSWORD" == "$MANAGER_PASSWORD" && "$ADMIN_PASSWORD" == "$EMP1_PASSWORD" && "$ADMIN_PASSWORD" == "$EMP2_PASSWORD" && "$ADMIN_PASSWORD" == "$EMP3_PASSWORD" ]]; then
    echo -e "${YELLOW}Warning: All users have the same password. Consider setting individual passwords.${NC}"
fi

# Get Supabase URL and service role key from environment
SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_ROLE_KEY" ]]; then
    echo -e "${RED}Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.${NC}"
    exit 1
fi

echo "Provisioning pilot users..."
echo "Supabase URL: $SUPABASE_URL"

# Function to create a user via Supabase Admin API
create_user() {
    local email="$1"
    local password="$2"
    local display_name="$3"
    local locale="$4"

    local response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${email}\",
            \"password\": \"${password}\",
            \"email_confirm\": true,
            \"user_metadata\": {
                \"display_name\": \"${display_name}\",
                \"preferred_locale\": \"${locale}\"
            }
        }")

    local user_id=$(echo "$response" | jq -r '.id // empty')

    if [[ -n "$user_id" && "$user_id" != "null" ]]; then
        echo -e "${GREEN}✓${NC} Created user: $email (id: $user_id)"
        echo "$user_id"
    else
        # Check if user already exists
        local existing=$(curl -s -X GET "${SUPABASE_URL}/auth/v1/admin/users?email=${email}" \
            -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")
        local existing_id=$(echo "$existing" | jq -r '.users[0].id // empty')
        if [[ -n "$existing_id" ]]; then
            echo -e "${YELLOW}!${NC} User already exists: $email (id: $existing_id)"
            # Update password
            curl -s -X PUT "${SUPABASE_URL}/auth/v1/admin/users/${existing_id}" \
                -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
                -H "Content-Type: application/json" \
                -d "{\"password\": \"${password}\"}" > /dev/null
            echo -e "${GREEN}✓${NC} Updated password for: $email"
            echo "$existing_id"
        else
            echo -e "${RED}✗${NC} Failed to create user: $email"
            echo "$response" | jq .
            exit 1
        fi
    fi
}

# Provision users
echo "Creating pilot users..."

ADMIN_ID=$(create_user "admin@pilot.kuwait-feedback.test" "$ADMIN_PASSWORD" "Sara Al-Mutairi" "en")
MANAGER_ID=$(create_user "manager@pilot.kuwait-feedback.test" "$MANAGER_PASSWORD" "Ahmed Al-Rashid" "ar")
EMP1_ID=$(create_user "employee1@pilot.kuwait-feedback.test" "$EMP1_PASSWORD" "Fatima Al-Ali" "en")
EMP2_ID=$(create_user "employee2@pilot.kuwait-feedback.test" "$EMP2_PASSWORD" "Khalid Al-Sabah" "en")
EMP3_ID=$(create_user "employee3@pilot.kuwait-feedback.test" "$EMP3_PASSWORD" "Nora Al-Kandari" "ar")

echo ""
echo "User IDs:"
echo "  Admin:     $ADMIN_ID"
echo "  Manager:   $MANAGER_ID"
echo "  Employee1: $EMP1_ID"
echo "  Employee2: $EMP2_ID"
echo "  Employee3: $EMP3_ID"
echo ""
echo -e "${GREEN}All pilot users provisioned successfully.${NC}"
echo "Run scripts/pilot-seed.sql to populate organization data."