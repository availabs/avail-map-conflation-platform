/*
  CONSTRAINTs: 
    0. Cannot trim TMPathInternalEdges start or end
    1. Cannot trim away all ChosenMatches for a TMPathBoundaryEdge.

      E.G.:

        For the case of the forward direction,
          for the TMPath's 1st TMPathEdge,
            we must keep the ChosenMatch that connects with
              the first ChosenMatch of the TMPath's 2nd TMPathEdge.
*/
BEGIN;

DROP TABLE IF EXISTS paths_last_edge_idx ;
DROP TABLE IF EXISTS disputed_chosen_match_trimmability ;

CREATE TABLE paths_last_edge_idx (
  path_id             INTEGER PRIMARY KEY,
  last_path_edge_idx  INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO paths_last_edge_idx
  SELECT
      path_id,
      MAX(path_edge_idx) AS last_path_edge_idx
    FROM target_map.target_map_ppg_path_edges
    GROUP BY (path_id)
;


CREATE TABLE disputed_chosen_match_trimmability (
    path_id                INTEGER NOT NULL,
    path_edge_idx          INTEGER NOT NULL,
    is_forward             INTEGER NOT NULL,
    edge_shst_match_idx    INTEGER NOT NULL,
    start_trimmable        INTEGER,
    end_trimmable          INTEGER,

    PRIMARY KEY(
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx
    ),

    CHECK(path_id >= 0),
    CHECK(path_edge_idx >= 0),
    CHECK(is_forward BETWEEN 0 AND 1),
    CHECK(edge_shst_match_idx >= 0),
    CHECK(
      ( start_trimmable BETWEEN 0 AND 1 )
      OR
      ( start_trimmable IS NULL )
    ),
    CHECK(
      ( end_trimmable BETWEEN 0 AND 1 )
      OR
      ( end_trimmable IS NULL )
    )

  ) WITHOUT ROWID
;

-- TMPaths with a single TMPathEdge are a special case.
--   We can trim from both the start and the end without breaking TMPath connectivity.
--   However, we SHOULD avoid completely trimming away the TMPathEdge.
--   Therefore, we set the start_trimmable and end_trimmable to NULL to indicate
--     that we do not know the start/end trimmability at this point.
INSERT INTO disputed_chosen_match_trimmability
  SELECT DISTINCT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      NULL AS start_trimmable,
      NULL AS end_trimmable
    FROM target_map_bb.target_map_edge_chosen_matches
      INNER JOIN chosen_match_dispute_claimants
        USING (
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx
        )
      INNER JOIN paths_last_edge_idx
        USING (path_id)
    WHERE ( last_path_edge_idx = 0 ) ; -- TMPaths with a single edge are a special case

INSERT OR IGNORE INTO disputed_chosen_match_trimmability
  -- ChosenMatches for first TMPath in the forward direction
  --   All but the last ChosenMatch for this edge are trimmable at both the start and end.
  --   To keep the TMPathEdge connected to the rest of the TMPath,
  --     the last ChosenMatch for this Edge/Direction is trimmable ONLY at the start.
  SELECT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      1 AS start_trimmable,
      -- All but the last ChosenMatch for the TMPathEdge (keep innermost to TMPath)
      ( row_num > 1 ) AS end_trimmable
    FROM (
      SELECT
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx,
          row_number() OVER win1 as row_num
        FROM target_map_bb.target_map_edge_chosen_matches
          INNER JOIN chosen_match_dispute_claimants
            USING (
              path_id,
              path_edge_idx,
              is_forward,
              edge_shst_match_idx
            )
          INNER JOIN paths_last_edge_idx
            USING (path_id)
        WHERE (
          ( last_path_edge_idx > 0 ) -- TMPaths with a single edge are a special case
          AND
          ( path_edge_idx = 0 ) -- The start edge of the TMPath in the forward direction.
          AND
          ( is_forward )
        )
        WINDOW win1 AS (
          PARTITION BY path_id
          -- Since descending, ChosenMatch adjacent to path_edge_idx = 1 would have row_number = 1
          ORDER BY edge_shst_match_idx DESC 
        )
    )
  UNION
  -- ChosenMatches for first TMPath in the backward direction
  --   All but the first ChosenMatch for this edge are trimmable at both the start and end.
  --   To keep the TMPathEdge connected to the rest of the TMPath,
  --     the first ChosenMatch for this Edge/Direction is trimmable ONLY at the end.
  SELECT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      ( edge_shst_match_idx > 0 ) AS start_trimmable,
      -- All but the last ChosenMatch for the TMPathEdge (keep connected to TMPath)
      1 AS end_trimmable
    FROM target_map_bb.target_map_edge_chosen_matches
      INNER JOIN chosen_match_dispute_claimants
        USING (
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx
        )
      INNER JOIN paths_last_edge_idx
        USING (path_id)
    WHERE (
      ( last_path_edge_idx > 0 ) -- TMPaths with a single edge are a special case
      AND
      ( path_edge_idx = 0 ) -- The last edge of the TMPath in the backward direction.
      AND
      ( NOT is_forward )
    )
  UNION
  -- ChosenMatches for last TMPath in the forward direction
  --   All but the first ChosenMatch for this edge are trimmable at both the start and end.
  --   To keep the TMPathEdge connected to the rest of the TMPath,
  --     the first ChosenMatch for this Edge/Direction is trimmable ONLY at the end.
  SELECT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      -- All but the first ChosenMatch for the TMPathEdge (keep connected to TMPath)
      ( edge_shst_match_idx > 0 ) AS start_trimmable,
      1 AS end_trimmable
    FROM target_map_bb.target_map_edge_chosen_matches
      INNER JOIN chosen_match_dispute_claimants
        USING (
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx
        )
      INNER JOIN paths_last_edge_idx
        USING (path_id)
    WHERE (
      ( last_path_edge_idx > 0 ) -- TMPaths with a single edge are a special case
      AND
      ( path_edge_idx = last_path_edge_idx )
      AND
      ( is_forward )
    )
  UNION
  -- ChosenMatches for last TMPath in the backward direction
  --   All but the first ChosenMatch for this edge are trimmable at both the start and end.
  --   To keep the TMPathEdge connected to the rest of the TMPath,
  --     the last ChosenMatch for this Edge/Direction is trimmable ONLY at the start.
  SELECT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      1 AS start_trimmable,
      -- All but the last ChosenMatch for the TMPathEdge (keep innermost to TMPath)
      ( row_num > 1 ) AS end_trimmable
    FROM (
      SELECT
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx,
          row_number() OVER win1 as row_num
        FROM target_map_bb.target_map_edge_chosen_matches
          INNER JOIN chosen_match_dispute_claimants
            USING (
              path_id,
              path_edge_idx,
              is_forward,
              edge_shst_match_idx
            )
          INNER JOIN paths_last_edge_idx AS b
            USING (path_id)
        WHERE (
          ( last_path_edge_idx > 0 ) -- TMPaths with a single edge are a special case
          AND
          ( path_edge_idx = last_path_edge_idx )
          AND
          ( NOT is_forward )
        )
        WINDOW win1 AS (
          PARTITION BY path_id
          ORDER BY edge_shst_match_idx DESC
        )
    )
;

-- NOTE: Because of the Primary Key Constraint,
--         all inserted above will not be inserted below.
INSERT OR IGNORE INTO disputed_chosen_match_trimmability
  SELECT
      path_id,
      path_edge_idx,
      is_forward,
      edge_shst_match_idx,
      0 AS start_trimmable,
      0 AS end_trimmable
    FROM target_map_bb.target_map_edge_chosen_matches
      INNER JOIN chosen_match_dispute_claimants
        USING (
          path_id,
          path_edge_idx,
          is_forward,
          edge_shst_match_idx
        )
;

COMMIT;
