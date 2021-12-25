import * as turf from '@turf/turf';

export type NysRisVersion = string;

export type NysRisDirection = 0 | 1 | 2;

export interface NysRoadInventorySystemProperties {
  readonly fid: number;

  readonly region: number;

  // Unique ID used in GIS for Dynamic Segmentation using the MilepointRoute
  // feature class; it is a concatenation of the DOT ID and County Order and
  // can be constructed by multiplying the DOT ID by 100 and adding the County
  // Order.
  readonly gis_id: number;

  // A computer system ID used by NYSDOT as a unique reference for a particular
  // route or road.
  readonly dot_id: number;

  // Direction (Primary or Reverse) the road is built in.
  readonly direction: NysRisDirection;

  // Concatenation of Region and County Code
  readonly region_co: number;

  // FIPS county code; used with traffic count station to create a unique station
  // number.
  readonly fips_co: number;

  // County name
  readonly county_name: string;

  // Three letter abbreviation of county name
  readonly county: string;

  // Route number for State routes.  May be displayed as one concatentated field
  // or in up to four components:  Signing, Number, Suffix, and Qualifier.
  readonly route: string | null;

  // Type of Route Signing for designated touring routes - Interstate (I), US, or
  // NY.  Reference routes (900 series) have no route signing.
  readonly signing: string | null;

  // The numeric component of a route designation
  readonly route_no: number | null;

  // The alphabetic suffix of a route designation, if there is one.  A route may
  // also have a signing qualifier such as Business or Alternate (NY has only one
  // such route:  US 62 Business, aka US 62B).
  readonly suffix: string | null;

  // County Road number
  readonly co_rd: string | null;

  // Road name
  readonly road_name: string | null;

  // Description of the beginning of a segment of road
  readonly begin_description: string | null;

  // Description of the end of a segment of road
  readonly end_description: string | null;

  // Number of counties traversed since the beginning of the route; only relevant
  // for State routes - all others have a county order of "1"
  readonly county_order: number | null;

  // Milepoint of the beginning of a route or road segment (each route begins at
  // "0" within a county)
  readonly beg_mp: number;

  // Milepoint of the end of the route or road segment; for the first (or only)
  // segment of a road, the end MP is equal to the length of the segment.
  readonly end_mp: number;

  // Length of a route/road segment to the hundredth of a mile
  readonly section_length: number;

  // NYSDOT code representing the municipality in which the route or road segment
  // is located (also known as Geo Code)
  readonly muni_geocode: number | null;

  // Type of municipality (town, city, village) in which the road segment is
  // located
  readonly muni_type: string | null;

  // Name of the municipality
  readonly muni_name: string | null;

  // Entity/agency responsible for maintenance of the segment of road
  readonly jurisdiction: string | null;

  // Entity/agency which owns the segment of road
  readonly owning_jurisdiction: string | null;

  // NYSDOT code representing the municipality which owns the route or road segment
  readonly muni_owner_geocode: number | null;

  // Type of municipality (town, city, village) which owns the route or road segment
  readonly muni_owner_type: string | null;

  // Name of the municipality which owns the route or road segment
  readonly muni_owner_name: string | null;

  // Functional Classification - a means by which roads are classified according
  // to the type of service and access they provide
  readonly functional_class: number;

  // Roadway eligible for Federal Highway Aid funding under the Surface
  // Transportation Program and Emergency Relief Program.  Consists of roadways
  // functionally classified other than Rural/Urban Local or Rural Minor
  // Collector.
  readonly federal_aid_highway_stp_er_: string | null;

  // National Highway System; a system of nationally significant roads as
  // designated by NYSDOT and the Federal Highway Administration (FHWA)
  readonly nhs_value: string | null;

  // Roadway that is either on the National Highway System or was on the 1991
  // Federal Aid Primary system.  A "Primary" designation governs outdoor
  // advertising and selected other regulations.
  readonly primary: string | null;

  // Designates a roadway segment on the Federal-Aid Primary system as it existed
  // in June 1991.  Although generally obsolete, the FAP still governs selected
  // trucking and other regulations.  This is a static system and does not
  // change.
  readonly f1991_fed_aid_primary: string | null;

  // Strategic Highway Network & StraHNet connectors - includes all Interstates
  // and other designated roadways
  readonly strahnet: string | null;

  // Urban Area Code.  Urban areas are designated by the US Census Bureau based
  // on population density.  The actual boundaries of the designated urban area
  // may be adjusted for transportation purposes.
  readonly urban_area_code_id: number | null;

  // Name of the Urban Area
  readonly urban_area_name: string | null;

  // Urban Area Code used for HPMS until 2009.  May differ from the Census
  // designated UAC (obsolete).
  readonly hpms_ua_code: number | null;

  // Metropolitan Planning Organization; each large Urban Area is required to
  // have an MPO (a transportation planning group) which does the transportation
  // planning for a designated Metropolitan Planning Area (MPA).
  readonly mpo_desc: string | null;

  // Identifies routes/roads that share the same pavement such as an overlap of
  // two State routes or a State route on a county road or city street
  readonly overlap_id: string | null;

  // To prevent double counting road mileage, overlaps are ranked in a hierarchy;
  // overlap pieces with a rank higher than 1 are not counted in mileage totals;
  // in the Pavement Data Extract duplicate mileage is marked with a "Y"
  readonly overlap_hierarchy: number | null;

  // Used to identify areas where each direction of a roadway is represented
  // independently in the RIS database.
  readonly ris_divided_area_id: number | null;

  // Segments used as statistical samples for reporting to the Federal Highway
  // Administration via the Highway Performance Monitoring System
  readonly hpms_sample_id: number | null;

  // State Highway number; a NYSDOT designation for a specific segment of
  // state-owned pavement
  readonly sh_num: string | null;

  // Reference Marker: small roadside signs used to mark a particular location
  // along a highway.  Used as a fixed point reference to a specific location,
  // such as for accident reporting.
  readonly ref_marker: string | null;

  // NYSDOT facility responsible for maintenance of designated roadways under
  // NYSDOT maintenance jurisdiction
  readonly residency: string | null;

  // Number of lanes in the route or road segment
  readonly total_lanes: number | null;

  // Number of lanes in the primary direction of the route or road segment
  readonly primary_dir_lanes: number | null;

  // Divided highway
  readonly divided: string | null;

  // One way street
  readonly oneway: string | null;

  // Type of access control
  readonly access_control: string | null;

  // Roadways designated by the FHWA as a National Scenic Byway
  readonly scenic_byway: string | null;

  // Intended to denote where a designated trail crosses a roadway (not utilized
  // at this time)
  readonly trail_crossing: string | null;

  // Toll highway or bridge
  readonly toll: string | null;

  // Name of the facility for which a toll is collected
  readonly toll_facility: string | null;

  // Legally designated as a Parkway
  readonly parkway: string | null;

  // Indicates a record which shows total mileage in a category but not
  // necessarily individual streets
  readonly grouped_road_flag: string | null;

  // Designates a rest area alongside a major highway
  readonly rest_area: string | null;

  // Discontinuous - Indicates a route or road which is not continuous
  readonly discontinuous_road_flag: string | null;

  // Name of the Indian Reservation in which the roadway segment is located, if
  // any
  readonly reservation_desc: string | null;

  // Truck route designation
  readonly tandem_truck: string | null;

  // Bridge Identification Number (BIN) for a bridge located on the roadway
  // segment
  readonly bin_number: string | null;

  // Identifies whether a Bridge carries the road segment (feature=1) or is over
  // or under the roadway segment (feature>1).  For Bridge Feature=1, the segment
  // length(s) approximates the length of the bridge.  For Feature>1, the bridge
  // is assumed to cross the roadway segment at the end milepoint of the segment.
  readonly bridge_disp_desc: string | null;

  // Denotes whether more than one bridge is present
  readonly extra_bridges: string | null;

  // High Occupancy Vehicle restrictions in effect
  readonly hov: string | null;

  // Number of HOV lanes
  readonly hov_lanes: number | null;

  // Railroad crossing (assumed to cross at the end milepoint of the segment)
  readonly railroad_crossing: string | null;

  // Type of development in the area (this item contains old data that is not
  // generally maintained)
  readonly area: string | null;

  // Type of facilities served by the roadway (this item contains old data that
  // is not generally maintained)
  readonly culture: string | null;

  // Passing sight distance for the designated segment of  roadway (this item
  // contains old data that is not generally maintained)
  readonly passing: number | null;

  // Amount of parking allowed along the roadway (one side, two sides, none)
  readonly parking: string | null;

  // Posted Speed Limit
  readonly posted_speed_limit: number | null;

  // Continuous Counter station number - locations at which traffic count data is
  // collected continuously
  readonly ccstn: number | null;

  // Traffic count station number
  readonly station_num: number | null;

  // An estimate of AADT for the last full calendar year ("current year").  These
  // numbers are typically generated in late Spring/early Summer for the prior
  // calendar year.
  readonly aadt_current_yr_est: number | null;

  // Annual Average of Daily Traffic based on the last count taken on the roadway
  // segment
  readonly aadt_actual: number | null;

  // Year of the count from which the AADT was estimated
  readonly last_actual_cntyr: number | null;

  // Estimate of the Directional Design Hour Volume calculated by applying DDHV
  // factors derived from determining the ratio of the weekday high hour of the
  // latest local count to the weekday average daily traffic
  readonly ddhv: number | null;

  // Estimate of the Directional Design Hour Volume calculated by applying DDHV
  // factors derived from statewide continuous count data
  readonly ddhv_factor: number | null;

  // Adjusted Rated Capacity (one way)
  readonly adj_cap: number | null;

  // Volume to capacity ratio (DDHV / ARC)
  readonly v_c: number | null;

  // Average percent trucks based on Region and functional class; utilized when
  // sufficient locally collected vehicle classification data is not available
  readonly avg_pct_trucks: number | null;

  // Percent trucks from the latest classification count taken at the traffic
  // count station containing this route or road segment
  readonly actual_pct_trucks: number | null;

  // Year of the latest vehicle classification count
  readonly actual_pct_year: number | null;

  // Width of the pavement (in feet) contained with the sum of the travel lanes.
  // Should not include shoulders.
  readonly total_through_lane_width: number | null;

  // Type of pavement:  A-Asphalt, O-Overlay, C-Concrete, U-Unpaved,
  // B-Brick/block
  readonly pavement_type_value: string | null;

  // Width of the right shoulder (in the direction of increasing milepoints) in
  // feet
  readonly shoulder_width: number | null;

  // Description of the area alongside the roadway, including the shoulders
  readonly shoulder_type: string | null;

  // Width of the median area in the center of a roadway
  readonly median_width: number | null;

  // Type of median in the center of a roadway
  readonly median_type: string | null;

  // Type of base
  readonly base: string | null;

  // Subbase pavement type
  readonly sub_base_type: string | null;

  // Year of last overlay
  readonly last_overlay: number | null;

  // Year of last crack sealing
  readonly crack_seal_yr: number | null;

  // Year of last work
  readonly work_yr: number | null;

  // Type of last work
  readonly work_type: string | null;

  readonly yr_scored: number | null;

  // NOTE: ss_<year> columns excluded because they vary across RIS GDBs
  // readonly ss_2007?: string | null;

  readonly dom_distr: string | null;

  // Most recent International Roughness Index, a measure of pavement roughness
  readonly iri: number | null;

  // Date the IRI was collected
  readonly iri_year: number | null;

  // Average depth of rutting in inches
  readonly i_rut_depth: number | null;

  // Year rutting data was collected
  readonly rut_year: number | null;

  // Number of bumps in the route or road segment
  readonly i_no_of_bumps: number | null;

  // Year the number of bumps was measured
  readonly bump_cnt_year: number | null;

  // Maximum bump height in the route or road segment
  readonly max_bump_height: number | null;

  // Year the bumps were measured
  readonly bump_max_year: number | null;

  // Average bump height in the route or road segment
  readonly avg_bump_height: number | null;

  // Year in which the bump height was measured
  readonly bump_avg_year: number | null;

  // Pavement Condition Indicator - a composite index calculated from the various
  // pavement condition data collected (not yet utilized)
  readonly pci: number | null;

  // Route (state system roadway), Road, Ramp
  readonly roadway_type: string | null;

  // A ramp entering/intersecting with the roadway; located at the end milepoint
  // of the segment
  readonly onramp_from_roadway: string | null;

  // A ramp for traffic exiting/leaving the roadway;  located at the end
  // milepoint of the segment
  readonly offramp_from_roadway: string | null;

  // An 11 character code representing an Interchange to which ramps are
  // associated.
  readonly ramp_interchange_code: string | null;

  // A single letter suffix attached to the Interchange code is used for a ramp
  // designation (total of 12 characters).  Each ramp is also assigned a unique,
  // six digit DOT ID.
  readonly ramp_alpha_suffix: string | null;

  // DOT ID for the roadway from which the ramp begins
  readonly ramp_orig_dot_id: string | null;

  // County Order of the roadway segment on the roadway from which the ramp
  // begins
  readonly ramp_orig_co_order: number | null;

  // Milepoint on the roadway from which the ramp begins
  readonly ramp_orig_mp: number | null;

  // DOT ID for the roadway at which the ramp ends
  readonly ramp_dest_dot_id: string | null;

  // County Order of the roadway segment on the roadway at which the ramp ends
  readonly ramp_dest_co_order: number | null;

  // Milepoint on the roadway from at the ramp ends
  readonly ramp_dest_mp: number | null;

  // Normal, Temporary, Dummy.  Normal is the actual highway data.  Temporary and
  // Dummy segments are system designations to assist data maintenance.  A
  // Temporary segment may be created when road editing is not yet complete.  A
  // Dummy segment is used to represent the length of a gap in a roadway, whether
  // it is a physical gap or just a discontinuity in the roadway designation.
  readonly segment_type: string | null;

  // A calculated field indicating the proportion of the AADT that occurs in the
  // peak direction of the highest hour
  readonly k_factor: number | null;

  // A calculated field indicating the proportion of the traffic heading in the
  // higher volume direction in the high hour
  readonly d_factor: number | null;

  // The number of single unit trucks (classes 4-7) in the high hour as a
  // percentage of the AADT
  readonly percent_peak_single_unit: number | null;

  // The number of combination trucks (classes 8-13) in the high hour as a
  // percentage of the AADT
  readonly percent_peak_combo: number | null;

  // The number of single unit trucks (classes 4-7) in an average day of the year
  readonly aadt_single_unit: number | null;

  // The number of combination trucks (classes 8-13) in an average day of the
  // year
  readonly aadt_combo: number | null;

  // Description of type of pavement layer
  readonly pavement_layer: number | null;

  // Calculated measurement of segment in meters.
  readonly shape_length: number | null;
}

export interface NysRoadInventorySystemFeature
  extends turf.Feature<turf.LineString | turf.MultiLineString> {
  id: number;
  properties: NysRoadInventorySystemProperties;
}
