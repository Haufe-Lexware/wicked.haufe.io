#!/bin/bash

set -e

pm2 kill
docker-compose down -v
