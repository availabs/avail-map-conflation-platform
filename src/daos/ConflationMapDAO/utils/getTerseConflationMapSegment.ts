import {
  ConflationMapSegment,
  TerseConflationMapSegment,
} from '../domain/types';

export default function getTerseConflationMapSegment(
  conflationMapSegment: ConflationMapSegment,
): TerseConflationMapSegment {
  const {
    id,
    properties: {
      shstReferenceId: shst,
      tdsFederalDirection: dir,
      osmHighway: h,
    },
  } = conflationMapSegment;

  const osm = conflationMapSegment.properties.osm.targetMapId;
  const ris =
    conflationMapSegment.properties?.nys_ris?.targetMapId || undefined;
  const tmc = conflationMapSegment.properties?.npmrds?.targetMapId || undefined;

  const n = conflationMapSegment.properties.roadClass;

  const feature = {
    ...conflationMapSegment,
    id,
    properties: { id, shst, osm, ris, tmc, n, h, dir },
  };

  // @ts-ignore
  return feature;
}
