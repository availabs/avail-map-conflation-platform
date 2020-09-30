# SharedStreets Core Concepts

## [SharedStreets Geometries](https://github.com/sharedstreets/sharedstreets-ref-system#sharedstreets-geometries)

> SharedStreets Geometries are street centerline data derived from the basemap
> used to produce SharedStreets References. A single geometry is shared by each
> set of forward and back references.

```JSON
  {
    "type": "Feature",
    "properties": {
      "id": "NxPFkg4CrzHeFhwV7Uiq7K",
      "fromIntersectionId": "5gRJyF2MT5BBErTyEesQLC",
      "toIntersectionId": "N38a21UGykpnqxwez7NGS3",
      "forwardReferenceId": "2Vw2XzW4cs7r32RLhQnqwA",
      "backReferenceId": "VXKSEokmvBJ81XHYhUronG",
      "roadClass": 3
    },
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-74.003388, 40.634538],
        [-74.003621, 40.634383],
        [-74.003621, 40.634383],
        [-74.004107, 40.63406]
      ]
    }
  }
```

### [SharedStreetsGeometry Type](https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts#L94-L121)

```TypeScript
/** Properties of a SharedStreetsGeometry. */
export interface SharedStreetsGeometry {

  /** SharedStreetsGeometry id */
  id: string;

  /** SharedStreetsGeometry fromIntersectionId */
  fromIntersectionId?: string;

  /** SharedStreetsGeometry toIntersectionId */
  toIntersectionId?: string;

  /** SharedStreetsGeometry forwardReferenceId */
  forwardReferenceId?: string;

  /** SharedStreetsGeometry backReferenceId */
  backReferenceId?: string;

  /** SharedStreetsGeometry roadClass */
  roadClass?: string;

  /**
   * SharedStreetsGeometry lonlats
   *
   * interleaved lon/lat pairs in sequence
   */
  lonlats: number[];
}
```


