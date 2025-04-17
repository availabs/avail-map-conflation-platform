BEGIN ;

DROP TABLE IF EXISTS osm.osm_version ;
DROP TABLE IF EXISTS osm.osm_nodes ;
DROP TABLE IF EXISTS osm.osm_ways ;
DROP TABLE IF EXISTS osm.osm_way_node_ids ;

CREATE TABLE osm.osm_version (
  osm_version   TEXT PRIMARY KEY
) ;

CREATE TRIGGER osm.osm_version_insert_trig
  BEFORE INSERT ON osm_version
  BEGIN
    SELECT
      CASE
        WHEN (
          ( SELECT EXISTS ( SELECT 1 FROM osm_nodes ) )
          OR
          ( SELECT EXISTS ( SELECT 1 FROM osm_ways ) )
        ) THEN RAISE (
          FAIL,
          'The osm_version table CANNOT be modified while the osm_nodes and/or osm_ways tables have data.'
        )
      END;
  END;

CREATE TABLE osm.osm_nodes (
  osm_node_id         INTEGER PRIMARY KEY,
  coord               TEXT, -- JSON Array: [lon, lat]. Using JSON to preserve exact decimal.
  tags                TEXT  -- JSON Array
) WITHOUT ROWID ;

CREATE TABLE osm.osm_ways (
  osm_way_id          INTEGER PRIMARY KEY,
  osm_node_ids        TEXT, -- JSON Array
  tags                TEXT  -- JSON Object
) WITHOUT ROWID ;

CREATE TABLE osm.osm_roadway_features (
  osm_way_id        INTEGER PRIMARY KEY,
  feature           TEXT NOT NULL, --JSON

  CHECK(
    feature->'properties'->>'roadClass' IN (
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

  CHECK(
    feature->'properties'->>'formOfWay' IN (
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

  CHECK(json_type(feature->'properties'->>'oneWay') IN ('true', 'false')),

  CHECK(feature->'geometry'->>'type' = 'LineString'),
  CHECK(json_array_length(feature->'geometry'->'coordinates') >= 2)

) WITHOUT ROWID ;

CREATE TABLE osm.osm_way_node_ids (
  osm_way_id          INTEGER NOT NULL,
  osm_node_idx        INTEGER NOT NULL,
  osm_node_id         INTEGER NOT NULL,

  PRIMARY KEY(osm_way_id, osm_node_idx)
) WITHOUT ROWID ;

CREATE INDEX osm.osm_way_node_id_idx
  ON osm_way_node_ids (osm_node_id)
;

CREATE TABLE osm.osm_route_relations (
  osm_route_id        INTEGER PRIMARY KEY,
  tags                TEXT, -- JSON Object
  members             TEXT, -- JSON Array

  CHECK(
    ( tags IS NULL )
    OR
    ( json_valid(tags) )
  ),

  CHECK(
    ( members IS NULL )
    OR
    ( json_array_length(members) > 1 )
  )
) WITHOUT ROWID ;

DROP TABLE IF EXISTS osm.osm_roadway_features;

CREATE TABLE osm.osm_roadway_features (
  osm_way_id        INTEGER PRIMARY KEY,
  feature           TEXT NOT NULL, --JSON

  CHECK(
    json_extract(feature, '$.properties.roadClass') IN (
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

  CHECK(
    json_extract(feature, '$.properties.formOfWay') IN (
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

  --  CHECK(
    --  json_type(
      --  json_extract(feature, '$.properties.oneWay')
    --  ) IN (0, 1)
  --  ),

  CHECK( json_extract(feature, '$.geometry.type') = 'LineString' ),
  CHECK(
    json_array_length(
      json_extract(feature, '$.geometry.coordinates')
    ) >= 2
  )

) WITHOUT ROWID ;

DROP TABLE IF EXISTS osm.osm_roadway_features_geopoly_idx ;

CREATE VIRTUAL TABLE osm.osm_roadway_features_geopoly_idx
  USING geopoly(osm_way_id) ;

COMMIT;
