# Useful Stuff

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

```sh
spatialite_osm_net \
  -o albany-county_new-york-210101.osm.pbf \
  -d alb_net.sqlite
  -T road_net \
  --roads
```

```sh
spatialite_osm_net \
  -o albany-county_new-york-210101.osm.pbf \
  -d alb_net.sqlite \
  -T rail_net \
  --railways
```
