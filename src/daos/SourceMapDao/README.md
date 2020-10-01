# SourceMap Database

## OSM

Currently, OSM is loaded into the source_map database
  ONLY to enrich the SharedStreets map metadata.

There MUST be a step that loads OSM into a temporary database using

* spatialite_osm_raw
* spatialite_osm_map
* spatialite_osm_net

We then MUST test SharedStreets map's OSM references,
  and the results of this separate testing step MUST
  be written to the source_map database as `qa_* tables`.

If we know that SharedStreets faithfully represents OSM,
  the SharedStreets metadata can be used in place of OSM data,
  simplifying downstream reasoning/logic/processing.
However, if we determine that SharedStreets does not faithfully
  represent OSM, we will need to load a full representation of
  OSM into the source_map database so that our conflation map
  does represent OSM faithfully.
The current plan is to proceed optimistically.

## TODO

Implement specifying source map entities, such as `--shst_intersections` for
  quicker dev.

Currently, dev can comment out code in
  src/pipeline_transforms/source_map_load/loadSharedStreetsTileset/index.ts.

## Canonical Source Map

This platform should have

* Dao with loader.
  * Should only be called once per generated SourceMap.
  * The SpatiaLite database should be archived as canonical.
  * Reused across conflation runs.

* SourceMap Service
  * Rich service API
    * Routing
    * Spatial queries
    * Web server controllers

## SharedStreets Documentation

* [SharedStreets Core Concepts](https://github.com/sharedstreets/sharedstreets-ref-system#core-concepts)
* [sharedstreets/sharedstreets-types](https://github.com/sharedstreets/sharedstreets-types/blob/master/index.ts)

## Database Constraints

If we are normalizing properties in SharedStreets data types,
  we know that FOREIGN KEY CONSTRAINTs will not fail.
  Therefore, in these cases we create the FOREIGN KEY CONSTRAINTs immediately.

If the FOREIGN KEY REFERENCES are based on the SharedStreets concepts,
  such as LocationReference.intersectionId REFERENCES SharedStreetsIntersection,
  we do not assume the integrity of the input data.
  Therefore, we attempt to add the FOREIGN KEY CONSTRAINTs after loading all tables.
  When adding a constraint fails, we log it.

Once created, this database file MUST be READ-ONLY to ensure cross-conflation consistency.

## Intersections

Is this true?

```SQL
  PRIMARY KEY(shst_intersection_id, shst_reference_id),
```

What happens with loops?
