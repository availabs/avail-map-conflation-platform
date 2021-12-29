DROP VIEW IF EXISTS gtfs.feed_date_extent ;

CREATE VIEW gtfs.feed_date_extent
  AS
    SELECT
        feed_start_date,
        feed_end_date,
        ( --  Get the total number of days covered in the GTFS Feed.
          --  NOTE: The julianday() function returns the the number of days (with fractional portions)
          --    since November 24, 4714 B.C.  See https://www.sqlite.org/lang_datefunc.html for details.
          julianday(
            substr(feed_end_date , 1, 4)
            || '-'
            || substr(feed_end_date, 5, 2)
            || '-'
            || substr(feed_end_date, 7, 2)
          )
          -
          julianday(
            substr(feed_start_date , 1, 4)
            || '-'
            || substr(feed_start_date, 5, 2)
            || '-'
            || substr(feed_start_date, 7, 2)
          )
          + 1 -- Because extent is inclusive
        ) num_days
    FROM (
      SELECT
          MIN(a.date) AS feed_start_date,
          MAX(a.date) AS feed_end_date
        FROM (
          -- Collect all dates from the feed_info, calendar, and calendar_dates tables.
          SELECT
              feed_start_date AS date
            FROM feed_info

          UNION ALL

          SELECT
              feed_end_date AS date
            FROM feed_info

          UNION ALL

          SELECT
              start_date AS date
            FROM calendar

          UNION ALL

          SELECT
              end_date AS date
            FROM calendar

          UNION ALL

          SELECT
              date
            FROM calendar_dates
            WHERE ( exception_type = 1 )
        ) AS a
    ) AS t
;

DROP VIEW IF EXISTS gtfs.feed_dates;

CREATE VIEW gtfs.feed_dates
  AS
    --  Generate all (date, dow) tuples within the feed_date_extent
    --    See: https://stackoverflow.com/a/32987070/3970755
    WITH RECURSIVE cte_dates_and_dows(service_date) AS (
      -- Starting with the feed start date
      SELECT
          (
            substr(feed_start_date , 1, 4)
            || '-'
            || substr(feed_start_date, 5, 2)
            || '-'
            || substr(feed_start_date, 7, 2)
          ) AS service_date
        FROM feed_date_extent
      UNION ALL
      -- "Recursively" add all dates up to, and including, the feed end date.
      SELECT
          date(
            service_date,
            '+1 day'
          ) AS service_date
        FROM cte_dates_and_dows
        WHERE (
          -- NOTE: Feed end date is inclusive. This filter applied before incrementing date.
          (
            replace(service_date, '-', '')
            < (SELECT feed_end_date FROM feed_date_extent)
          )
        )
    )
    SELECT
        -- Revert to GTFS date format YYYYMMDD
        replace(service_date, '-', '') AS date,
        -- Get the day of week 0-6 with Sunday==0
        CAST(
          strftime('%w', service_date) AS INTEGER
        ) AS dow
      FROM cte_dates_and_dows
;

DROP VIEW IF EXISTS gtfs.service_dates;

CREATE VIEW gtfs.service_dates
  AS
    -- All (date, dow) tuples for which a service is available.
    SELECT
        service_id,
        date,
        dow
      FROM ( -- The dates for which the service is available
        -- Dates of service within date_extent based on calendar table
        SELECT
            service_id,
            a.date,
            dow
          FROM feed_dates AS a
            INNER JOIN (
              --  See https://developers.google.com/transit/gtfs/reference#calendartxt
              --    for details concerning the GTFS calendar file.
              SELECT
                  service_id,
                  -- This array is used to filter out feed_dates for a service.
                  --   A bit of a work-around to allow the ON clause below to
                  --   dynamically filter out dates using the feed_dates DOW and
                  --   the calendar table's day-of-the-week columns.
                  json_array(
                    sunday,
                    monday,
                    tuesday,
                    wednesday,
                    thursday,
                    friday,
                    saturday,
                    sunday
                  ) AS service_dows,
                  start_date,
                  end_date
                FROM calendar
            ) AS b
              ON (
                -- Does the service run on this day of the week?
                (
                  CAST(
                    -- NOTE: DOW is the array index.
                    --       Array elements === 1 indicate the service is available.
                    json_extract(b.service_dows, '$[' || a.dow || ']')
                    AS INTEGER
                  ) = 1
                )
                AND
                -- Does the date fall within the specific service's start and end dates?
                (
                  ( a.date >= b.start_date )
                  AND
                  ( a.date <= b.end_date )
                )
              )

        UNION

        --  Add service dates where calendar_dates specifies "service added" exception_type.
        SELECT
            service_id,
            date,
            dow
          FROM calendar_dates AS a
            INNER JOIN feed_dates AS b
              USING ( date )
          WHERE (
            -- Exception type is "Service has been added for the specified date."
            ( a.exception_type = 1 )
          )
      ) AS sub_included

    -- Remove service dates where calendar_dates specifies "service removed" exception_type
    EXCEPT

    SELECT
        service_id,
        date,
        CAST( strftime( '%w', date ) AS INTEGER ) AS dow
      FROM calendar_dates
        INNER JOIN feed_dates AS b
          USING ( date )
      WHERE (
        -- Exception type is "Service has been removed for the specified date."
        ( exception_type = 2 )
      )
  ;

---------- QA Views ----------

DROP VIEW IF EXISTS gtfs._qa_feed_dates_test ;

CREATE VIEW gtfs._qa_feed_dates_test
  AS
    SELECT
        num_days = individual_dates_count AS passes
      FROM feed_date_extent
        INNER JOIN (
          SELECT
              COUNT(1) AS individual_dates_count
            FROM feed_dates
        ) AS t
;

DROP VIEW IF EXISTS gtfs._qa_service_dates_test ;

CREATE VIEW gtfs._qa_service_dates_test
  AS
    SELECT NOT EXISTS (
      SELECT
          service_id,
          COUNT(1)
        FROM service_dates
        GROUP BY service_id, date
        HAVING COUNT(1) > 1
    ) AS passes;
;
