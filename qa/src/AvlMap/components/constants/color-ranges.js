import colorbrewer from "colorbrewer"

import get from "lodash.get"

const COLOR_RANGES = {}

for (const type in colorbrewer.schemeGroups) {
	colorbrewer.schemeGroups[type].forEach(name => {
		const group = colorbrewer[name];
		for (const length in group) {
			if (!(length in COLOR_RANGES)) {
				COLOR_RANGES[length] = [];
			}
			COLOR_RANGES[length].push({
				type,
				name,
				category: "Colorbrewer",
				colors: group[length]
			})
		}
	})
}

export default COLOR_RANGES

const getColorRange = (size, name) =>
	get(COLOR_RANGES, [size], [])
		.reduce((a, c) => c.name === name ? c.colors : a, []).slice()
//console.log("COLOR_RANGES", COLOR_RANGES)
export { getColorRange }
