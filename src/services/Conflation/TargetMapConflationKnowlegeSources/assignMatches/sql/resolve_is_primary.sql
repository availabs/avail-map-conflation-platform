-- FIXME: Uses internal fields for NPMRDS RawTargetMapFeatures.
--          MUST extract the isprimary and make it a TargetMapEdge property.

BEGIN;

DROP TABLE IF EXISTS tmp_edge_coords ;
DROP TABLE IF EXISTS tmp_edge_pairs ;

CREATE TABLE tmp_edge_coords
  AS
    SELECT
        edge_id,
        replace(
          replace(
            json_extract(
              feature,
              '$.geometry.coordinates'
            ),
            '[',
            ''
          ),
          ']',
          ''
        ) as coords,
        IFNULL(
          json_extract(
            feature,
            '$.properties.isprimary'
          ),
          1
        ) AS isprimary
      FROM target_map.raw_target_map_features
        INNER JOIN target_map_ppg_edge_id_to_target_map_id
          USING ( target_map_id )
;

CREATE INDEX tmp_edge_coords_idx ON tmp_edge_coords(coords) ;

CREATE TABLE tmp_edge_pairs
  AS
    SELECT
        a.edge_id AS nonprimary_edge_id,
        b.edge_id AS primary_edge_id
      FROM tmp_edge_coords as a
        INNER JOIN tmp_edge_coords as b
          ON (
            ( instr(b.coords, a.coords) )
            OR
            ( instr(a.coords, b.coords) )
          )
        WHERE (
          ( NOT a.isprimary )
          AND
          ( b.isprimary )
        ) ;

INSERT OR IGNORE INTO discovered_knaves (
  shst_reference_id,
  edge_id,
  is_forward,
  section_start,
  section_end
)
  SELECT
      a.shst_reference AS shst_reference_id,
      a.edge_id,
      a.is_forward,
      ROUND(a.section_start, 4) AS section_start,
      ROUND(a.section_end, 4) AS section_end
    FROM target_map_bb.target_map_edge_chosen_matches AS a
      INNER JOIN tmp_edge_pairs AS b
        ON ( a.edge_id = b. nonprimary_edge_id )
;

DELETE FROM chosen_match_unresolved_disputes_claimants
  WHERE edge_id IN (
    SELECT
        nonprimary_edge_id
      FROM tmp_edge_pairs
  ) ;

DROP TABLE tmp_edge_coords ;
DROP TABLE tmp_edge_pairs ;

COMMIT;
