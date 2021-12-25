/* eslint-disable no-restricted-syntax, no-await-in-loop, import/prefer-default-export */

import * as turf from '@turf/turf';
import _ from 'lodash';

import shstMatchFeatures from './shstMatchFeatures';
import removeRedundantMatches from './removeRedundantMatches';

import { TargetMapEdgeFeature } from '../../../../../utils/TargetMapDatabases/TargetMapDAO';
import { SharedStreetsMatchResult } from '../../../domain/types';

const BATCH_SIZE = 25;

const initializeUnmatchedFeaturesArray = (features: TargetMapEdgeFeature[]) =>
  Array.isArray(features) && features.length
    ? features.reduce((acc: turf.Feature<turf.LineString>[], feature) => {
        const featureType = turf.getType(feature);

        if (
          !(featureType === 'LineString' || featureType === 'MultiLineString')
        ) {
          console.error('Unsupported GeoJSON feature type.');
          return acc;
        }

        const { id, properties } = feature;

        // SharedStreets does not preserve the feature id.
        // However, it perserves the input feature properties.
        // Therefore, we ensure that there is an "id" in the feature properties.

        const { id: propId } = properties;

        if (id && propId && id !== propId) {
          throw new Error('INVARIANT BROKEN: Feature id !== properties.id');
        }

        const featureId: TargetMapEdgeFeature['id'] = id || propId;

        if (featureId === undefined) {
          throw new Error(
            'An id must be defined on the feature or in its properties.',
          );
        }

        const newProps = { ...properties, id: featureId };

        const multiCoords =
          featureType === 'LineString'
            ? [turf.getCoords(feature)]
            : turf.getCoords(feature);

        // to assist in matching, MultiLineStrings are split into Linestrings
        multiCoords.forEach((coords) => {
          const newLineString = turf.lineString(coords, newProps, {
            id: featureId,
          });
          acc.push(newLineString);
        });

        return acc;
      }, [])
    : null;

const match = async (features: TargetMapEdgeFeature[], flags: string[]) => {
  const unmatchedFeatures = initializeUnmatchedFeaturesArray(features);

  return _.isEmpty(unmatchedFeatures)
    ? null
    : shstMatchFeatures(unmatchedFeatures, flags);
};

const handleMatches = (matches: SharedStreetsMatchResult[]) => {
  const keepers = removeRedundantMatches(matches);
  const orderedMatches = _.sortBy(keepers, (f) => f.properties.pp_id);
  return orderedMatches;
};

async function matchSegmentedShapeFeatures(
  batch: TargetMapEdgeFeature[],
  flags: string[],
): Promise<{
  osrmDir: string;
  matches: SharedStreetsMatchResult[];
} | null> {
  const { matches, osrmDir } = (await match(batch, flags)) || {};

  if (matches) {
    const orderedMatches = handleMatches(matches);
    return { osrmDir, matches: orderedMatches };
  }

  return null;
}

export async function* makeShstMatchesIterator(
  featuresIterator: Generator<TargetMapEdgeFeature>,
  options?: { centerline?: boolean; flags?: string[] },
) {
  const centerline = !!options?.centerline;

  const flags: string[] = options?.flags ?? [];

  if (!centerline && !flags.includes('--follow-line-direction')) {
    flags.push('--follow-line-direction');
  }

  console.log('Shst Match option flags:', JSON.stringify(flags, null, 4));

  const batch: TargetMapEdgeFeature[] = [];

  let totalTargetMapFeatures = 0;
  let totalMatchedFeatures = 0;
  let inBatch = 0;

  const logMatchStats = (matches: any) => {
    const numMatched = _.isEmpty(matches)
      ? 0
      : _(matches).map('properties.pp_id').uniq().value().length;
    totalMatchedFeatures += numMatched;

    console.log();
    console.log('-'.repeat(20));
    console.log(`Total Features: ${totalTargetMapFeatures}`);
    console.log(`Batch Match: ${_.round((numMatched / inBatch) * 100, 2)}%`);
    console.log(
      `Total Match: ${_.round(
        (totalMatchedFeatures / totalTargetMapFeatures) * 100,
        2,
      )}%`,
    );
    console.log('-'.repeat(20));
    console.log();
  };

  for (const feature of featuresIterator) {
    batch.push(feature);
    ++totalTargetMapFeatures;
    ++inBatch;

    if (batch.length === BATCH_SIZE) {
      try {
        const { matches, osrmDir } =
          (await matchSegmentedShapeFeatures(batch, flags)) || {};

        logMatchStats(matches);
        if (matches) {
          for (const matchFeature of matches) {
            yield { osrmDir, matchFeature };
          }
        }
      } catch (err) {
        console.error(err);
      }

      batch.length = 0;
      inBatch = 0;
    }
  }

  // Last batch
  if (batch.length > 0) {
    const { matches, osrmDir } =
      (await matchSegmentedShapeFeatures(batch, flags)) || {};

    logMatchStats(matches);
    if (matches) {
      try {
        for (const matchFeature of matches) {
          yield { osrmDir, matchFeature };
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}
