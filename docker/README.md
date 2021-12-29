# avail-map-conflation-platform Docker image

## Why?

- The latest version of node-gdal requires system libraries unavailable to Ubuntu 18.04.
- Installing SpatiaLite 5 is a nightmare and we want to use it for QA, and possibly
  integrate it into the conflation process itself.
