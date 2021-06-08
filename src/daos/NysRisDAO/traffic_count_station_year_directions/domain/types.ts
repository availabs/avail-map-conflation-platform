export enum FederalDirection {
  North = 1,
  Northeast,
  East,
  Southeast,
  South,
  Southwest,
  West,
  Northwest,
}

export type TrafficCountStationYearDirection = {
  rcStation: string;
  year: number;
  federalDirection: FederalDirection;
};

export type NysTrafficCountStationsVersion = string;
