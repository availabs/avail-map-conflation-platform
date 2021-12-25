BEGIN;

DROP TABLE IF EXISTS tmp_assigned_reverse_dir_disputed ;
DROP TABLE IF EXISTS tmp_resolvable_disputes ;

CREATE TABLE tmp_assigned_reverse_dir_disputed
  AS
    SELECT DISTINCT
        a.*
      FROM chosen_match_unresolved_disputes AS a
        INNER JOIN shst_reference_metadata AS b
          USING (shst_reference_id)
        INNER JOIN assigned_matches_view AS c
          ON (
            ( a.edge_id = c.edge_id )
            AND
            ( b.reverse_shst_reference_id = c.shst_reference_id )
            AND
            (
              ( a.section_start < ( (b.shst_ref_length - c.section_start) ) )
              AND
              ( ( (b.shst_ref_length - c.section_end) ) < a.section_end )
            )
          )
;


-- FIXME: Handle non-overlapping
CREATE TABLE tmp_resolvable_disputes
  AS
    SELECT
        dispute_id
      FROM tmp_assigned_reverse_dir_disputed
      GROUP BY dispute_id
      HAVING COUNT(1) = 1 ;

DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE (dispute_id, edge_id) NOT IN (
    SELECT
        dispute_id,
        edge_id
      FROM tmp_assigned_reverse_dir_disputed
        INNER JOIN tmp_resolvable_disputes
          USING (dispute_id)
  ) ;

--  DROP TABLE tmp_assigned_reverse_dir_disputed ;
--  DROP TABLE tmp_resolvable_disputes ;

COMMIT;
