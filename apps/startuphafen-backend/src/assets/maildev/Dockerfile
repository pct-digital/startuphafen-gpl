# Basis-Image von Maildev verwenden
FROM maildev/maildev:latest

# Erstelle den Ordner /tmp/maildev mit den gewünschten Rechten
RUN mkdir -p /tmp/maildev && chmod 1777 /tmp/maildev

# Der Standardbefehl bleibt gleich
CMD ["bin/maildev"]
