/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import * as turf from '@turf/turf';
import { Database, Statement } from 'better-sqlite3';

import db from '../../services/DbService';

import { SOURCE_MAP, OSM } from '../../constants/databaseSchemaNames';

import { getGeometriesConcaveHull } from '../../utils/gis/hulls';

import getShstReferencesForOsmNodeSequences from './utils/getShstReferencesForOsmNodeSequences';

import { OsmNodeId } from '../OpenStreetMapDao/domain/types';

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
  SharedStreetsIntersectionId,
  SharedStreetsIntersectionFeature,
} from './domain/types';

class SourceMapDao {
  protected _dbReadConnection: Database | null;

  protected readonly preparedReadStatements!: {
    shstTileSourceStmt?: Statement;
    shstReferenceFeaturesOverlappingPolyStmt?: Statement;
    shstReferenceRoadsOverlappingPolyStmt?: Statement;
    shstReferencesStmt?: Statement;
    shstIntersectionsStmt?: Statement;
    allShstReferenceFeaturesStmt?: Statement;
    allShstReferenceFeaturesOverlappingPolygonStmt?: Statement;
    allShstWaySectionNodeMetadataForOsmNodesSeqStmt?: Statement;
    getShstGeomIdsStmt?: Statement;
  };

  getShstReferencesForOsmNodeSequences: (
    osmNodeIdsSequence: OsmNodeId[],
  ) => SharedStreetsReferenceFeature[] | null;

  constructor() {
    this._dbReadConnection = null;

    this.preparedReadStatements = {};

    // This is rather complicated. Better off decomposing into modules.
    this.getShstReferencesForOsmNodeSequences = getShstReferencesForOsmNodeSequences.bind(
      this,
    );
  }

  get dbReadConnection(): Database {
    if (!this._dbReadConnection) {
      this._dbReadConnection = db.openConnectionToDb(SOURCE_MAP, null, 'shst');
      db.attachDatabaseToConnection(this._dbReadConnection, OSM, null, 'osm');
    }

    return this._dbReadConnection;
  }

  get shstTileSourceStmt(): Statement {
    this.preparedReadStatements.shstTileSourceStmt =
      this.preparedReadStatements.shstTileSourceStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              tile_source
            FROM shst.shst_tileset_provenance ;
        `,
      );

    return this.preparedReadStatements.shstTileSourceStmt;
  }

  get shstTileSource() {
    return this.shstTileSourceStmt.pluck().get();
  }

  get shstReferenceFeaturesOverlappingPolyStmt(): Statement {
    this.preparedReadStatements.shstReferenceFeaturesOverlappingPolyStmt =
      this.preparedReadStatements.shstReferenceFeaturesOverlappingPolyStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature
            FROM shst.shst_reference_features
              INNER JOIN (
                SELECT
                    shst_reference_id
                  FROM shst.shst_reference_features_geopoly_idx
                  WHERE geopoly_overlap(_shape, ?)
              ) USING ( shst_reference_id ) ;
        `,
      );

    return this.preparedReadStatements.shstReferenceFeaturesOverlappingPolyStmt;
  }

  // The geopoly types copied from the following:
  // https://github.com/Turfjs/turf/blob/3cea4b5f125a11fb4757da59d1222fd837d9783c/packages/turf-invariant/index.ts#L51-L63
  getShstReferenceFeaturesOverlappingPoly(
    geopoly: any[] | turf.Feature | turf.GeometryObject,
  ): SharedStreetsReferenceFeature[] {
    const geopolyCoords = turf.getCoords(geopoly);

    const result = this.shstReferenceFeaturesOverlappingPolyStmt
      .raw()
      .all([JSON.stringify(geopolyCoords)]);

    const shstRefLineStrings = result.map(([featureStr]) =>
      JSON.parse(featureStr),
    );

    return shstRefLineStrings;
  }

  get shstReferenceRoadsOverlappingPolyStmt(): Statement {
    this.preparedReadStatements.shstReferenceRoadsOverlappingPolyStmt =
      this.preparedReadStatements.shstReferenceRoadsOverlappingPolyStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature
            FROM shst.shst_reference_features
              INNER JOIN (
                SELECT
                    shst_reference_id
                  FROM shst.shst_reference_features_geopoly_idx
                  WHERE geopoly_overlap(_shape, ?)
              ) USING ( shst_reference_id )
            WHERE ( json_extract(feature, '$.properties.minOsmRoadClass') < 8 )
        `,
      );

    return this.preparedReadStatements.shstReferenceRoadsOverlappingPolyStmt;
  }

  getShstReferenceRoadsOverlappingPoly(
    geopoly: any[] | turf.Feature | turf.GeometryObject,
  ): SharedStreetsReferenceFeature[] {
    const geopolyCoords = turf.getCoords(geopoly);

    const result = this.shstReferenceRoadsOverlappingPolyStmt
      .raw()
      .all([JSON.stringify(geopolyCoords)]);

    const shstRefLineStrings = result.map(([featureStr]) =>
      JSON.parse(featureStr),
    );

    return shstRefLineStrings;
  }

  get shstReferencesStmt(): Statement {
    this.preparedReadStatements.shstReferencesStmt =
      this.preparedReadStatements.shstReferencesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature
            FROM shst.shst_reference_features
            WHERE shst_reference_id IN (
              SELECT
                  value
                FROM (
                    SELECT json(?) AS shst_ref_ids_arr
                  ) AS t, json_each(t.shst_ref_ids_arr)
            )
            ORDER BY shst_reference_id ;
        `,
      );

    return this.preparedReadStatements.shstReferencesStmt;
  }

  getShstReferences(
    shstReferenceIds: SharedStreetsReferenceFeature['id'][],
  ): SharedStreetsReferenceFeature[] {
    const shstRefsById = this.shstReferencesStmt
      .raw()
      .all([JSON.stringify(shstReferenceIds)])
      .reduce(
        (
          acc: Record<SharedStreetsReferenceId, SharedStreetsReferenceFeature>,
          shstRefStr: string,
        ) => {
          const shstRef = JSON.parse(shstRefStr);
          acc[shstRef.id] = shstRef;
          return acc;
        },
        {},
      );

    const shstRefLineStrings = shstReferenceIds.map(
      (shstRefId) => shstRefsById[shstRefId] || null,
    );

    return shstRefLineStrings;
  }

  get shstIntersectionsStmt(): Statement {
    this.preparedReadStatements.shstIntersectionsStmt =
      this.preparedReadStatements.shstIntersectionsStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              geojson_point
            FROM shst.shst_intersections
            WHERE id IN (
              SELECT
                  value
                FROM (
                    SELECT json(?) AS shst_ref_ids_arr
                  ) AS t, json_each(t.shst_ref_ids_arr)
            )
        `,
      );

    return this.preparedReadStatements.shstIntersectionsStmt;
  }

  getShstIntersections(
    shstIntersectionIds: SharedStreetsIntersectionId[],
  ): SharedStreetsIntersectionFeature[] {
    const shstIntxnsById = this.shstIntersectionsStmt
      .raw()
      .all([JSON.stringify(shstIntersectionIds)])
      .reduce(
        (
          acc: Record<
            SharedStreetsIntersectionId,
            SharedStreetsIntersectionFeature
          >,
          shstIntxnStr: string,
        ) => {
          const shstIntxn = JSON.parse(shstIntxnStr);
          acc[shstIntxn.id] = shstIntxn;
          return acc;
        },
        {},
      );

    const shstRefLineStrings = shstIntersectionIds.map(
      (shstIntxnId) => shstIntxnsById[shstIntxnId] || null,
    );

    return shstRefLineStrings;
  }

  protected get allShstReferenceFeaturesStmt(): Statement {
    this.preparedReadStatements.allShstReferenceFeaturesStmt =
      this.preparedReadStatements.allShstReferenceFeaturesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature
            FROM shst.shst_reference_features
            ORDER BY shst_reference_id
          ;
        `,
      );

    return this.preparedReadStatements.allShstReferenceFeaturesStmt;
  }

  *makeSharedStreetsReferenceFeaturesIterator(): Generator<SharedStreetsReferenceFeature> {
    const shstReferencesIter = this.allShstReferenceFeaturesStmt
      .raw()
      .iterate();

    for (const [featureStr] of shstReferencesIter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }

  protected get allShstReferenceFeaturesOverlappingPolygonStmt() {
    this.preparedReadStatements.allShstReferenceFeaturesOverlappingPolygonStmt =
      this.preparedReadStatements
        .allShstReferenceFeaturesOverlappingPolygonStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              feature
            FROM shst.shst_reference_features
              INNER JOIN (
                SELECT
                    shst_reference_id
                  FROM shst.shst_reference_features_geopoly_idx
                  WHERE geopoly_overlap(_shape, ?)
              ) USING ( shst_reference_id )
            ORDER BY shst_reference_id ;
        `,
      );

    return this.preparedReadStatements
      .allShstReferenceFeaturesOverlappingPolygonStmt;
  }

  *makeSharedStreetsReferenceFeaturesOverlappingPolygonIterator(
    boundaryPolygon: turf.Feature<turf.Polygon>,
  ): Generator<SharedStreetsReferenceFeature> {
    // @ts-ignore
    const boundingPolyHull = getGeometriesConcaveHull([boundaryPolygon]);
    const [boundingPolyCoords] = turf.getCoords(boundingPolyHull);

    const shstReferencesIter = this.allShstReferenceFeaturesOverlappingPolygonStmt
      .raw()
      .iterate([JSON.stringify(boundingPolyCoords)]);

    for (const [featureStr] of shstReferencesIter) {
      const feature = JSON.parse(featureStr);

      yield feature;
    }
  }
}

export default new SourceMapDao();
