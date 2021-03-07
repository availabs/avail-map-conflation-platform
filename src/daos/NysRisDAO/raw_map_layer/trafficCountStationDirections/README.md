# NYSDOT Highway Data Services Traffic Data Station Directions

The Traffic Data can be joined with the NYSDOT RoadInventorySystem map.

To assign a FederalDirection to the conflation map output,
  we will use the Traffic Data station "federal_direction".

The traffic data was scraped from NYSDOT's
  [site](
    https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb
  ) using this [code](
    https://github.com/availabs/NPMRDS_Database/blob/master/make_targets/highwayDataServicesTrafficCounts/scrape-NYSDOT-CSVs.js
  ).

The `./get_schemas` script gets the schema from each CSV type.

The `./get_station_year_directions` uses the information from `./get_schemas`
  to extract the *rc_station*, *year*, and *federal_direction* columns from the
  scraped `average_weekday_*` and `short_count_*` CSVs.

NOTE: The CSV schemas tend to change from year to year.
  Any future use of this code **MUST** verify that the column
    numbers for the relevant data did not change.

NOTE: The output CSV (station_year_directions.csv.gz) needed to be cleaned up manually.
  A row with "-" characters was deleted, as well as a duplicate of the header.
