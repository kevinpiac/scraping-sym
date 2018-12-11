// pyramyd-formation
// https://pyramyd-formation.com/formation/tout
//
//
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const puppeteer = require('puppeteer');
const _ = require('lodash');

(async () => {
  const url = 'mongodb://mrsoyer:adty5M-cj@ds145620-a1.mlab.com:45620/sym';
  const dbName = 'sym';
  const client = new MongoClient(url);

  await client.connect();
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  const col = db.collection('pyramyd-formation');
  const arr = await col.find().limit(40).toArray();
  const res = arr.map((elem) => {
    const orignItem = elem;
    let newItems = [];
    if (!elem.sessions || !elem.sessions.length) {
      newItems.push(orignItem);
    } else {
      newItems = elem.sessions.map((session) => {
        const items = session.formatedDates.map(date => {
          return {
            begin: date.begin.date,
            end: date.end.date,
            ...orignItem,
          };
        });
        return items;
      });
    }
    return newItems;
  });

  const flat = _.flattenDeep(res);

  flat.forEach((e) => {
    console.log(`e.begin: ${e.begin}, e.end: ${e.end}, e.url: ${e.url}\n`);
  });
})();
