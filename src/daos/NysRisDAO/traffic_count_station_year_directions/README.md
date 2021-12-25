# Traffic Count Station Year Direction Loading

NOTE: This process is separate from NYS Roadway Inventory System loading
because the traffic counts metadata changes more frequently due to
corrections. Currently the TrafficCountStationYearDirection metadata
is only used in the final stage when we output the conflation map.
If the TrafficCountStationYearDirection data changes, but the RIS
remains unchanged, we can load the new TrafficCountStationYearDirection
metadata and output an improved map without having to rerun the entire
conflation process for the RIS map. Maintaining the version info
in the conflation map output ensures the conflation map dependencies
are preserved.
