# avail-map-conflation-platform Docker image

## Why?

- The latest version of node-gdal requires system libraries unavailable to Ubuntu 18.04.
- Installing SpatiaLite 5 is a nightmare and we want to use it for QA, and possibly
  integrate it into the conflation process itself.

## Useful Stuff

In litecli,

```sqlite
d.gpkg> .load mod_spatialite.so.7.1.0
Time: 0.037s

d.gpkg> select EnableGpkgMode();
+------------------+
| EnableGpkgMode() |
+------------------+
| <null>           |
+------------------+
1 row in set
Time: 0.008s
```

[Spatialite does not use gpkg_spatial_ref_sys in GPKG mode](https://gis.stackexchange.com/a/412890)

```sh
ogr2ogr -F SQLite -dsco SPATIALITE=YES db.sqlite db.gpkg
```
