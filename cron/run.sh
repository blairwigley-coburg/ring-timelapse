touch /var/log/cron.log
#!/bin/sh

# Default schedules can be overridden via environment variables at container run
: "${CRON_SCHEDULE:=*/15 * * * *}"
# CRON_SCHEDULE_TIMELAPSE is optional; leave empty to disable

# Helper to trim surrounding double quotes from a variable
trim_quotes() {
  v="$1"
  v="${v#\"}"
  v="${v%\"}"
  printf "%s" "$v"
}

CS="$(trim_quotes "$CRON_SCHEDULE")"
CTS="$(trim_quotes "$CRON_SCHEDULE_TIMELAPSE")"

echo "Writing crontab entries: snapshot='$CS' timelapse='$CTS'"

# Write the crontab entries based on sanitized environment variables
TZ_VAL="$(trim_quotes "$TZ")"
# Export TZ so the cron daemon and spawned jobs inherit it
if [ -n "$TZ_VAL" ]; then
  export TZ="$TZ_VAL"
fi

{
  [ -n "$TZ_VAL" ] && echo "TZ=$TZ_VAL"
  echo "$CS cd /app && npm run snapshot"
  [ -n "$CTS" ] && echo "$CTS cd /app && npm run timelapse"
} > /etc/crontabs/root

# Ensure cron log exists
touch /var/log/cron.log

# Start cron and follow the log
crond -L /var/log/cron.log
tail -f /var/log/cron.log