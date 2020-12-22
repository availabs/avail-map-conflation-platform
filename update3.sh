#!/bin/bash

set -e

pushd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null

git pull

rm -rf ./data/shst/.shst/cache/graphs

# Need to create a softlink for the tileset we generated.
pushd ./data/shst/.shst/cache/tiles >/dev/null

ln -sf osm/planet-200910 .

popd >/dev/null

rm -f ./output/sqlite/npmrds


./run load_raw_npmrds \
  --npmrds_tmc_identification_gz data/npmrds/2019/tmc_identification.2019.csv.gz \
  --npmrds_shapefile_tgz data/npmrds/2019/npmrds_shapefile.2019.tgz \
  --county Albany

./run load_npmrds_target_map_microlevel
./run load_npmrds_target_map_mesolevel

./run npmrds_shst_match 
./run npmrds_choose_shst_matches 


# rm -f ./output/sqlite/nys_ris

# ./run load_nys_ris \
#   --nys_ris_geodatabase_tgz data/ris/RISDuplicate.2019.gdb.tgz \
#   --county Albany

# ./run load_nys_ris_target_map_microlevel
# ./run load_nys_ris_target_map_mesolevel

# ./run nys_ris_shst_match 
# ./run nys_ris_choose_shst_matches 

# popd >/dev/null
