import { SharedStreetsMetadata } from 'sharedstreets-types';

import getModuleId from '../../../../utils/getModuleId';

import logger from '../../../../services/Logger';

// For logging.
const moduleId = getModuleId(__dirname, __filename);

export const handleNoOsmMetadata = (
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
) => {
  logger.warn({
    type: 'INCOMPLETE_SOURCE_METADATA',
    payload: {
      msg: `No OSMMetadata for SharedStreetsMetadata object.`,
      shstMetadata,
      shstMetadataId,
      _moduleId: moduleId,
    },
  });
};

export const handleEmptyOsmWaySections = (
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
) => {
  logger.warn({
    type: 'INCOMPLETE_SOURCE_METADATA',
    payload: {
      msg: `No OSMMetadata.WaySections for SharedStreetsMetadata object.`,
      shstMetadata,
      shstMetadataId,
      _moduleId: moduleId,
    },
  });
};

export const handleEmptyNodeIdsForOsmWaySection = (
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
  osmMetadataWaySectionIdx: number,
) => {
  logger.warn({
    type: 'INCOMPLETE_SOURCE_METADATA',
    payload: {
      msg: `No OSMMetadata.WaySections.nodeIds for SharedStreetsMetadata object.`,
      shstMetadata,
      shstMetadataId,
      osmMetadataWaySectionIdx,
      _moduleId: moduleId,
    },
  });
};

export const handleEmptyGisMetadata = (
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
) => {
  logger.warn({
    type: 'INCOMPLETE_SOURCE_METADATA',
    payload: {
      msg: `No GISMetadata for SharedStreetsMetadata object.`,
      shstMetadata,
      shstMetadataId,
      _moduleId: moduleId,
    },
  });
};

export const handleEmptyGisMetadataSections = (
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,

  gisMetadataIdx: number,
) => {
  logger.warn({
    type: 'INCOMPLETE_SOURCE_METADATA',
    payload: {
      msg: `No GISMetadata.sections for SharedStreetsMetadata object.`,
      shstMetadata,
      shstMetadataId,
      gisMetadataIdx,
      _moduleId: moduleId,
    },
  });
};
