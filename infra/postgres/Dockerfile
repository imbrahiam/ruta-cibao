# droast global ignore=DF020 reason="Postgres initializes volume ownership as root, then its inherited entrypoint drops to postgres"
# droast global ignore=DF036 reason="the PostGIS base inherits the official Postgres entrypoint and command"
# Postgres 18 with both extensions this project needs.
#
# No published image ships PostGIS and pgvector together, so this adds pgvector
# on top of a PostGIS image.
#
# The base is `imresamu/postgis`, the community multi-arch build, rather than
# the official `postgis/postgis`: the official one is amd64 only, which means
# emulation and a slow database on an Apple Silicon development machine. One
# image therefore serves both an arm64 laptop and an amd64 server.
ARG POSTGIS_IMAGE=imresamu/postgis:18-3.6-bookworm@sha256:b69c48439e08c05127d47ae6ad8a2bb41934ff0161773089759f2f15fb8207d7
FROM ${POSTGIS_IMAGE}

ARG PG_MAJOR=18
ARG PGVECTOR_VERSION=0.8.6-1.pgdg12+2
RUN apt-get update \
    && apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR}-pgvector=${PGVECTOR_VERSION}" \
    && rm -rf /var/lib/apt/lists/*
