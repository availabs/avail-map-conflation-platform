-- The _total_ schema is 
DROP TABLE IF EXISTS _total_.conflation_map_segments_bus_aadt ;

CREATE TABLE _total_.conflation_map_segments_bus_aadt (
  conflation_map_id   INTEGER NOT NULL,
  feed_agency_name    TEXT NOT NULL,
  aadt_by_route       TEXT NOT NULL,

  PRIMARY KEY(conflation_map_id, feed_agency_name)
) WITHOUT ROWID ;

DROP VIEW IF EXISTS _total_.aggregated_conflation_map_segments_bus_aadt ;

CREATE VIEW _total_.aggregated_conflation_map_segments_bus_aadt
  AS
    SELECT
        conflation_map_id,
        ROUND(
          COALESCE(total_bus_counts_am, 0)
          + COALESCE(total_bus_counts_off, 0)
          + COALESCE(total_bus_counts_pm, 0)
          + COALESCE(total_bus_counts_wknd, 0)
          + COALESCE(total_bus_counts_ovn, 0),
          3
        ) AS total_bus_counts,
        total_bus_counts_am,
        total_bus_counts_off,
        total_bus_counts_pm,
        total_bus_counts_wknd,
        total_bus_counts_ovn,
        bus_counts_by_agency_route
      FROM (
        SELECT
            conflation_map_id,
            ROUND(
              SUM(
                json_extract(value, '$.am') * (key = '_total_')
              ), 3
            ) AS total_bus_counts_am,
            ROUND(
              SUM(
                json_extract(value, '$.off') * (key = '_total_')
              ), 3
            ) AS total_bus_counts_off,
            ROUND(
              SUM(
                json_extract(value, '$.pm') * (key = '_total_')
              ), 3
            ) AS total_bus_counts_pm,
            ROUND(
              SUM(
                json_extract(value, '$.wknd') * (key = '_total_')
              ), 3
            ) AS total_bus_counts_wknd,
            ROUND(
              SUM(
                json_extract(value, '$.ovn') * (key = '_total_')
              ), 3
            ) AS total_bus_counts_ovn,

            json_group_object(
              ( feed_agency_name || '||' || key ),
              value
            ) as bus_counts_by_agency_route
          FROM conflation_map_segments_bus_aadt,
            json_each(aadt_by_route)
          GROUP BY conflation_map_id
    )
;
