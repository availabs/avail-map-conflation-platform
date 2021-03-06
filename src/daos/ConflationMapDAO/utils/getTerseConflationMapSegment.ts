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

  const osm = conflationMapSegment.properties.osm?.targetMapId || undefined;

  const osm_fwd = conflationMapSegment.properties.osm?.isForward;

  const ris =
    conflationMapSegment.properties?.nys_ris?.targetMapId || undefined;

  const tmc = conflationMapSegment.properties?.npmrds?.targetMapId || undefined;

  const n = conflationMapSegment.properties.roadClass;

  const feature = {
    ...conflationMapSegment,
    id,
    properties: { id, shst, osm, osm_fwd, ris, tmc, n, h, dir },
  };

  // @ts-ignore
  return feature;
}
