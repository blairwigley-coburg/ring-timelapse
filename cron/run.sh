#!/bin/sh

# Default schedules can be overridden via environment variables at container run
: "${CRON_SCHEDULE:=*/15 * * * *}"
# CRON_SCHEDULE_TIMELAPSE is optional; leave empty to disable

# Write the crontab entries based on environment variables so runtime changes apply
{
  echo "$CRON_SCHEDULE cd /app && npm run snapshot"
  [ -n "$CRON_SCHEDULE_TIMELAPSE" ] && echo "$CRON_SCHEDULE_TIMELAPSE cd /app && npm run timelapse"
} > /etc/crontabs/root

# Ensure cron log exists
touch /var/log/cron.log

# Start cron and follow the log
crond -L /var/log/cron.log
tail -f /var/log/cron.log