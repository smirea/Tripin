#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $DIR;
TIMESTAMP=$(stat -c%Y server.js);
node server &
PID=$!

while true; do
    NEW_TIMESTAMP=$(stat -c%Y server.js);
    if [ $NEW_TIMESTAMP != $TIMESTAMP ]; then
        kill $PID;
        TIMESTAMP=$(stat -c%Y server.js);
        node server &
        PID=$!
    fi
    sleep 0.2
done
