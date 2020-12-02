/*
> Path Property Graph model.
>
> G-CORE treats paths as first-class citizens.  This means that paths are outputs
> of certain queries. The fact that the language must be closed implies that
> paths must be part of the graph data model. This leads to a principled change
> of the data model: it extends property graphs with paths. That is, in a graph,
> there is also a (possibly empty) collection of paths; where a path is a
> concatenation of existing, adjacent, edges. Further, given that nodes, edges
> and paths are all first-class citizens, paths have identity and can also have
> labels and <property,value> pairs associated with them. This extended property
> graph model, called the Path Property Graph model, is backwards-compatible with
> the property graph model.

Arenas, M. et al. “G-CORE A Core for Future GraphQuery Languages Designed by
the LDBC Graph Query Language Task Force.” (2018).

See: https://www.gqlstandards.org/
*/

-- NOTE: __SCHEMA_QUALIFIER__ replaced with '<attached database>.' or ''

-- Drop all the tables. Because of FOREIGN KEY REFERENCES, order matters.

DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_path_feature_collections ;
DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edge_line_features ;
DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_node_point_features ;

DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edges_target_map_id_idx;
DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_edge_id_idx ;
DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_path_edges_edge_id_idx ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_geopoly_idx ;
DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches_shst_reference_idx ;
DROP INDEX IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_shst_match_id_idx ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_metadata ;

DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edge_id_to_target_map_id;

DROP VIEW IF EXISTS __SCHEMA_QUALIFIER__target_map_edge_chosen_matches ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_paths_edge_optimal_matches ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_nodes_geopoly_idx;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edges_geopoly_idx;

DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_node_labels ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edge_labels ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_path_labels ;

DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_path_edges ;
DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_paths;

DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_edges;

DROP TABLE IF EXISTS __SCHEMA_QUALIFIER__target_map_ppg_nodes;

-- ========== Target Map Nodes ==========

CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_nodes (
    node_id      INTEGER PRIMARY KEY AUTOINCREMENT,

    lon          REAL NOT NULL,
    lat          REAL NOT NULL,

    properties   TEXT,

    UNIQUE (lon, lat),
    CHECK(properties IS NULL OR json_valid(properties))
) ;

-- Using JOIN table so we can enforce integrity constraint.

CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_node_labels (
  node_id   INTEGER NOT NULL,
  label     TEXT NOT NULL,

  PRIMARY KEY(node_id, label),

  FOREIGN KEY(node_id)
    REFERENCES target_map_ppg_nodes(node_id)
    ON DELETE CASCADE
  -- FOREIGN KEY(label)
  --   REFERENCES target_map_ppg_valid_node_labels(label)
  --   ON DELETE CASCADE
) WITHOUT ROWID;

CREATE VIEW __SCHEMA_QUALIFIER__target_map_ppg_node_point_features
  AS
    SELECT
        json_set( -- Set $.id
          json_set( -- Set $.properties.labels
            json_set( -- Set $.properties
              json_set( -- Set $.geometry.coordinates
                json('
                  {
                    "type": "Feature",
                    "properties": null,
                    "geometry": {
                      "type": "Point",
                      "coordinates": null
                    }
                  }
                '),
                '$.geometry.coordinates',
                json_array(lon, lat)
              ),
              '$.properties',
              IFNULL(
                json(properties),
                json('{}')
              )
            ),
            '$.properties.labels',
            IFNULL(
              json_group_array(
                label
              ),
              json('[]')
            )
          ),
          '$.id',
          node_id
        ) as feature
    FROM target_map_ppg_nodes as a
      LEFT OUTER JOIN target_map_ppg_node_labels as b
      USING(node_id)
;

-- Create a spatial index on the nodes

CREATE VIRTUAL TABLE __SCHEMA_QUALIFIER__target_map_ppg_nodes_geopoly_idx
  USING geopoly(node_id) ;

-- ========== Target Map Edges ==========

-- To facilitate topological queries over the road network,
--   we records the from_node and end_node in their own columns.
--   Internal nodes, of Geospatial interest, are in the feature.geometry.coordinates.
--   The target_map_ppg_edges_geopoly_idx facilitates Geospatial queries.
CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_edges (
    edge_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node_id   INTEGER NOT NULL,
    to_node_id     INTEGER NOT NULL,
    geoprox_key    TEXT NOT NULL,
    properties     TEXT NOT NULL, -- JSON
    coordinates    TEXT NOT NULL, -- GeoJSON LineString or MultiLineString coordinates

    -- We want node deletions to require explicitly deleting edges, so no CASCADEs.
    FOREIGN KEY(from_node_id)
      REFERENCES target_map_ppg_nodes(node_id),

    FOREIGN KEY(to_node_id)
      REFERENCES target_map_ppg_nodes(node_id),

    CHECK(json_valid(properties)),

    -- For SinglePointOfTruth,
    --   targetMapId, targetMapMesoId, targetMapMacroId
    --   MUST be set using target_map_ppg_paths id and label
    CHECK(json_extract(properties, '$.targetMapId') IS NOT NULL),
    CHECK(json_extract(properties, '$.targetMapMesoId') IS NULL),
    CHECK(json_extract(properties, '$.targetMapMacroId') IS NULL),

    -- GeoJSON integrity constraints for edge features
    CHECK(json_valid(coordinates)),
    -- If LineString, must have at least two coordinates.
    -- If MultiLineString, must have at least two LineString coordinate arrays.
    CHECK(json_array_length(coordinates) >= 2),
    CHECK(
      ( -- LineString
        ( json_type(coordinates, '$[0][0]') = 'real' )
        AND
        ( json_type(coordinates, '$[#-1][#-1]') = 'real' )
      )
      OR
      ( -- MultiLineString
        ( json_type(coordinates, '$[0][0][0]') = 'real' )
        AND
        ( json_type(coordinates, '$[#-1][#-1][#-1]') = 'real' )
      )
    )
) ;

CREATE UNIQUE INDEX __SCHEMA_QUALIFIER__target_map_ppg_edges_target_map_id_idx
  ON target_map_ppg_edges (json_extract(properties, '$.targetMapId'));

-- Using JOIN table so we can enforce integrity constraint.

CREATE VIEW __SCHEMA_QUALIFIER__target_map_ppg_edge_id_to_target_map_id
  AS
    SELECT
        edge_id,
        json_extract(properties, '$.targetMapId') AS target_map_id
      FROM target_map_ppg_edges ;


CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_edge_labels (
  edge_id   INTEGER NOT NULL,
  label     TEXT NOT NULL,

  PRIMARY KEY(edge_id, label),

  FOREIGN KEY(edge_id)
    REFERENCES target_map_ppg_edges(edge_id)
    ON DELETE CASCADE
) WITHOUT ROWID;

CREATE VIEW __SCHEMA_QUALIFIER__target_map_ppg_edge_line_features
  AS
    SELECT
        a.edge_id,
        json_extract(a.properties, '$.targetMapId') as target_map_id,
        a.geoprox_key,
        json_set( -- Set $.id
          json_set( -- Set $.properties.labels
            json_set( -- Set $.properties
              json_object(
                'type',
                'Feature',
                -- properties set by outer json_set
                'geometry',
                json_object(
                  'type',
                  CASE json_type(coordinates, '$[0][0]')
                    WHEN 'real'  THEN 'LineString'
                    WHEN 'array' THEN 'MultiLineString'
                  END,
                  'coordinates',
                  json(coordinates)
                )
              ),
              '$.properties',
              IFNULL(
                json(properties),
                json('{}')
              )
            ), -- End Set $.properties
            '$.properties.labels',
            IFNULL(
              json_group_array(
                label
              ),
              json('[]')
            )
          ), -- End Set $.properties.labels
          '$.id',
          edge_id
        ) as feature -- End Set $.is
    FROM target_map_ppg_edges as a
      LEFT OUTER JOIN target_map_ppg_edge_labels as b
      USING(edge_id)
      GROUP BY a.edge_id
;

-- Create a spatial index on the edges

CREATE VIRTUAL TABLE __SCHEMA_QUALIFIER__target_map_ppg_edges_geopoly_idx
  USING geopoly(edge_id) ;

-- ========== Target Map Paths ==========

-- To facilitate topological queries over the road network,
--   we records the from_node and end_node in their own columns.
--   Internal nodes, of Geospatial interest, are in the feature.geometry.coordinates.
--   The __SCHEMA_QUALIFIER__target_map_ppg_paths_geopoly_idx facilitates Geospatial queries.
CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_paths (
    path_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    properties     TEXT, -- JSON

    CHECK(properties IS NULL OR json_valid(properties))
) ;

-- Using JOIN table so we can enforce integrity constraint.

CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_path_labels (
  path_id   INTEGER NOT NULL,
  label     TEXT NOT NULL,

  PRIMARY KEY(path_id, label),

  FOREIGN KEY(path_id)
    REFERENCES target_map_ppg_paths(path_id)
    ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE __SCHEMA_QUALIFIER__target_map_ppg_path_edges (
  path_id         INTEGER NOT NULL,
  path_edge_idx   INTEGER NOT NULL,
  edge_id         INTEGER NOT NULL,

  PRIMARY KEY(path_id, path_edge_idx),

  FOREIGN KEY(path_id)
    REFERENCES target_map_ppg_paths(path_id)
    ON DELETE CASCADE,
  FOREIGN KEY(edge_id)
    REFERENCES target_map_ppg_edges(edge_id)
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_ppg_path_edges_edge_id_idx
  ON target_map_ppg_path_edges (edge_id) ;

-- See spike/sqlite_ordered_arrays/test.sql for an example of creating an array recursively

CREATE VIEW __SCHEMA_QUALIFIER__target_map_ppg_path_feature_collections
  AS
    SELECT
      path_id,
      json_object(
        'type',
        'FeatureCollection',
        'features',
        json_group_array(
          json_patch(
            ppg_edges.feature,
            json_object(
              'properties',
              json_object(
                'pathId',
                ppg_paths.path_id,
                'pathIdx',
                ppg_paths.path_edge_idx,
                'edgeId',
                ppg_edges.edge_id
              )
            )
          )
        )
      ) as feature_collection
    FROM target_map_ppg_path_edges AS ppg_paths
      INNER JOIN target_map_ppg_edge_line_features AS ppg_edges
      USING(edge_id)
    GROUP BY path_id
;

CREATE TABLE IF NOT EXISTS __SCHEMA_QUALIFIER__target_map_edges_shst_matches (
  shst_match_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  edge_id         INTEGER NOT NULL,
  shst_reference  TEXT NOT NULL,
  section_start   REAL NOT NULL,
  section_end     REAL NOT NULL,
  feature_len_km  REAL NOT NULL,
  feature         TEXT NOT NULL,

  UNIQUE (edge_id, shst_reference, section_start, section_end),

  CHECK(section_start >= 0),
  CHECK(section_end > 0),
  CHECK(feature_len_km > 0),

  CHECK(json_valid(feature)),

  FOREIGN KEY(edge_id)
    REFERENCES target_map_ppg_edges(edge_id)
    ON DELETE CASCADE
) ;

CREATE VIRTUAL TABLE __SCHEMA_QUALIFIER__target_map_edges_shst_matches_geopoly_idx
  USING geopoly(shst_match_id) ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_edges_shst_matches_edge_id_idx
  ON target_map_edges_shst_matches(edge_id) ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_edges_shst_matches_shst_reference_idx
  ON target_map_edges_shst_matches(shst_reference) ;


-- NOTE: This table should be used to CASCADE DELETEs to target_map_paths_shst_match_chains.
CREATE TABLE IF NOT EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_metadata (
  path_id   INTEGER NOT NULL PRIMARY KEY,
  metadata  TEXT NOT NULL,

  CHECK(json_valid(metadata))
) WITHOUT ROWID ;

CREATE TABLE IF NOT EXISTS __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains (
  -- Foreign Key referencing the target_map_ppg_path_edge table.
  path_id              INTEGER NOT NULL,
  path_edge_idx        INTEGER NOT NULL,

  -- Each path edge can have mutiple matches chains (when there are spatial gaps in matches).
  --  * edge_chain_idx represents the topological ordering of match chains along the edge.
  --  * edge_chain_link_idx represents the ordering of matches withing the matches chain.
  edge_chain_idx       INTEGER NOT NULL,
  edge_chain_link_idx  INTEGER NOT NULL,

  -- Foreign Key referencing the target_map_edges_shst_matches table.
  shst_match_id        INTEGER NOT NULL,

  PRIMARY KEY (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx),

  FOREIGN KEY(path_id)
    REFERENCES target_map_paths_shst_match_chains_metadata(path_id)
    ON DELETE CASCADE,

  FOREIGN KEY(path_id, path_edge_idx)
    REFERENCES target_map_ppg_path_edges(path_id, path_edge_idx)
    ON DELETE CASCADE,

  FOREIGN KEY(shst_match_id)
    REFERENCES target_map_edges_shst_matches(shst_match_id)
    ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE INDEX __SCHEMA_QUALIFIER__target_map_paths_shst_match_chains_shst_match_id_idx
  ON target_map_paths_shst_match_chains (shst_match_id) ;

CREATE TABLE __SCHEMA_QUALIFIER__target_map_paths_edge_optimal_matches (
  path_id               INTEGER NOT NULL,
  path_edge_idx         INTEGER NOT NULL,
  edge_chain_idx        INTEGER NOT NULL,
  edge_chain_link_idx   INTEGER NOT NULL,

  PRIMARY KEY (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx),

  FOREIGN KEY(
      path_id,
      path_edge_idx,
      edge_chain_idx,
      edge_chain_link_idx
    )
    REFERENCES target_map_paths_shst_match_chains(
      path_id,
      path_edge_idx,
      edge_chain_idx,
      edge_chain_link_idx
    ) ON DELETE CASCADE
) WITHOUT ROWID ;

CREATE VIEW __SCHEMA_QUALIFIER__target_map_edge_chosen_matches
  AS
    SELECT
        path_id,
        path_edge_idx,
        edge_id,
        edge_chain_idx,
        edge_chain_link_idx,
        shst_match_id,
        shst_reference,
        section_start,
        section_end,
        feature_len_km,
        feature
      FROM target_map_paths_edge_optimal_matches
        INNER JOIN target_map_paths_shst_match_chains
          USING (path_id, path_edge_idx, edge_chain_idx, edge_chain_link_idx)
        INNER JOIN target_map_edges_shst_matches
          USING (shst_match_id) ;
