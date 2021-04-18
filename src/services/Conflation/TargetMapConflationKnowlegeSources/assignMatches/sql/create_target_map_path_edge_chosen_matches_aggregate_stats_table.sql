-- Use cases:
--   NPMRDS: Choosing which TargetMapPath's matches to prefer.
--           Case: Northern Blvd in Latham.

-- TODO: Possible metric
--         ChosenMatchShstReference section length (section_end - section_start)
--           compared to AlongTargetMapEdge length (along_edge_end - along_edge_start)
BEGIN;

DROP TABLE IF EXISTS target_map_path_edge_chosen_matches_aggregate_stats;

CREATE TABLE target_map_path_edge_chosen_matches_aggregate_stats (
  path_id                     INTEGER NOT NULL,
  path_edge_idx               INTEGER NOT NULL,
  is_forward                  INTEGER NOT NULL,

  edge_id                     INTEGER NOT NULL,
  target_map_id               TEXT NOT NULL,
  target_map_edge_length      REAL NOT NULL,
  is_unidirectional           INTEGER NOT NULL,

  is_path_first_edge          INTEGER NOT NULL,
  is_path_last_edge           INTEGER NOT NULL,

  total_chosen_matches_len    REAL NOT NULL,

  total_deviance              REAL NOT NULL,

  PRIMARY KEY(
    path_id,
    path_edge_idx,
    is_forward
  )
) WITHOUT ROWID;

CREATE INDEX target_map_path_edge_chosen_matches_aggregate_stats_edge_id_idx
  ON target_map_path_edge_chosen_matches_aggregate_stats( edge_id );

CREATE VIEW target_map_path_edge_chosen_matches_aggregate_stats_view AS
  SELECT
      path_id,
      path_edge_idx,
      is_forward,

      edge_id,
      target_map_id,
      target_map_edge_length,
      is_unidirectional,

      is_path_first_edge,
      is_path_last_edge,

      total_chosen_matches_len,

      total_deviance,

      ( target_map_edge_length - total_chosen_matches_len ) AS total_chosen_matches_len_diff,

      ( total_chosen_matches_len / target_map_edge_length ) AS total_chosen_matches_len_ratio,

      ( total_deviance / total_chosen_matches_len ) AS avg_total_deviance

    FROM target_map_path_edge_chosen_matches_aggregate_stats
;

INSERT INTO target_map_path_edge_chosen_matches_aggregate_stats (
  path_id,
  path_edge_idx,
  is_forward,

  edge_id,
  target_map_id,
  target_map_edge_length,
  is_unidirectional,

  is_path_first_edge,
  is_path_last_edge,

  total_chosen_matches_len,

  total_deviance
)
  SELECT
      path_id,
      path_edge_idx,
      is_forward,

      a.edge_id,
      json_extract(a.properties, '$.targetMapId') AS target_map_id,
      json_extract(a.properties, '$.targetMapEdgeLength') AS target_map_edge_length,
      json_extract(a.properties, '$.isUnidirectional') AS is_unidirectional,

      IIF(
        is_forward,
        ( path_edge_idx = 0 ),
        ( path_edge_idx = c.last_edge_idx )
      ) AS is_path_first_edge,

      IIF(
        is_forward,
        ( path_edge_idx = c.last_edge_idx ),
        ( path_edge_idx = 0 )
      ) AS is_path_last_edge,

      SUM(b.section_end - b.section_start) AS total_chosen_matches_len,

      SUM( b.avg_deviance_km * (b.section_end - b.section_start) ) AS total_deviance

    FROM target_map.target_map_ppg_edges AS a
      INNER JOIN target_map_bb.target_map_edge_chosen_matches AS b
        USING ( edge_id )
      INNER JOIN target_map_path_last_edge_idx AS c
        USING ( path_id )

    GROUP BY
      path_id,
      path_edge_idx,
      edge_id,
      is_forward
;

COMMIT;
