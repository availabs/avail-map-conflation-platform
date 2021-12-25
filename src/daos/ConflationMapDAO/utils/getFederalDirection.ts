/* eslint-disable no-param-reassign */

import { strict as assert } from 'assert';

import _ from 'lodash';

import { FederalDirection } from '../../NysRisDAO/traffic_count_station_year_directions/domain/types';

/*
FederalDirection
  North       1
  Northeast   2
  East        3
  Southeast   4
  South       5
  Southwest   6
  West        7
  Northwest   8
*/

/*
nys_ris> select distinct json_extract(feature, '$.properties.tds_federal_directions') from raw_target_map_features order by 1;
+--------------------------------------------------------------+
| json_extract(feature, '$.properties.tds_federal_directions') |
+--------------------------------------------------------------+
| [1,3,5,7]                                                    |
| [1,5]                                                        |
| [1]                                                          |
| [3,7]                                                        |
| [3]                                                          |
| [5]                                                          |
| [7]                                                          |
+--------------------------------------------------------------+
7 rows in set
Time: 0.272s
*/

const supportedFederalDirections = [1, 3, 5, 7];

const handleBearingOnly = (bearing: number) => {
  assert(bearing >= -360 && bearing <= 360);

  if (bearing > 180) {
    bearing -= 360;
  } else if (bearing < -180) {
    bearing += 360;
  }

  if (bearing >= -45 && bearing <= 45) {
    return FederalDirection.North;
  }

  if (bearing > 45 && bearing < 135) {
    return FederalDirection.East;
  }

  if (bearing <= -135 || bearing >= 135) {
    return FederalDirection.South;
  }

  if (bearing < -45 && bearing > -135) {
    return FederalDirection.West;
  }

  throw Error('INVALID STATE');
};

const handleNorthSouth = (bearing: number) =>
  Math.abs(bearing) <= 90 ? FederalDirection.North : FederalDirection.South;

const handleEastWest = (bearing: number) =>
  bearing >= 0 ? FederalDirection.East : FederalDirection.West;

function selectFederalDirectionUsingBearing(
  targetMapPathBearing: number,
  federalDirections: FederalDirection[],
): FederalDirection | null {
  if (
    federalDirections.length === 2 &&
    federalDirections[0] === 1 &&
    federalDirections[1] === 5
  ) {
    return handleNorthSouth(targetMapPathBearing);
  }

  if (
    federalDirections.length === 2 &&
    federalDirections[0] === 3 &&
    federalDirections[1] === 7
  ) {
    return handleEastWest(targetMapPathBearing);
  }

  console.error(
    `UNSUPPORTED FederalDirections Combination: ${federalDirections}`,
  );

  return null;
}

export default function getFederalDirection(
  target_map_path_bearing: string | null,
  is_forward: 0 | 1,
  federal_directions: string | null,
): FederalDirection | null {
  if (target_map_path_bearing === null && federal_directions === null) {
    return null;
  }

  const federalDirections: number[] | null =
    federal_directions &&
    JSON.parse(federal_directions).sort(
      (a: FederalDirection, b: FederalDirection) => +a - +b,
    );

  if (_.difference(federalDirections, supportedFederalDirections).length > 0) {
    console.error(`UNSUPPORTED FederalDirections: ${federalDirections}`);
    return null;
  }

  if (Array.isArray(federalDirections) && federalDirections.length === 1) {
    return federalDirections[0];
  }

  const isForward = !!+is_forward;

  let targetMapPathBearing: number | null =
    target_map_path_bearing !== null && target_map_path_bearing !== ''
      ? +target_map_path_bearing
      : null;

  // If the matches are in the reverse direction of the TargetMapPath, reverse the bearing.
  if (!isForward && targetMapPathBearing !== null) {
    targetMapPathBearing =
      targetMapPathBearing <= 0
        ? targetMapPathBearing + 180
        : targetMapPathBearing - 180;
  }

  if (
    (federalDirections === null ||
      federalDirections.length === 0 ||
      federalDirections.length > 2) &&
    targetMapPathBearing !== null
  ) {
    return handleBearingOnly(targetMapPathBearing);
  }

  if (federalDirections !== null && targetMapPathBearing !== null) {
    return selectFederalDirectionUsingBearing(
      targetMapPathBearing,
      federalDirections,
    );
  }

  return null;
}
