DROP TABLE IF EXISTS gtfs.agency ;

CREATE TABLE gtfs.agency (
  agency_id        TEXT PRIMARY KEY,
  agency_name      TEXT,
  agency_url       TEXT,
  agency_timezone  TEXT,
  agency_lang      TEXT,
  agency_phone     TEXT,
  agency_fare_url  TEXT,
  agency_email     TEXT
) WITHOUT ROWID ;


DROP TABLE IF EXISTS gtfs.stops ;

CREATE TABLE gtfs.stops (
  stop_id              TEXT PRIMARY KEY,
  stop_code            TEXT,
  stop_name            TEXT,
  stop_desc            TEXT,
  stop_lat             REAL,
  stop_lon             REAL,
  zone_id              TEXT,
  stop_url             TEXT,
  location_type        INTEGER,
  stop_timezone        TEXT,
  wheelchair_boarding  INTEGER
) WITHOUT ROWID ;


DROP TABLE IF EXISTS gtfs.routes ;

CREATE TABLE gtfs.routes (
  route_id          TEXT PRIMARY KEY,
  agency_id         TEXT,
  route_short_name  TEXT,
  route_long_name   TEXT,
  route_desc        TEXT,
  route_type        INTEGER,
  route_url         TEXT,
  route_color       TEXT,
  route_text_color  TEXT
) WITHOUT ROWID ;


DROP TABLE IF EXISTS gtfs.trips ;

CREATE TABLE gtfs.trips (
  route_id               TEXT,
  service_id             TEXT,
  trip_id                TEXT,
  trip_headsign          TEXT,
  direction_id           TEXT,
  shape_id               TEXT,
  wheelchair_accessible  INTEGER,
  bikes_allowed          INTEGER,

  PRIMARY KEY (route_id, service_id, trip_id)
) WITHOUT ROWID ;

CREATE INDEX IF NOT EXISTS gtfs.trips_trip_id_idx
  ON trips (trip_id) ;

CREATE INDEX IF NOT EXISTS gtfs.trips_times_service_id_idx
  ON trips (service_id) ;


DROP TABLE IF EXISTS gtfs.stop_times ;

CREATE TABLE gtfs.stop_times (
  trip_id              TEXT,
  arrival_time         TEXT,
  departure_time       TEXT,
  stop_id              TEXT,
  stop_sequence        INTEGER,
  stop_headsign        TEXT,
  pickup_type          INTEGER,
  drop_off_type        INTEGER,
  shape_dist_traveled  REAL,
  timepoint            INTEGER,

  PRIMARY KEY (trip_id, stop_sequence)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS gtfs.stop_times_trip_id_stop_id_idx
  ON stop_times (trip_id, stop_id) ;


DROP TABLE IF EXISTS gtfs.calendar ;

CREATE TABLE gtfs.calendar (
  service_id  TEXT PRIMARY KEY,
  monday      INTEGER NOT NULL CHECK (monday    IN (0, 1)),
  tuesday     INTEGER NOT NULL CHECK (tuesday   IN (0, 1)),
  wednesday   INTEGER NOT NULL CHECK (wednesday IN (0, 1)),
  thursday    INTEGER NOT NULL CHECK (thursday  IN (0, 1)),
  friday      INTEGER NOT NULL CHECK (friday    IN (0, 1)),
  saturday    INTEGER NOT NULL CHECK (saturday  IN (0, 1)),
  sunday      INTEGER NOT NULL CHECK (sunday    IN (0, 1)),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL
) WITHOUT ROWID ;


DROP TABLE IF EXISTS gtfs.calendar_dates ;

CREATE TABLE gtfs.calendar_dates (
  service_id      TEXT,
  date            TEXT NOT NULL,
  exception_type  TEXT NOT NULL,

  PRIMARY KEY (service_id, date)
) WITHOUT ROWID ;


DROP TABLE IF EXISTS gtfs.fare_attributes ;

CREATE TABLE gtfs.fare_attributes (
  fare_id            TEXT PRIMARY KEY,
  price              REAL,
  currency_type      TEXT,
  payment_method     INTEGER,
  transfers          INTEGER,
  agency_id          TEXT,
  transfer_duration  INTEGER
) WITHOUT ROWID;


DROP TABLE IF EXISTS gtfs.fare_rules ;

CREATE TABLE gtfs.fare_rules (
  fare_id         TEXT,
  route_id        TEXT,
  origin_id       TEXT,
  destination_id  TEXT,
  contains_id     TEXT
);


DROP TABLE IF EXISTS gtfs.shapes ;

CREATE TABLE gtfs.shapes (
  shape_id             TEXT,
  shape_pt_lat         REAL NOT NULL,
  shape_pt_lon         REAL NOT NULL,
  shape_pt_sequence    INTEGER,
  shape_dist_traveled  REAL,

  PRIMARY KEY (shape_id, shape_pt_sequence)
) WITHOUT ROWID;


DROP TABLE IF EXISTS gtfs.frequencies ;

CREATE TABLE gtfs.frequencies (
  trip_id       TEXT PRIMARY KEY,
  start_time    TEXT,
  end_time      TEXT,
  headway_secs  INTEGER,
  exact_times   INTEGER
) WITHOUT ROWID;


DROP TABLE IF EXISTS gtfs.transfers ;

CREATE TABLE gtfs.transfers (
  from_stop_id      TEXT NOT NULL,
  to_stop_id        TEXT NOT NULL,
  transfer_type     INTEGER NOT NULL CHECK (transfer_type IN (0, 1, 2, 3)),
  min_transfer_time INTEGER
);


DROP TABLE IF EXISTS gtfs.feed_info ;

CREATE TABLE gtfs.feed_info (
  feed_publisher_name  TEXT PRIMARY KEY,
  feed_publisher_url   TEXT,
  feed_lang            TEXT,
  feed_start_date      TEXT,
  feed_end_date        TEXT,
  feed_version         TEXT
) WITHOUT ROWID;
