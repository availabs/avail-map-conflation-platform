/*
-- RoadClass Criteria: https://github.com/sharedstreets/sharedstreets-builder/blob/b543d88372ec425b798cf5112685999a1d9d59cf/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java#L109-L147

RoadClass enum: https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L33-L44

export enum RoadClass {
  Motorway = 0,
  Trunk = 1,
  Primary = 2,
  Secondary = 3,
  Tertiary = 4,
  Residential = 5,
  Unclassified = 6,
  Service = 7,
  Other = 8,
}

OneWay Criteria: https://github.com/sharedstreets/sharedstreets-builder/blob/b543d88372ec425b798cf5112685999a1d9d59cf/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java#L157-L183

NOTE: FormOfWay is a ShstReference property. We are adding it Ways to facilitate joining with ShstReferences.

FormOfWay Criteria: https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsReference.java#L289-L328

FormOfWay enum: https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L173-L186

export enum FormOfWay {
  Undefined = 0,
  Motorway = 1,
  MultipleCarriageway = 2,
  SingleCarriageway = 3,
  Roundabout = 4,
  TrafficSquare = 5,
  SlipRoad = 6,
  Other = 7,
}

*/

BEGIN ;

DROP TABLE IF EXISTS osm.osm_roadways_metadata ;

CREATE TABLE osm.osm_roadways_metadata (
  osm_way_id      INTEGER PRIMARY KEY,
  road_class      TEXT NOT NULL,
  form_of_way     TEXT NOT NULL,
  one_way         INTEGER NOT NULL,
  roundabout      INTEGER NOT NULL,
  link            INTEGER NOT NULL,
  road_name       TEXT,
  road_alt_name   TEXT,
  road_number     TEXT,

  routes_names    TEXT, -- JSON array
  routes_numbers  TEXT, -- JSON array

  CHECK (
    road_class IN (
      'Motorway',
      'Trunk',
      'Primary',
      'Secondary',
      'Tertiary',
      'Residential',
      'Unclassified',
      'Service',
      'Other'
    )
  ),

  CHECK (
    form_of_way IN (
      'Undefined',
      'Motorway',
      'MultipleCarriageway',
      'SingleCarriageway',
      'Roundabout',
      'TrafficSquare',
      'SlipRoad',
      'Other'
    )
  ),

  CHECK (one_way BETWEEN 0 AND 1),
  CHECK (roundabout BETWEEN 0 AND 1),
  CHECK (link BETWEEN 0 AND 1)
  
  --  CHECK (
    --  ( routes_names IS NULL )
    --  OR
    --  ( json_array_length(routes_names) > 1 )
  --  ),

  --  CHECK (
    --  ( routes_numbers IS NULL )
    --  OR
    --  ( json_array_length(routes_numbers) > 1 )
  --  )

) WITHOUT ROWID ;

INSERT INTO osm.osm_roadways_metadata (
  osm_way_id,
  road_class,
  form_of_way,
  one_way,
  roundabout,
  link,
  road_name,
  road_alt_name,
  road_number,
  routes_names,
  routes_numbers
)
  SELECT
      osm_way_id, 
      road_class,

      CASE
        WHEN link
          THEN 'SlipRoad'
        WHEN roundabout
          THEN 'Roundabout'
        WHEN road_class = 'Motorway'
          THEN 'Motorway'
        WHEN ( ( road_class IN ('Trunk', 'Primary') ) AND ( one_way ) )
          THEN 'MultipleCarriageway'
        WHEN road_class IN (
            'Trunk',
            'Primary',
            'Secondary',
            'Tertiary',
            'Residential',
            'Unclassified'
          ) THEN 'SingleCarriageway'
        ELSE 'Other'
      END AS form_of_way,

      one_way,
      roundabout,
      link,
      road_name,
      road_alt_name,
      road_number,
      routes_names,
      routes_numbers
    FROM (
      SELECT
          osm_way_id,

          CASE
            WHEN highway LIKE 'motorway%'
              THEN 'Motorway'
            WHEN highway LIKE 'trunk%'
              THEN 'Trunk'
            WHEN highway LIKE 'primary%'
              THEN 'Primary'
            WHEN highway LIKE 'secondary%'
              THEN 'Secondary'
            WHEN highway LIKE 'tertiary%'
              THEN 'Tertiary'
            WHEN highway LIKE 'unclassified%'
              THEN 'Unclassified'
            WHEN highway LIKE 'residential%'
              THEN 'Residential'
            WHEN highway LIKE 'service%'
              THEN
                CASE
                  WHEN (
                      ( service LIKE 'parking%' )
                      OR
                      ( service LIKE 'driveway%' )
                      OR
                      ( service LIKE 'drive-through%' )
                    ) THEN 'Other'
                  ELSE 'Service'
                END
            WHEN highway LIKE 'living_street%'
              THEN 'Residential'
            ELSE 'Other'
          END AS road_class,

          CASE
            WHEN oneway IN ('yes', 1, '1', 'true')
              THEN 1
            WHEN oneway IN ('no', 0, '0', 'false')
              THEN 0
            WHEN highway = 'motorway'
              THEN 1
            WHEN junction = 'roundabout'
              THEN 1
            ELSE 0
          END AS one_way,

          IFNULL( junction = 'roundabout', 0 ) AS roundabout,

          IFNULL( highway LIKE '%_link', 0 ) AS link,

          road_name,
          road_alt_name,
          road_number,

          routes_names,
          routes_numbers

        FROM (
          SELECT
              osm_way_id,
              LOWER(TRIM(json_extract(tags, '$.highway'))) AS highway,
              LOWER(TRIM(json_extract(tags, '$.service'))) AS service,
              LOWER(TRIM(json_extract(tags, '$.oneway'))) AS oneway,
              LOWER(TRIM(json_extract(tags, '$.junction'))) AS junction,

              NULLIF(TRIM(json_extract(tags, '$.name')), '') AS road_name,

              NULLIF(TRIM(json_extract(tags, '$.alt_name')), '') AS road_alt_name,

              NULLIF(TRIM(json_extract(tags, '$.ref')), '') AS road_number
            FROM osm.osm_ways
            WHERE ( NULLIF( LOWER(TRIM(json_extract(tags, '$.highway'))), '' ) IS NOT NULL )
        ) AS a LEFT OUTER JOIN (
          SELECT
              osm_way_id,
              json_array_lex_sort(
                NULLIF(
                  json_group_array(
                    DISTINCT y.name
                  ) FILTER ( WHERE y.name IS NOT NULL ),
                  json_array()
                )
              ) AS routes_names,
              json_array_lex_sort(
                NULLIF(
                  json_group_array(
                    DISTINCT COALESCE(y.network || ' ', '') || y.ref
                  ) FILTER ( WHERE y.ref IS NOT NULL ),
                  json_array()
                )
              ) AS routes_numbers
            FROM osm.osm_roadway_routes_hierarchy AS x
              INNER JOIN osm.osm_routes_metadata AS y
                USING (osm_route_id)
            GROUP BY osm_way_id
        ) AS b USING ( osm_way_id)
    )
    ORDER BY osm_way_id
;

COMMIT ;
