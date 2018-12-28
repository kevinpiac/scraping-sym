const chrono = require('chrono-node');

console.log(chrono.fr.parseDate('Du 07 au 08 février 2019'));
var Sherlock = require('sherlockjs');
var sherlocked1 = Sherlock.parse('Homework 5 due next monday at 3pm');
var sherlocked2 = Sherlock.parse('Du 07 au 08 février 2019');
console.log(sherlocked1)
console.log(sherlocked2)
