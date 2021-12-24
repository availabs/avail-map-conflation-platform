# OSRM Profiles

## ./lib

Files copied from [Project-OSRM/osrm-backend/tree/master/profiles](https://github.com/Project-OSRM/osrm-backend/tree/master/profiles).

## car.nys_ris.lua

This profile is a modification of OSRM's car.lua.

Because the NYS Roadway System includes roads not intended for normal transportation
use (e.g. service roads), we must remove certain penalties to ensure correct matching
of such entities.

## TODO

Profiles for NPMRDS and GTFS.
