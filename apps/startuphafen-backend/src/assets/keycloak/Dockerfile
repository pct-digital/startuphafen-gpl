FROM quay.io/keycloak/keycloak:26.0.1 as builder

# Enable health and metrics support
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Configure a database vendor
ENV KC_DB=postgres

WORKDIR /opt/keycloak

COPY ./providers/keycloak-extension-bundid-1.0.1-25.0-SNAPSHOT.jar /opt/keycloak/providers
#COPY ./providers/keycloak-bundid-extensions-1.1.0.jar /opt/keycloak/providers

RUN /opt/keycloak/bin/kc.sh build

# If keycloak version gets updated, don't forget to update the tag in docker-compose.yml
FROM quay.io/keycloak/keycloak:26.0.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
