# Third-party notice: Cobalt

- Project: Cobalt
- Upstream source: https://github.com/imputnet/cobalt
- Image: `ghcr.io/imputnet/cobalt:11.7.1-a636575`
- Linux/amd64 digest: `sha256:df14a3b3fe4390d4e1c2d4761ed58981d34aa5fc82d0df2091bab890e7dfaa8b`
- License: GNU Affero General Public License v3.0
- License text: https://github.com/imputnet/cobalt/blob/main/LICENSE
- Local modifications: none. Vidrial adds only an external entrypoint that creates the documented API-key configuration before launching the upstream image.

Cobalt runs as a separate service and is accessed over its documented HTTP API. The Vidrial worker does not embed or copy Cobalt source code.
