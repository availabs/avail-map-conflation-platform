# NYS Road Inventory System Field Descriptions

## Geodatabase Field Descriptions

| Field Names | Field Description
| ----------- | -----------------
| GIS_ID|Unique ID used in GIS for Dynamic Segmentation using the MilepointRoute feature class; it is a concatenation of the DOT ID and County Order and can be constructed by multiplying the DOT ID by 100 and adding the County Order.
| DOT_ID|A computer system ID used by NYSDOT as a unique reference for a particular route or road
| Direction|Direction (Primary or Reverse) the road is built in.
| Region|NYS Dept. of Transportation (NYSDOT) Region number
| Region_CO|Concatenation of Region and County Code
| FIPS_CO|FIPS county code; used with traffic count station to create a unique station number
| County_Name|County name
| County|Three letter abbreviation of county name
| Route|"Route number for State routes.  May be displayed as one concatentated field or in up to four components:  Signing, Number, Suffix, and Qualifier."
| Signing|"Type of Route Signing for designated touring routes - Interstate (I), US, or NY.  Reference routes (900 series) have no route signing."
| Route_NO|The numeric component of a route designation
| Suffix |"The alphabetic suffix of a route designation, if there is one.  A route may also have a signing qualifier such as Business or Alternate (NY has only one such route:  US 62 Business, aka US 62B)"
| Co_Rd|County Road number
| Road_Name|Road name
| Begin_Description|Description of the beginning of a segment of road
| End_Description|Description of the end of a segment of road
| County_Order|"Number of counties traversed since the beginning of the route; only relevant for State routes - all others have a county order of ""1"""
| Beg_MP|"Milepoint of the beginning of a route or road segment (each route begins at ""0"" within a county)"
| End_MP|"Milepoint of the end of the route or road segment; for the first (or only) segment of a road, the end MP is equal to the length of the segment"
| Section_Length|Length of a route/road segment to the hundredth of a mile
| Muni_Geocode |NYSDOT code representing the municipality in which the route or road segment is located (also known as Geo Code)
| Muni_Type|"Type of municipality (town, city, village) in which the road segment is located"
| Muni_Name|Name of the municipality
| Jurisdiction|Entity/agency responsible for maintenance of the segment of road
| Owning_Jurisdiction|Entity/agency which owns the segment of road
| Muni_Owner_Geocode|NYSDOT code representing the municipality which owns the route or road segment
| Muni_Owner_Type|"Type of municipality (town, city, village) which owns the route or road segment"
| Muni_Owner_Name|Name of the municipality which owns the route or road segment
| Functional_Class|Functional Classification - a means by which roads are classified according to the type of service and access they provide
| Federal_Aid_Highway (STP/ER)|Roadway eligible for Federal Highway Aid funding under the Surface Transportation Program and Emergency Relief Program.  Consists of roadways functionally classified other than Rural/Urban Local or Rural Minor Collector.
| NHS_Value|National Highway System; a system of nationally significant roads as designated by NYSDOT and the Federal Highway Administration (FHWA)
| Primary|"Roadway that is either on the National Highway System or was on the 1991 Federal Aid Primary system.  A ""Primary"" designation governs outdoor advertising and selected other regulations."
| 1991_Fed_Aid_Primary|"Designates a roadway segment on the Federal-Aid Primary system as it existed in June 1991.  Although generally obsolete, the FAP still governs selected trucking and other regulations.  This is a static system and does not change."
| StraHNet|Strategic Highway Network & StraHNet connectors - includes all Interstates and other designated roadways
| Urban_Area_Code_ID|Urban Area Code.  Urban areas are designated by the US Census Bureau based on population density.  The actual boundaries of the designated urban area may be adjusted for transportation purposes.
| Urban_Area_Name|Name of the Urban Area
| HPMS_UA_Code|Urban Area Code used for HPMS until 2009.  May differ from the Census designated UAC (obsolete).
| MPO_Desc|Metropolitan Planning Organization; each large Urban Area is required to have an MPO (a transportation planning group) which does the transportation planning for a designated Metropolitan Planning Area (MPA).
| Overlap_ID|Identifies routes/roads that share the same pavement such as an overlap of two State routes or a State route on a county road or city street
| Overlap_Hierarchy|"To prevent double counting road mileage, overlaps are ranked in a hierarchy; overlap pieces with a rank higher than 1 are not counted in mileage totals;  in the Pavement Data Extract duplicate mileage is marked with a ""Y"""
| Couplet_ID|No Longer Used
| RIS_Divided_Area_ID |Used to identify areas where each direction of a roadway is represented independently in the RIS database.
| HPMS_Sample_ID|Segments used as statistical samples for reporting to the Federal Highway Administration via the Highway Performance Monitoring System
| SH_Num|State Highway number; a NYSDOT designation for a specific segment of state-owned pavement
| REF_Marker|"Reference Marker: small roadside signs used to mark a particular location along a highway.  Used as a fixed point reference to a specific location, such as for accident reporting."
| Residency|NYSDOT facility responsible for maintenance of designated roadways under NYSDOT maintenance jurisdiction
| Total_Lanes|Number of lanes in the route or road segment
| Primary_Dir_Lanes|Number of lanes in the primary direction of the route or road segment
| Divided|Divided highway
| OneWay|One way street
| Access_Control|Type of access control
| Scenic_Byway|Roadways designated by the FHWA as a National Scenic Byway
| Trail_Crossing|Intended to denote where a designated trail crosses a roadway (not utilized at this time)
| Toll|Toll highway or bridge
| Toll_Facility|Name of the facility for which a toll is collected
| Parkway|Legally designated as a Parkway
| Grouped_Road_Flag|Indicates a record which shows total mileage in a category but not necessarily individual streets
| Rest_Area|Designates a rest area alongside a major highway
| Discontinuous_Road_Flag|Discontinuous - Indicates a route or road which is not continuous
| Reservation_Desc|"Name of the Indian Reservation in which the roadway segment is located, if any"
| Tandem_Truck|Truck route designation
| BIN_Number|Bridge Identification Number (BIN) for a bridge located on the roadway segment
| Bridge_Disp_Desc|"Identifies whether a Bridge carries the road segment (feature=1) or is over or under the roadway segment (feature>1).  For Bridge Feature=1, the segment length(s) approximates the length of the bridge.  For Feature>1, the bridge is assumed to cross the roadway segment at the end milepoint of the segment."
| Extra_Bridges|Denotes whether more than one bridge is present
| HOV|High Occupancy Vehicle restrictions in effect
| HOV_Lanes|Number of HOV lanes
| Railroad_Crossing|Railroad crossing (assumed to cross at the end milepoint of the segment)
| Area|Type of development in the area (this item contains old data that is not generally maintained)
| Culture|Type of facilities served by the roadway (this item contains old data that is not generally maintained)
| Passing|Passing sight distance for the designated segment of  roadway (this item contains old data that is not generally maintained)
| Parking|"Amount of parking allowed along the roadway (one side, two sides, none)"
| Posted_Speed_Limit|Posted Speed Limit
| CCSTN|Continuous Counter station number - locations at which traffic count data is collected continuously
| Station_Num|Traffic count station number
| AADT_current_yr_est|"An estimate of AADT for the last full calendar year (""current year"").  These numbers are typically generated in late Spring/early Summer for the prior calendar year."
| AADT_Actual|Annual Average of Daily Traffic based on the last count taken on the roadway segment
| Last_Actual_CNTYR|Year of the count from which the AADT was estimated
| DDHV|Estimate of the Directional Design Hour Volume calculated by applying DDHV factors derived from determining the ratio of the weekday high hour of the latest local count to the weekday average daily traffic
| DDHV-FACTOR|Estimate of the Directional Design Hour Volume calculated by applying DDHV factors derived from statewide continuous count data
| Adj_Cap|Adjusted Rated Capacity (one way)
| V/C|Volume to capacity ratio (DDHV / ARC)
| AVG-PCT_Trucks|Average percent trucks based on Region and functional class; utilized when sufficient locally collected vehicle classification data is not available
| Actual_PCT_Trucks|Percent trucks from the latest classification count taken at the traffic count station containing this route or road segment
| Actual_PCT-Year|Year of the latest vehicle classification count
| Total_Through_Lane_Width|Width of the pavement (in feet) contained with the sum of the travel lanes. Should not include shoulders.
| Pavement_Type_Value|"Type of pavement:  A-Asphalt, O-Overlay, C-Concrete, U-Unpaved, B-Brick/block"
| Shoulder_Width |Width of the right shoulder (in the direction of increasing milepoints) in feet
| Shoulder_Type|"Description of the area alongside the roadway, including the shoulders"
| Median_Width|Width of the median area in the center of a roadway
| Median_Type|Type of median in the center of a roadway
| Base|Type of base
| Sub_Base_Type|Subbase pavement type
| Last_Overlay|Year of last overlay
| Crack_Seal_Yr|Year of last crack sealing
| Work_Yr|Year of last work
| Work_Type|Type of last work
| IRI|"Most recent International Roughness Index, a measure of pavement roughness"
| IRI_Year|Date the IRI was collected
| I_Rut_Depth|Average depth of rutting in inches
| Rut_Year|Year rutting data was collected
| I_NO_Of_Bumps|Number of bumps in the route or road segment
| Bump_CNT_Year|Year the number of bumps was measured
| Max_Bump_Height|Maximum bump height in the route or road segment
| Bump_Max_Year|Year the bumps were measured
| Avg_Bump_Height|Average bump height in the route or road segment
| Bump_Avg_Year|Year in which the bump height was measured
| PCI|Pavement Condition Indicator - a composite index calculated from the various pavement condition data collected (not yet utilized)
| Roadway_Type|"Route (state system roadway), Road, Ramp"
| Onramp_From_Roadway|A ramp entering/intersecting with the roadway; located at the end milepoint of the segment
| Offramp_From_Roadway|A ramp for traffic exiting/leaving the roadway;  located at the end milepoint of the segment
| Ramp_Interchange_Code|An 11 character code representing an Interchange to which ramps are associated.
| Ramp_Alpha_Suffix|"A single letter suffix attached to the Interchange code is used for a ramp designation (total of 12 characters).  Each ramp is also assigned a unique, six digit DOT ID."
| Ramp_Orig_DOT_ID|DOT ID for the roadway from which the ramp begins
| Ramp_Orig_Co_Order|County Order of the roadway segment on the roadway from which the ramp begins
| Ramp_Orig_MP|Milepoint on the roadway from which the ramp begins
| Ramp_Dest_DOT_ID|DOT ID for the roadway at which the ramp ends
| Ramp_Dest_Co_Order|County Order of the roadway segment on the roadway at which the ramp ends
| Ramp_Dest_MP|Milepoint on the roadway from at the ramp ends
| Segment Type|"Normal, Temporary, Dummy.  Normal is the actual highway data.  Temporary and Dummy segments are system designations to assist data maintenance.  A Temporary segment may be created when road editing is not yet complete.  A Dummy segment is used to represent the length of a gap in a roadway, whether it is a physical gap or just a discontinuity in the roadway designation."
| K_Factor|A calculated field indicating the proportion of the AADT that occurs in the peak direction of the highest hour
| D_Factor|A calculated field indicating the proportion of the traffic heading in the higher volume direction in the high hour
| Percent_Peak_Single_Unit|The number of single unit trucks (classes 4-7) in the high hour as a percentage of the AADT
| Percent_Peak_Combp|The number of combination trucks (classes 8-13) in the high hour as a percentage of the AADT
| AADT_Single_Unit|The number of single unit trucks (classes 4-7) in an average day of the year
| AADT_Combo|The number of combination trucks (classes 8-13) in an average day of the year
| Pavement_Layer|Description of type of pavement layer
| Loc_Error|N/A
| Shape_Length |Calculated measurement of segment in meters.

## Code Descriptions

### ROUTE SIGNING,

| code | description
| ---- | -----------
| 0 | None
| 1 | Interstate
| 2 | US
| 3 | NY

### JURISDICTION (Maintenance, Owning)

| code | description
| ---- | -----------
| 1 | NYSDOT
| 2 | County
| 3 | Town
| 4 | City or village
| 11 | State Parks
| 12 | Local Parks
| 21 | Other State agencies
| 25 | Other local agencies
| 26 | Private (other than railroad)
| 27 | Railroad
| 31 | NYS Thruway
| 32 | Other Toll Authority
| 40 | Other Public Instrumentality (i.e. Airport)
| 50 | Indian Tribal Government
| 60 | Other Federal agencies
| 62 | Bureau of Indian Affairs
| 63 | Bureau of Fish and Wildlife
| 64 | U.S. Forest Service
| 66 | National Park Service
| 70 | Corps of Engineers (Civil)
| 71 | Corps of Engineers (Military)
| 72 | Air Force
| 73 | Navy/Marines
| 74 | Army
| 80 | Other

### FUNCTIONAL CLASSIFICATION

| code | description
| ---- | -----------
| 1 | Rural Principal Arterial Interstate
| 2 | Rural Principal Arterial Freeway/Expressway
| 4 | Rural Principal Arterial Other
| 6 | Rural Minor Arterial
| 7 | Rural Major Collector
| 8 | Rural Minor Collector
| 9 | Rural Local
| 11 | Urban Principal Arterial Interstate
| 12 | Urban Principal Arterial Freeway/Expressway
| 14 | Urban Principal Arterial Other
| 16 | Urban Minor Arterial
| 17 | Urban Major Collector
| 18 | Urban Minor Collector
| 19 | Urban Local

### NATIONAL HIGHWAY SYSTEM

| code | description
| ---- | -----------
| 1 | NHS
| 2 | NHS Int Conn - Airport
| 3 | NHS Int Conn - Port
| 4 | NHS Int Conn - AMTRAK Station
| 5 | NHS Int Conn - Rail/Truck Terminal
| 6 | NHS Int Conn - Intercity Bus Terminal
| 7 | NHS Int Conn - Public Transit/Multi Modal
| 8 | NHS Int Conn - Pipeline Terminal
| 9 | NHS Int Conn - Ferry Terminal

### STRAHNET

| code | description |
| ---- | ----------- |
| 1 | STRAHNET
| 2 | STRAHNET Connector

### METROPOLITAN PLANNING ORGANIZATIONS

| code | description |
| ---- | ----------- |
| AGFTC | Adirondack/Glens Falls Transportation Council
| BMTS | Binghamton Metropolitan Transportation Study
| CDTC | Capital District Transportation Committee
| ECTC | Elmira-Chemung Transportation Council
| GBNRTC | Greater Buffalo–Niagara Regional Transportation Council
| GTC | Genesee Transportation Council
| HOCTS | Herkimer–Oneida County Transportation Study
| ITCTC | Ithaca Tompkins County Transportation Council
| OCTC | Orange County Transportation Council
| NYMTC | New York Metropolitan Transportation Council
| PDCTC | Poughkeepsie–Dutchess County Transportation Council
| SMTC | Syracuse Metropolitan Transportation Council
| UCTC | Ulster County Transportation Council

### ACCESS CONTROL

| code | description |
| ---- | ----------- |
| 1 | Full
| 2 | Partial

### TRUCK ROUTES

| code | description |
| ---- | ----------- |
| 1 | Qualifying highway (National Network)
| 2 | Access limited (restrictions)
| 3 | Access highway

### HIGH OCCUPANCY VEHICLE (HOV)

| code | description |
| ---- | ----------- |
| 1 | Section has HOV lanes
| 2 | Lanes for HOV at specified times
| 3 | Shldr/pkg lanes for HOV at specified times

### AREA

| code | description |
| ---- | ----------- |
| 1 | Rural
| 2 | Unincorporated community
| 3 | Village less then 5000 population
| 4 | Suburban
| 5 | City
| 6 | Village over 5000 population

### CULTURE

| code | description |
| ---- | ----------- |
| 1 | Controlled Access
| 2 | Residential
| 3 | Resort
| 4 | Industry
| 5 | Business
| 6 | Agriculture
