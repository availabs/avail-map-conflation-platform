const { padStart } = require('lodash');

module.exports = (table, region, year) =>
  `${table}_R${padStart(region, 2, '0')}_${year}.csv`;
