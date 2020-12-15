git pull

rm -f output/sqlite/npmrds
./run load_raw_npmrds --npmrds_tmc_identification_gz data/npmrds/2019/tmc_identification.2019.csv.gz --npmrds_shapefile_tgz data/npmrds/2019/npmrds_shapefile.2019.tgz --county Albany
./run load_npmrds_target_map_microlevel
./run load_npmrds_target_map_mesolevel
./run shst_match_npmrds_network
./run output_npmrds_shapefile --output_directory npmrds_shp --clean
