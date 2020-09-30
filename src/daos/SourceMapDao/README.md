# SourceMap Database

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
