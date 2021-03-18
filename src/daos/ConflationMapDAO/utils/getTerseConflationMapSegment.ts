import {
  ConflationMapSegment,
  TerseConflationMapSegment,
} from '../domain/types';

export default function getTerseConflationMapSegment(
  conflationMapSegment: ConflationMapSegment,
): TerseConflationMapSegment {
  const { id } = conflationMapSegment;
  const { shstReferenceId: shst } = conflationMapSegment.properties;
  const osm = conflationMapSegment.properties.osm.targetMapId;
  const ris =
    conflationMapSegment.properties?.nys_ris?.targetMapId || undefined;
  const tmc = conflationMapSegment.properties?.npmrds?.targetMapId || undefined;

  const netlev = conflationMapSegment.properties.roadClass;

  const feature = {
    ...conflationMapSegment,
    id,
    properties: { id, shst, osm, ris, tmc, netlev },
  };

  // @ts-ignore
  return feature;
}
