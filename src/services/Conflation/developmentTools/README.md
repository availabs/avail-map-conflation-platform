# Conflation Service Development Tools

## Purpose

The conflation process is composed of multiple complex algorithms and heuristics.

To improve and extend the conflation process we must be able to determine
whether and where code changes improve or degrade conflation output. This
requires intertemporal analysis of code and the output it produces.

These tools are designed to generate the data for such analysis.

## USAGE

The top-level script runs the entire process.
In most cases it is what you will want to run.

```sh
./cli/run
```

## Conflation Code Backups

Creates

- [differential backups](https://en.wikipedia.org/wiki/Differential_backup) of
  the src/services/Conflation directory

- differential and incremental [diff](https://en.wikipedia.org/wiki/Diff) files
  based on those backups.

These will facilitate experimentation by

- allowing easy code restoration to optimal discovered states
- facilitate identification of code changes responsible for observed output effects

```sh
./conflationCode/cli/run --help
```

## Conflation Blackboard Databases Snapshots

Creates

- snapshots of the target map conflation blackboard databases. The snapshots
  contain [projections](<https://en.wikipedia.org/wiki/Projection_(relational_algebra)>)
  of the shst_matches, chosen_matches, and assigned_matches tables.

- snapshot diff databases that compare the shst/chosen/assigned_matches
  between two conflation blackboard snapshots.

These will provide the data for comparative quality metrics and visualizations.

```sh
./conflationDatabases/cli/run --help
```

## Conflation Spatial

Creates

- a [GeoPackage](http://www.geopackage.org/) of all conflation input maps
  - OSM (soon)
  - SharedStreets References
  - NYS RIS
  - NPMRDS

Converting the maps to this standard will allow analysis and visualization using
a wide variety of GIS community tools.

```sh
./conflationSpatial/cli/run --help
```

## TODO

### Set new initial timestamp

Allow the tools to progress after an unequivocal improvement was discovered

0. Apply the differential changes for the timestamp to any initial backups.
1. Archive all differential dirs/dbs/gpkgs preceeding new initial timestamp
2. Archive all diffs that involved timestamps preceeding the new initial timestamp
3. Create new "differential" diffs for all timestamps following new initial

### Rollback source code to timestamp

Allow backtracking after failed experiments

0. Rollback src/services/Conflation using the timestamp's differential backup.
1. Archive all differential dirs/dbs/gpkgs following new "latest" timestamp
2. Archive all diffs that involved timestamps following the new "latest" timestamp

### TargetMap Names

Regular expressions throughout the code assume `/^[a-z_]$/` matches all Target Map names.
Add validation of target_map cli parameters.
