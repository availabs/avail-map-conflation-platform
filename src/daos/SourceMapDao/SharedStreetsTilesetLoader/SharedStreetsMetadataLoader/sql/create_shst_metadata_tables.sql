-- ========== shst_metadata  ==========
--
-- /** Properties of a SharedStreetsMetadata. */
-- export interface SharedStreetsMetadata {
--
--   /** SharedStreetsMetadata geometryId */
--   geometryId?: string;
--
--   /** SharedStreetsMetadata osmMetadata */
--   osmMetadata?: OSMMetadata;
--
--   /** SharedStreetsMetadata gisMetadata */
--   gisMetadata?: GISMetadata[];
-- }
--
-- /** Properties of a OSMMetadata. */
-- export interface OSMMetadata {
--
--   /** OSMMetadata waySections */
--   waySections?: WaySection[];
--
--   /** OSMMetadata name */
--   name?: string;
-- }

DROP TABLE IF EXISTS shst.shst_metadata ;

CREATE TABLE shst.shst_metadata (
  _id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  geometry_id         TEXT,
  osm_metadata_name   TEXT -- SharedStreetsMetadata.OSMMetadata.name property
) ;

-- For JOINing with shst.shst_geometries
CREATE INDEX shst.shst_metadata_geometry_id_idx
  ON shst_metadata (geometry_id) ;



-- ========== shst_metadata_gis_metadata  ==========
--
-- Normalizes SharedStreetsMetadata.gisMetadata?.: GISMetadata[]
--
-- /** Properties of a GISMetadata. */
-- export interface GISMetadata {
--
--   /**
--    * GISMetadata source
--    *
--    * describes GIS source data (e.g. "gov.nyc:lion")
--    */
--   source?: string;
--
--   /** GISMetadata sections */
--   sections?: GISSectionMetadata[];
-- }

DROP TABLE IF EXISTS shst.shst_metadata_gis_metadata;

CREATE TABLE shst.shst_metadata_gis_metadata (
  shst_metadata_id     INTEGER,
  gis_metadata_idx     INTEGER,

  source               TEXT,

  PRIMARY KEY (shst_metadata_id, gis_metadata_idx),
  FOREIGN KEY (shst_metadata_id)
    REFERENCES shst_metadata(_id)
    ON DELETE CASCADE
) WITHOUT ROWID;


-- ========== shst_metadata_osm_metadata_way_sections ==========
--
-- Normalizes SharedStreetsMetadata?.osmMetadata?.waySections: WaySection[]
--
-- See: https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L46-L69
--
-- /** Properties of a WaySection. */
-- export interface WaySection {
--
--   /** WaySection wayId */
--   wayId?: number;
--
--   /** WaySection roadClass */
--   roadClass?: string;
--
--   /** WaySection oneWay */
--   oneWay?: boolean;
--
--   /** WaySection roundabout */
--   roundabout?: boolean;
--
--   /** WaySection link */
--   link?: boolean;
--
--   /** WaySection nodeIds */
--   nodeIds?: number[];
--
--   /** WaySection name */
--   name?: string;
-- }

DROP TABLE IF EXISTS shst.shst_metadata_osm_metadata_way_sections ;

CREATE TABLE shst.shst_metadata_osm_metadata_way_sections (
  shst_metadata_id               INTEGER,
  osm_metadata_way_section_idx   INTEGER,

  way_id                         INTEGER,
  road_class                     TEXT,
  one_way                        INTEGER,
  roundabout                     INTEGER,
  link                           INTEGER,
  name                           INTEGER,

  PRIMARY KEY (shst_metadata_id, osm_metadata_way_section_idx),
  FOREIGN KEY (shst_metadata_id)
    REFERENCES shst_metadata(_id)
    ON DELETE CASCADE
) WITHOUT ROWID;

-- Index for JOINing with original OSM ways.
CREATE INDEX shst.shst_metadata_osm_metadata_way_sections_way_id_idx
  ON shst_metadata_osm_metadata_way_sections (way_id) ;



-- ========== shst_metadata_osm_metadata_way_section_nodes ==========
--
-- Normalizes SharedStreetsMetadata?.osmMetadata?.waySections?.nodeIds: number[]
--
-- https://github.com/sharedstreets/sharedstreets-types/blob/master/index.ts#L65
-- Table created to normalize SharedStreets.WaySection.nodeIds?: number[]

DROP TABLE IF EXISTS shst.shst_metadata_osm_metadata_way_section_nodes ;

CREATE TABLE shst.shst_metadata_osm_metadata_way_section_nodes (
  shst_metadata_id               INTEGER,
  osm_metadata_way_section_idx   INTEGER,
  way_section_nodes_idx          INTEGER,

  osm_node_id                    INTEGER,

  PRIMARY KEY (shst_metadata_id, osm_metadata_way_section_idx, way_section_nodes_idx, osm_node_id),
  FOREIGN KEY (shst_metadata_id, osm_metadata_way_section_idx)
    REFERENCES shst_metadata_osm_metadata_way_sections(shst_metadata_id, osm_metadata_way_section_idx)
    ON DELETE CASCADE
) WITHOUT ROWID;

-- Index for JOINing with original OSM nodes.
CREATE INDEX shst.shst_metadata_osm_metadata_way_section_nodes_node_id_idx
  ON shst_metadata_osm_metadata_way_section_nodes (osm_node_id) ;


-- ========== shst_metadata_gis_section ==========
--
-- https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L1-L17
-- Table created to normalize SharedStreets.GISMetadata.sections?: GISSectionMetadata[]

-- /** Properties of a GISSectionMetadata. */
-- export interface GISSectionMetadata {
--
--   /**
--    * GISSectionMetadata sectionId
--    *
--    * source specific id
--    */
--   sectionId?: string;
--
--   /**
--    * GISSectionMetadata sectionProperties
--    *
--    * source specific encoding of properties
--    */
--   sectionProperties?: string;
-- }

DROP TABLE IF EXISTS shst.shst_metadata_gis_metadata_section_metadata;

CREATE TABLE shst.shst_metadata_gis_metadata_section_metadata (
  shst_metadata_id            INTEGER,
  gis_metadata_idx            INTEGER,

  gis_metadata_section_idx    INTEGER,

  section_id                  TEXT,

  section_properties          TEXT,

  PRIMARY KEY (shst_metadata_id, gis_metadata_idx, gis_metadata_section_idx),
  FOREIGN KEY (shst_metadata_id, gis_metadata_idx)
    REFERENCES shst_metadata_gis_metadata (shst_metadata_id, gis_metadata_idx)
    ON DELETE CASCADE
) WITHOUT ROWID;
