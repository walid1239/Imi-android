FROM debian:bookworm-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends coturn gettext-base ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY turnserver.conf /etc/coturn/turnserver.conf.template
COPY entrypoint.sh /usr/local/bin/imi-coturn-entrypoint
RUN chmod 0755 /usr/local/bin/imi-coturn-entrypoint

EXPOSE 3478/udp 3478/tcp
ENTRYPOINT ["/usr/local/bin/imi-coturn-entrypoint"]
