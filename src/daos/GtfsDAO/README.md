# GtfsDAO

NOTE: The GtfsDAO code does not currently adhere to the patterns found in the
other DAOs. That will be remedied when time permits.

## Conventions

### Input Directory

Used either the default input directory or the
AVAIL_MAP_CONFLATION_INPUT_DIR ENV variable override.

Example:

```tree
data/gtfs
├── cdta
│   ├── gtfs.zip
├── centro
│   └── gtfs.zip
└── wcdot
    └── gtfs.zip
```

See `utils/getGtfsInputDirs.ts`.

- Directory names are used as normalized agency names.
  The output directories will have the same names as input directories.

- For simplicity GTFS ZIP archives are expected be named "gtfs.zip".
  If the archive does not have that name, a symbolic link for the feed archive
  MUST be created with the name "gtfs.zip".

  - If this becomes a problem, we could inspect the contents of
    all ZIP archives to find the GTFS archives in a directory.
    (Files within an archive have standardized names,
    archives themselves does not.)

## Loading the consolidate_gtfs_feeds_conflation output into the PostgreSQL database

See the NPMRDS_Database's
[load-scheduled-bus-counts](https://github.com/availabs/NPMRDS_Database/blob/master/src/transit-conflation/load-scheduled-bus-counts)
script.

## GTFS Specification Documentation

- [GTFS Specification](https://developers.google.com/transit/gtfs/reference)
- [gtfs.org](https://gtfs.org/)

  - [Best Practices for GTFS](https://gtfs.org/best-practices/)

- [MobilityData](https://mobilitydata.org/)
  - [gtfs-validator](https://github.com/MobilityData/gtfs-validator)
