FROM ghcr.io/imputnet/cobalt:11.7.1-a636575@sha256:df14a3b3fe4390d4e1c2d4761ed58981d34aa5fc82d0df2091bab890e7dfaa8b

COPY --chown=node:node --chmod=0555 entrypoint.sh /vidrial-cobalt-entrypoint.sh

ENTRYPOINT ["/vidrial-cobalt-entrypoint.sh"]
CMD ["node", "src/cobalt"]
