export type GtfsAgencyName = string;

export enum GtfsTable {
  agency = 'agency',
  stops = 'stops',
  routes = 'routes',
  trips = 'trips',
  stop_times = 'stop_times',
  calendar = 'calendar',
  calendar_dates = 'calendar_dates',
  fare_attributes = 'fare_attributes',
  fare_rules = 'fare_rules',
  shapes = 'shapes',
  frequencies = 'frequencies',
  transfers = 'transfers',
  feed_info = 'feed_info',
}
