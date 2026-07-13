# BROKEDEV.GAMES public studio site

This directory is the sanitized public surface for brokedev.games. It contains no
unreleased game characters, private game source, wallet files, credentials, or
internal infrastructure.

## Local preview

~~~powershell
cd Y:/work/tamagotchi-sol/website
npm test
npm run build
npm run preview
~~~

Open http://localhost:8130/.

## Content map

- index.html: accessible interface, public copy, project status, and tools markup.
- app.js: interface state, input routing, audio, panels, and public tool logic.
- experience.js: WebGL world, camera, visitor drone, nodes, and collectibles.
- arcade.js: self-contained public arcade simulations.
- styles.css: complete HUD, panel, fallback, and responsive visual system.
- og.png: social preview image.
- dist/: generated allowlisted deployment artifact.

Edit the panel copy in index.html and the world node map in experience.js to update
public content. Do not describe unreleased work as shipped. Keep story and project
gameplay details classified until the operator approves a reveal.
