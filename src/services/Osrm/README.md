# OSRM References

- [Running OSRM Tool Chain](https://github.com/Project-OSRM/osrm-backend/wiki/Running-OSRM)

- [Profiles](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/profiles.md)

- [Traffic](https://github.com/Project-OSRM/osrm-backend/wiki/Traffic)

  - NOTE: This could be used add ad-hoc penalties based on road class/name/number.

- [OSRM HTTP server](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md)

- [Node.js OSRM](https://github.com/Project-OSRM/node-osrm/blob/master/docs/api.md)

## Map Matching Algorithm

- [OSRM API Documentation for match-service](http://project-osrm.org/docs/v5.5.1/api/?language=JavaScript#match-service)

- [Hidden Markov Map Matching Through Noise and Sparseness](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/map-matching-ACM-GIS-camera-ready.pdf)

- [Viterbi algorithm](https://en.wikipedia.org/wiki/Viterbi_algorithm)

### Map Matching Code

- [map_matching.cpp](https://github.com/Project-OSRM/osrm-backend/blob/41dda32546399f1dc12af1de41668993de44c7dc/src/engine/routing_algorithms/map_matching.cpp)
- [hidden_markov_model](https://github.com/Project-OSRM/osrm-backend/blob/41dda32546399f1dc12af1de41668993de44c7dc/include/engine/map_matching/hidden_markov_model.hpp)

### Etc

- [Map matching algorithm #1578](https://github.com/Project-OSRM/osrm-backend/issues/1578)
- [Generating matching instructions #1529](https://github.com/Project-OSRM/osrm-backend/pull/1529)
