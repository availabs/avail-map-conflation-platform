export const ShstSource = {
    id: 'ShstSource',
    source: {
        type: 'vector',
        url: 'https://tiles.availabs.org/data/shared_streets_20200910.json'
    }
}

export const npmrd2019Source = {
    id: 'npmrd2019Source',
    source: {
        type: 'vector',
        url: 'https://tiles.availabs.org/data/npmrds_2019.json'
    }
}

export const ris2019Source = {
    id: 'npmrd2019Source',
    source: {
        type: 'vector',
        url: 'https://tiles.availabs.org/data/nys_ris_2019.json'
    }
}




const n = 'n', //"netlev",
  w = 10,
  o = 10
  //c = 'white'

export const npmrdsPaint = (NETWORK_LEVEL, WIDTH_MULT,OFFSET_MULT, COLOR) => ({
  'line-width': [
  "interpolate",
  ["exponential", 1.7],
  ["zoom"],
  5,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], WIDTH_MULT],
    [10, 0],
    1.2,
    [5, 15],
    1.2,
    [20, 30, 40],
    0.5,
    [25, 35, 45],
    0.5,
    [50, 60],
    0,
    [55, 65],
    0,
    [70, 80],
    0,
    [75, 85],
    0,
    1
  ],
  10,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], WIDTH_MULT],
    [10, 0],
    3,
    [5, 15],
    3,
    [20, 30, 40],
    0.75,
    [25, 35, 45],
    0.75,
    [50, 60],
    0,
    [55, 65],
    0,
    [70, 80],
    0,
    [75, 85],
    0,
    1
  ],
  12,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], WIDTH_MULT],
    [10, 0],
    4,
    [5, 15],
    4,
    [20, 30, 40],
    2.5,
    [25, 35, 45],
    2,
    [50, 60],
    0.5,
    [55, 65],
    0.5,
    [70, 80],
    0,
    [75, 85],
    0,
    1
  ],
  14,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], WIDTH_MULT],
    [10, 0],
    6,
    [5, 15],
    6,
    [20, 30, 40],
    3,
    [25, 35, 45],
    6,
    [50, 60],
    2,
    [55, 65],
    1,
    [70, 80],
    1,
    [75, 85],
    1,
    1
  ],
  18,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], WIDTH_MULT],
    [10, 0],
    32,
    [5, 15],
    32,
    [20, 30, 40],
    32,
    [25, 35, 45],
    32,
    [50, 60],
    16.5,
    [55, 65],
    24,
    [70, 80],
    1,
    [75, 85],
    1,
    1
  ]
],

  'line-opacity': [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    0.4,
    1
  ],

  'line-color':  [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    'chartreuse',
    COLOR
  ],

  'line-offset': [
  "interpolate",
  ["exponential", 1.7],
  ["zoom"],
  10,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], OFFSET_MULT],
    [10, 0],
    1,
    [5, 15],
    1,
    [20, 30, 40],
    1,
    [25, 35, 45],
    .75,
    [50, 60],
    0,
    [55, 65],
    0,
    [70, 80],
    0,
    [75, 85],
    0,
    1
  ],
  12,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], OFFSET_MULT],
    [10, 0],
    1.8,
    [5, 15],
    1.8,
    [20, 30, 40],
    2,
    [25, 35, 45],
    0,
    [50, 60],
    0.1,
    [55, 65],
    0,
    [70, 80],
    0,
    [75, 85],
    0,
    1
  ],
  14,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], OFFSET_MULT],
    [10, 0],
    3,
    [5, 15],
    0,
    [20, 30, 40],
    1.5,
    [25, 35, 45],
    0,
    [50, 60],
    1.1,
    [55, 65],
    1,
    [70, 80],
    0.5,
    [75, 85],
    0,
    1
  ],
  18,
  [
    "match",
    ["*", ["number", ["get", NETWORK_LEVEL]], OFFSET_MULT],
    [10, 0],
    0,
    [5, 15],
    0,
    [20, 30, 40],
    16,
    [25, 35, 45],
    0,
    [50, 60],
    8,
    [55, 65],
    0,
    [70, 80],
    1,
    [75, 85],
    0,
    1
  ]
]
})

export const ShshStyle =  {
  "id": "shst",
  "type": "line",
  "source": "ShstSource",
  "source-layer": "shared_streets_2019",
  beneath: 'road-label',
  layout: {
    'visibility': 'visible',
    'line-join': 'bevel',
    'line-cap': 'square'
  },
  paint: npmrdsPaint(n,w,o,'white')
};

export const npmrdsStyle =  {
  "id": "npmrds",
  "type": "line",
  "source": "npmrd2019Source",
  "source-layer": "npmrds_2019",
  beneath: 'road-label',
  layout: {
    'visibility': 'visible',
    'line-join': 'bevel',
    'line-cap': 'square'
  },
  paint: npmrdsPaint('f_system',w,o,'#6495ED')
};


// export const ShshStyleOutline =  {
//   "id": "shst",
//   "type": "line",
//   "source": "ShstSource",
//   "source-layer": "gtfs_conflation_qa",
//   beneath: 'road-label',
//   layout: {
//     'visibility': 'visible',
//     'line-join': 'round',
//     'line-cap': 'round'
//   },
//   paint: npmrdsPaint(n,w * 1.1,o,'rgba(0, 0, 0, 0.95)')
// };

export const GtfsEdgesStyle = {
  'id': 'gtfs-edges',
  'type': 'line',
  'source': 'gtfs-edges',
  'layout': {},
  'paint': {
	'line-color':  [
	    "case",
	    ["boolean", ["feature-state", "hover"], false],
	    '#FF8C00',
	    'slateblue'
	],
      'line-opacity': 0.8,
      'line-width': [
        "interpolate",
        ["exponential", 1.7],
        ["zoom"],
        5,
          1,
        18,
          30
      ]

  }
}

