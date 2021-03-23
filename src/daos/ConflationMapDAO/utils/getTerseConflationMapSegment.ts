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
      tdsFederalDirection: tdsdir,
      roadNumber: rdnum,
      roadNumberFederalDirection: rdnumdir,
    },
  } = conflationMapSegment;

  const osm = conflationMapSegment.properties.osm.targetMapId;
  const ris =
    conflationMapSegment.properties?.nys_ris?.targetMapId || undefined;
  const tmc = conflationMapSegment.properties?.npmrds?.targetMapId || undefined;

  const netlev = conflationMapSegment.properties.roadClass;

  const feature = {
    ...conflationMapSegment,
    id,
    properties: { id, shst, osm, ris, tmc, netlev, tdsdir, rdnum, rdnumdir },
  };

  // @ts-ignore
  return feature;
}
