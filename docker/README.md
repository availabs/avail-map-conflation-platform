# avail-map-conflation-platform Docker image

```sh
./build
```

Note: You can change the TAG variable atop the _./build_ script.

## Why?

- The latest version of node-gdal requires system libraries unavailable to
  Ubuntu 18.04.
- Installing SpatiaLite 5 is a nightmare and we want to use it for QA--and possibly
  integrate it into the conflation process itself if it proves itself worth the trouble.
