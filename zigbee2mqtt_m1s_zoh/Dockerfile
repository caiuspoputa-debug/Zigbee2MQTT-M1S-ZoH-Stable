ARG BUILD_ARCH
FROM ghcr.io/home-assistant/${BUILD_ARCH}-base:3.24 AS base

ENV LANG=C.UTF-8
ARG BUILD_VERSION
ARG BUILD_ARCH
ARG Z2M_VERSION=2.14.2
ARG ZOH_VERSION=0.2.4-m1s.1

LABEL io.hass.version="${BUILD_VERSION}" \
      io.hass.type="app" \
      io.hass.arch="${BUILD_ARCH}"

RUN apk add --no-cache curl eudev jq nodejs socat tini && \
    curl --version

FROM base AS dependencies_and_build

ARG Z2M_VERSION=2.14.2
ARG ZOH_VERSION=0.2.4-m1s.1

COPY packages/zigbee-on-host-0.2.4-m1s.1.tgz /tmp/zigbee-on-host-0.2.4-m1s.1.tgz

RUN set -eux; \
    apk add --no-cache --virtual .buildtools npm make gcc g++ linux-headers eudev-dev git python3; \
    curl -fsSL -o /app.tar.gz "https://github.com/Koenkk/zigbee2mqtt/archive/${Z2M_VERSION}.tar.gz"; \
    tar xzf /app.tar.gz; \
    rm /app.tar.gz; \
    mv "zigbee2mqtt-${Z2M_VERSION}" /app; \
    mkdir -p /app/dist; \
    printf '%s\n' "${Z2M_VERSION}" > /app/dist/.hash; \
    cd /app; \
    npm install -g "$(jq -r '.packageManager' package.json)"; \
    pnpm install --frozen-lockfile --unsafe-perm; \
    pnpm run build; \
    rm -rf node_modules; \
    pnpm install --frozen-lockfile --no-optional --unsafe-perm --prod; \
    ZOH_DIRS="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/zigbee-on-host')"; \
    ZOH_COUNT="$(printf '%s\n' "${ZOH_DIRS}" | sed '/^$/d' | wc -l | tr -d ' ')"; \
    test "${ZOH_COUNT}" -eq 1; \
    ZOH_DIR="$(printf '%s\n' "${ZOH_DIRS}" | head -n 1)"; \
    rm -rf "${ZOH_DIR:?}/dist"; \
    tar xzf /tmp/zigbee-on-host-0.2.4-m1s.1.tgz -C "${ZOH_DIR}" --strip-components=1; \
    test "$(node -p "require('${ZOH_DIR}/package.json').version")" = "${ZOH_VERSION}"; \
    test "$(grep -c 'Buffer.alloc(127' "${ZOH_DIR}/dist/zigbee/mac.js")" -eq 2; \
    grep -q 'Dropped malformed RCP frame instead of stopping the stack' "${ZOH_DIR}/dist/drivers/ot-rcp-driver.js"; \
    grep -q 'Recovered network state from backup' "${ZOH_DIR}/dist/zigbee-stack/stack-context.js"; \
    printf '%s\n' "${ZOH_VERSION}" > /app/dist/.m1s-zoh-version; \
    find ./node_modules/.pnpm/ -wholename '*/@serialport/bindings-cpp/prebuilds' -type d -exec rm -rf {} +; \
    pnpm rebuild @serialport/bindings-cpp

FROM base AS release

WORKDIR /app

COPY rootfs /
COPY --from=dependencies_and_build /app/node_modules ./node_modules
COPY --from=dependencies_and_build /app/dist ./dist
COPY --from=dependencies_and_build /app/package.json /app/LICENSE /app/index.js ./

RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production

HEALTHCHECK --interval=1m --timeout=3s --start-period=30s --start-interval=3s \
  CMD curl -f http://localhost:8099/

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
