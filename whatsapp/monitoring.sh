#!/bin/sh
set -e
cd "${0%/*}"

# If monitoring failed before, do not run until it has recovered
if [ -f "monitoring-failed" ]
then
    echo "Monitoring previously failed, exiting"
    exit
fi

# Read configuration file
config="$(cat config.json)"
webhook_url="https://discord.com/api/webhooks/$(echo $config | jq -r .reporting.id)/$(echo $config | jq -r .reporting.token)"
user_id="$(echo $config | jq -r .reporting.user)"

# Reports an anomaly with the service and prevents further checks
report() {
    echo "$1"
    curl -H "Content-Type: application/json" -X POST -d "{\"content\": \"$1 <@$user_id>\"}" $webhook_url
    touch monitoring-failed
}

# Get service PID
pid="$(systemctl status whatsapp | grep "Main PID:" | cut -d ":" -f 2 | cut -d " " -f 2)"

# If there is only one process, something is wrong
if [ -z "$(systemctl status whatsapp | grep puppeteer)" ]
then
    report "Puppeteer is not running!"
    touch monitoring-failed
fi

# Request information from service to check whether it's working
kill -USR2 "$pid"
sleep 5s
if [ -f "monitoring.txt" ]
then
    if [ ! -s "monitoring.txt" ]
    then
        report "Monitoring file is empty."
    fi
    rm monitoring.txt
else
    report "Monitoring file does not exist."
fi

echo "Monitoring finished."
