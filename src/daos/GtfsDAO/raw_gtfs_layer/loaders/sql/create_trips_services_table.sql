--  DROP VIEW IF EXISTS gtfs.trip_services ;
DROP TABLE IF EXISTS gtfs.trip_services ;

--  https://developers.google.com/transit/gtfs/reference#stop_timestxt
--    Per GTFS Spec: An arrival time MUST be specified for the first and the last stop in a trip.

--  CONSIDER: Prob better to associate trip legs to time_periods.
--
--  FIXME: Assigns the TRIP to either the start or end period.
--         Assumes the TRIP spans at most two time periods.
--            This assumption has been sound for all observered feeds.
--            See: gtfs._qa_trip_services_durations_anomalies for the test.
--         However, ideally we assign a trip to the period with the most overlap,
--           covering the case where TRIP spans 3 or more periods.
--
--         CONSIDER: Would it be better to have the following schema?
--              trip_id,
--              service_id,
--              time_period,
--              minutes_in_time_period
--         
--            A trip could have multiple entries--one per time_period.
--            This would ensure each time_period gets its due share of the trip.
--         
CREATE TABLE gtfs.trip_services
  --  This table contains information for all the trips for a service.
  AS
    SELECT
        trip_id,
        service_id,

        CASE
          WHEN (trip_duration_in_start_period_minutes > trip_duration_in_end_period_minutes)
            THEN start_period
          ELSE end_period
        END AS time_period,

        CASE
          WHEN (trip_duration_in_start_period_minutes > trip_duration_in_end_period_minutes)
            THEN start_dow
          ELSE end_dow
        END AS dow,

        start_datetime,
        start_dow,
        start_epoch,
        start_period,
        trip_duration_in_start_period_minutes,

        end_datetime,
        end_dow,
        end_epoch,
        end_period,
        trip_duration_in_end_period_minutes,

        trip_duration_minutes

      FROM (
        SELECT
            trip_id,
            service_id,

            start_datetime,
            start_dow,
            start_epoch,

            CASE
              WHEN (start_epoch BETWEEN (6*12) AND (20*12 - 1)) THEN
                CASE
                  WHEN (start_dow BETWEEN 1 AND 5) THEN
                    CASE
                      WHEN (start_epoch BETWEEN (6*12)  AND (10*12 - 1)) THEN 'AMP'
                      WHEN (start_epoch BETWEEN (10*12) AND (16*12 - 1)) THEN 'MIDD'
                      WHEN (start_epoch BETWEEN (16*12) AND (20*12 - 1)) THEN 'PMP'
                    END
                  ELSE 'WE'
                END
              ELSE 'OVN'
            END AS start_period,

            CASE
              WHEN (start_epoch BETWEEN (6*12) AND (20*12 - 1))
                THEN
                  ROUND(
                    MIN(
                      (
                        (
                          julianday(
                            date(start_datetime)
                            || 'T'
                            || (
                              CASE 
                                WHEN (start_dow NOT BETWEEN 1 AND 5) THEN '20:00:00'
                                WHEN (start_epoch < (10*12)) THEN '10:00:00'
                                WHEN (start_epoch < (16*12)) THEN '16:00:00'
                                ELSE '20:00:00'
                              END
                            )
                          )
                          - julianday(start_datetime)
                        )
                        * (24 * 60)
                      ),
                      trip_duration_minutes
                    )
                  )
                ELSE -- Overnight
                  CASE
                    WHEN (start_epoch < (6*12)) -- AM portion of Overnight
                      THEN
                        ROUND(
                          MIN(
                            (
                              (
                                julianday( date(start_datetime) || 'T06:00:00' )
                                - julianday(start_datetime)
                              )
                              * (24 * 60)
                            ),
                            trip_duration_minutes
                          )
                        )
                      ELSE -- PM portion of Overnight
                        ROUND(
                          MIN(
                            (
                              (
                                julianday( date(start_datetime) || 'T23:59:59' )
                                - julianday(start_datetime)
                              )
                              * (24 * 60)
                              + (6 * 60) -- Midnight til 6am (AM portion of Overnight)
                            ),
                            trip_duration_minutes
                          )
                        )
                  END
            END AS trip_duration_in_start_period_minutes,

            end_datetime,
            end_dow,
            end_epoch,

            CASE
              WHEN (end_epoch BETWEEN (6*12) AND (20*12 - 1)) THEN
                CASE
                  WHEN (end_dow BETWEEN 1 AND 5) THEN
                    CASE
                      WHEN (end_epoch BETWEEN (6*12)  AND (10*12 - 1)) THEN 'AMP'
                      WHEN (end_epoch BETWEEN (10*12) AND (16*12 - 1)) THEN 'MIDD'
                      WHEN (end_epoch BETWEEN (16*12) AND (20*12 - 1)) THEN 'PMP'
                    END
                  ELSE 'WE'
                END
              ELSE 'OVN'
            END AS end_period,

            CASE
              WHEN (end_epoch BETWEEN (6*12) AND (20*12 - 1))
                THEN
                  ROUND(
                    MIN(
                      (
                        (
                          julianday(end_datetime)
                          - julianday(
                              date(end_datetime)
                              || 'T'
                              || (
                                CASE 
                                  WHEN (start_dow NOT BETWEEN 1 AND 5) THEN '06:00:00'
                                  WHEN (end_epoch < (10*12)) THEN '06:00:00'
                                  WHEN (end_epoch < (16*12)) THEN '10:00:00'
                                  ELSE '16:00:00'
                                END
                              )
                            )
                          )
                        * (24 * 60)
                      ),
                      trip_duration_minutes
                    )
                  )
                ELSE -- Overnight
                  CASE
                    WHEN (end_epoch < (6*12)) -- AM portion of Overnight
                      THEN
                        ROUND(
                          MIN(
                            (
                              (
                                julianday(end_datetime)
                                - julianday(date(end_datetime))
                              )
                              * (24 * 60)
                              + ((24-20) * 60) -- Carry over from previous night
                            ),
                            trip_duration_minutes
                          )
                        )
                      ELSE -- PM portion of Overnight
                        ROUND(
                          MIN(
                            (
                              (
                                julianday(end_datetime)
                                - julianday( date(end_datetime) || 'T20:00:00' )
                              )
                              * (24 * 60)
                              -- No carry over
                            ),
                            trip_duration_minutes
                          )
                        )
                  END
            END AS trip_duration_in_end_period_minutes,

            trip_duration_minutes
          FROM (
            SELECT
                trip_id,
                service_id,

                start_datetime,
                start_dow,
                CAST(
                  -- If we upgrade to better-sqlite3 v7.4.2, we can replace the below with FLOOR.
                  ROUND(
                    (
                      julianday(start_datetime)
                      - julianday(date(start_datetime)) -- 12am start_date
                    )
                    * (24 * 12) -- epochs per day
                    - 0.5       -- https://stackoverflow.com/a/24821301/3970755
                  ) AS INTEGER
                ) AS start_epoch,

                end_datetime,
                end_dow,
                CAST(
                  ROUND(
                    (
                      julianday(end_datetime)
                      - julianday(date(end_datetime))
                    )
                    * (24 * 12)
                    - 0.5
                  ) AS INTEGER
                ) AS end_epoch,

                ROUND(
                  ( julianday(end_datetime) - julianday(start_datetime) ) * (24 * 60)
                ) AS trip_duration_minutes
              FROM (
                SELECT
                    trip_id,
                    service_id,

                    datetime(
                      date(
                        iso_date,
                        (
                          '+'
                          || CAST( ( start_hour / 24 ) AS TEXT)
                          || ' day'
                        )
                      )
                      || 'T'
                      || (
                            substr('00' || CAST( start_hour % 24 AS TEXT ), -2, 2)
                            || ':'
                            || substr(start_time, 4, 2)
                            || ':'
                            || substr(start_time, 7, 2)
                          )
                    ) AS start_datetime,

                    ( dow + ( CAST(SUBSTR(start_time, 1,2) AS INTEGER) / 24 ) ) AS start_dow,

                    datetime(
                      date(
                        iso_date,
                        (
                          '+'
                          || CAST( ( end_hour / 24 ) AS TEXT)
                          || ' day'
                        )
                      )
                      || 'T'
                      || (
                            substr('00' || CAST( end_hour % 24 AS TEXT ), -2, 2)
                            || ':'
                            || substr(end_time, 4, 2)
                            || ':'
                            || substr(end_time, 7, 2)
                          )
                    ) AS end_datetime,

                    ( dow + ( CAST(SUBSTR(end_time, 1,2) AS INTEGER) / 24 ) ) AS end_dow
                  FROM (
                    SELECT
                        a.trip_id,
                        a.service_id,
                        (
                          substr(b.date , 1, 4)
                          || '-'
                          || substr(b.date, 5, 2)
                          || '-'
                          || substr(b.date, 7, 2)
                        ) AS iso_date,
                        b.dow,
                        MIN(c.arrival_time) start_time,
                        MAX(c.arrival_time) end_time,
                        CAST(SUBSTR(MIN(c.arrival_time), 1,2) AS INTEGER) AS start_hour,
                        CAST(SUBSTR(MAX(c.arrival_time), 1,2) AS INTEGER) AS end_hour
                      FROM trips AS a
                        INNER JOIN service_dates AS b
                          USING (service_id)
                        INNER JOIN stop_times AS c
                          USING (trip_id)
                      GROUP BY trip_id, b.date, b.dow
                  ) AS w
              ) AS x
          ) AS y
      ) AS z
;

DROP VIEW IF EXISTS gtfs.trip_counts_by_time_period ;

CREATE VIEW gtfs.trip_counts_by_time_period
  AS
    SELECT
        trip_id,
        time_period,
        COUNT(1) AS trips_count
      FROM trip_services
      GROUP BY trip_id, time_period
;

---------- QA Views ----------

-- Should return zero rows.
--    NOTE: If a trip spans more than 2 time bins, this assumtion will fail.
DROP VIEW IF EXISTS gtfs._qa_trip_services_durations_anomalies ;

CREATE VIEW gtfs._qa_trip_services_durations_anomalies
  AS
    SELECT
        trip_id,
        start_period,
        end_period,
        trip_duration_in_start_period_minutes,
        trip_duration_in_end_period_minutes,
        trip_duration_minutes
      FROM trip_services
      WHERE (
        (
          ( start_period = end_period )
          AND
          ( trip_duration_in_start_period_minutes <> trip_duration_in_end_period_minutes )
        )
        OR
        (
          ( start_period <> end_period )
          AND
          (
            ( trip_duration_in_start_period_minutes + trip_duration_in_end_period_minutes )
            <> trip_duration_minutes 
          ) 
        )
      )
;

DROP VIEW IF EXISTS gtfs._qa_trip_services_durations_test ;

CREATE VIEW gtfs._qa_trip_services_durations_test
  AS
    SELECT NOT EXISTS (
      SELECT
            1
          FROM _qa_trip_services_durations_anomalies
    ) AS passes
;

DROP VIEW IF EXISTS gtfs._qa_trip_counts_test ;

CREATE VIEW gtfs._qa_trip_counts_test
  AS
    SELECT
        individual_sum = by_peak_sum AS passes
      FROM (
        SELECT
            COUNT(1) AS individual_sum
          FROM trips
            INNER JOIN service_dates
              USING (service_id)
      ) INNER JOIN (
        SELECT
            SUM(trips_count) AS by_peak_sum
          FROM trip_counts_by_time_period
      )
;
