import OsmDao from '.';

// OsmDao.createOsmRoutesMetadataTable();

// OSM Way: 5564145; one_way: 1
// const nodeIds = [41251272, 41251274, 41251277, 41251280, 41251282];

// OSM Way: 5574146; one_way: 0
const nodeIds = [41309013, 41361710, 41361713, 41361716, 41344994];

const result = OsmDao.matchOsmNodeSequence([...nodeIds]);

console.log(JSON.stringify(result, null, 4));
