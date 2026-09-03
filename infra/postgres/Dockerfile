# Postgres 18 with both extensions this project needs.
#
# No published image ships PostGIS and pgvector together, so this adds pgvector
# on top of a PostGIS image.
#
# The base is `imresamu/postgis`, the community multi-arch build, rather than
# the official `postgis/postgis`: the official one is amd64 only, which means
# emulation and a slow database on an Apple Silicon development machine. One
# image therefore serves both an arm64 laptop and an amd64 server.
ARG POSTGIS_IMAGE=imresamu/postgis:18-3.6-bookworm
FROM ${POSTGIS_IMAGE}

ARG PG_MAJOR=18
RUN apt-get update \
    && apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR}-pgvector" \
    && rm -rf /var/lib/apt/lists/*
