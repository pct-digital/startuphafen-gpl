FROM quay.io/keycloak/keycloak:26.1.2 as builder

# Enable health and metrics support
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Configure a database vendor
ENV KC_DB=postgres

WORKDIR /opt/keycloak

RUN /opt/keycloak/bin/kc.sh build

# If keycloak version gets updated, don't forget to update the tag in docker-compose.yml
FROM quay.io/keycloak/keycloak:26.1.2
COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
