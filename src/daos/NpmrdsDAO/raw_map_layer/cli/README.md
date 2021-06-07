# NpmrdsDAO raw_map_layer

## Convention-based loading

Conventioned-based takes as parameters the TMC_Identification
and NPMRDS Shapefile versions.
The actual files are expected to be found in the input directory.
The convention patterns and contraints are strictly enforced to guarantee that the
input and output of the avail-conflation-pipeline fits into the larger
avail-gis ecosystem--analysis, archiving, provenance tracking.

## TODO: Add an "unofficial source data" load option

The unofficial source data loading option MUST not depend on the avail-gis-toolkit.
Info parsed from the official version conventions MUST become required config params.
The TargetMap mapVersion MUST be NULL to indicate unofficial input data.
See index.ts from git commit 41579b2dc91da974cd9784d9240f579d12fbfba3
for possibly useful code.
