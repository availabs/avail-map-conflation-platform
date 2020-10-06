import * as turf from '@turf/turf';

export interface TmcIdentificationProperties {
  readonly tmc: string;
  readonly type: string;
  readonly road: string | null;
  readonly road_order: number;
  readonly intersection: string | null;
  readonly tmclinear: number | null;
  readonly country: string | null;
  readonly state: string | null;
  readonly county: string | null;
  readonly zip: string | null;
  readonly direction: string | null;
  readonly start_latitude: number | null;
  readonly start_longitude: number | null;
  readonly end_latitude: number | null;
  readonly end_longitude: number | null;
  readonly miles: number | null;
  readonly frc: number | null;
  readonly border_set: string | null;
  readonly isprimary: number | null;
  readonly f_system: number | null;
  readonly urban_code: number | null;
  readonly faciltype: number | null;
  readonly structype: number | null;
  readonly thrulanes: number | null;
  readonly route_numb: number | null;
  readonly route_sign: number | null;
  readonly route_qual: number | null;
  readonly altrtename: string | null;
  readonly aadt: number | null;
  readonly aadt_singl: number | null;
  readonly aadt_combi: number | null;
  readonly nhs: number | null;
  readonly nhs_pct: number | null;
  readonly strhnt_typ: number | null;
  readonly strhnt_pct: number | null;
  readonly truck: number | null;
  readonly timezone_name: string | null;
  readonly active_start_date: string | null;
  readonly active_end_date: string | null;
}

export interface NpmrdsShapefileFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  properties: {
    readonly tmc: string;
    readonly type: string;
    readonly roadnumber: string | null;
    readonly roadname: string | null;
    readonly firstname: string | null;
    readonly lineartmc: string;
    readonly country: string;
    readonly state: string;
    readonly county: string;
    readonly zip: string;
    readonly direction: string;
    readonly startlat: number | null;
    readonly startlong: number | null;
    readonly endlat: number | null;
    readonly endlong: number | null;
    readonly miles: number | null;
    readonly frc: number | null;
  };
}

export interface NpmrdsTmcFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  properties: TmcIdentificationProperties & { readonly lineartmc: string };
}
