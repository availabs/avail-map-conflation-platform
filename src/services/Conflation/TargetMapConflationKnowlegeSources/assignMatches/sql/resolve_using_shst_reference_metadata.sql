/*
  > \d chosen_match_unresolved_disputes
  +-----+------------------------+---------+---------+------------+----+
  | cid | name                   | type    | notnull | dflt_value | pk |
  +-----+------------------------+---------+---------+------------+----+
  | 0   | dispute_id             | INTEGER | 0       | <null>     | 0  |
  | 1   | shst_geometry_id       | TEXT    | 0       | <null>     | 0  |
  | 2   | shst_reference_id      | TEXT    | 0       | <null>     | 0  |
  | 3   | disputed_section_start | REAL    | 0       | <null>     | 0  |
  | 4   | disputed_section_end   | REAL    | 0       | <null>     | 0  |
  | 5   | path_id                | INTEGER | 0       | <null>     | 0  |
  | 6   | path_edge_idx          | INTEGER | 0       | <null>     | 0  |
  | 7   | edge_id                | INTEGER | 0       | <null>     | 0  |
  | 8   | is_forward             | INTEGER | 0       | <null>     | 0  |
  | 9   | edge_shst_match_idx    | INTEGER | 0       | <null>     | 0  |
  | 10  | section_start          | REAL    | 0       | <null>     | 0  |
  | 11  | section_end            | REAL    | 0       | <null>     | 0  |
  +-----+------------------------+---------+---------+------------+----+
*/

BEGIN;

CREATE TABLE test_unresolved_claimant_reverse_dir AS
  SELECT
      c.*
    FROM assigned_matches_view AS a
      INNER JOIN source_map.shst_geometries AS b
        ON ( a.shst_reference_id = b.forward_reference_id )
      INNER JOIN chosen_match_unresolved_disputes AS c
        ON (
          ( a.edge_id = c.edge_id )
          AND
          ( NOT ( a.is_forward = c.is_forward ) )
          AND
          ( b.back_reference_id = c.shst_reference_id )
        )
    -- TODO:
    --       Verify assigned overlaps disputed
    --       Verify that only a single edge is assigned the reverse dir of disputed
    --       Assign the reverse dir.
;

COMMIT;
