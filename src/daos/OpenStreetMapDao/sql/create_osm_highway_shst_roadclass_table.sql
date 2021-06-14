-- https://github.com/sharedstreets/sharedstreets-builder/blob/b543d88372ec425b798cf5112685999a1d9d59cf/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java#L112-L147

BEGIN ;

DROP TABLE IF EXISTS osm.osm_highway_shst_roadclass ;

CREATE TABLE osm.osm_highway_shst_roadclass (
  osm_way_id  INTEGER PRIMARY KEY,
  road_class  INTEGER NOT NULL,

  CHECK (road_class BETWEEN 0 AND 8)
) WITHOUT ROWID ;

DROP INDEX IF EXISTS osm.tmp_osm_ways_road_class_tags_idx ;

CREATE INDEX osm.tmp_osm_ways_road_class_tags_idx
  ON osm_ways (
    LOWER(TRIM(json_extract(tags, '$.highway'))),
    LOWER(TRIM(json_extract(tags, '$.service')))
  ) ;

INSERT INTO osm.osm_highway_shst_roadclass (
  osm_way_id,
  road_class
)
  SELECT
      osm_way_id,
      CASE
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'motorway%'
            THEN 0
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'trunk%'
            THEN 1
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'primary%'
            THEN 2
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'secondary%'
            THEN 3
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'tertiary%'
            THEN 4
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'unclassified%'
            THEN 6
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'residential%'
            THEN 5
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'service%'
            THEN
              CASE
                WHEN (
                    ( LOWER(TRIM(json_extract(tags, '$.service'))) LIKE 'parking%' )
                    OR
                    ( LOWER(TRIM(json_extract(tags, '$.service'))) LIKE 'driveway%' )
                    OR
                    ( LOWER(TRIM(json_extract(tags, '$.service'))) LIKE 'drive-through%' )
                  ) THEN 8
                ELSE 7
              END
          WHEN LOWER(TRIM(json_extract(tags, '$.highway'))) LIKE 'living_street%'
            THEN 5
          ELSE 8
      END
    FROM osm.osm_ways
    WHERE ( NULLIF( LOWER(TRIM(json_extract(tags, '$.highway'))), '' ) IS NOT NULL )
    ORDER BY osm_way_id
;

DROP INDEX osm.tmp_osm_ways_road_class_tags_idx ;

COMMIT ;
