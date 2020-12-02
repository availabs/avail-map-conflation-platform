# ISSUES and CONCERNS

## Overlapping SharedStreets Matches between GTFS Shape Segments

* Where there is overlap between two shape seg's matches,
    snap the original GTFS Stop Coord to the Shst matches
    to determine where to split the overlapping matches.

* The drawback is that this is overriding a decision
    made with earlier with more GTFS domain info
    based on the output of a potentially flawed match.

* However, if we have two Shst refs overlapping at a
    shape segment-to-segment junction, that is because that junction
    occurs within a block and not at an intersection.
    The street was split because of a GTFS stop.

* Probably best just to snap the GTFS shape seg point at
    the junction to the shst refs to determine where to split
    the overlap.

The two directions of any road (directional or centerline target map)
  can be used to reinforce each other, fill gaps.

For centerline maps,
  using the shst_geometry_ids to get the reversed direction chosen paths.

  ? If the map id bi-directional,
      always add the reversed direction during matching ?
