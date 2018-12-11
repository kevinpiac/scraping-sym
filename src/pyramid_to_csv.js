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
    orignItem.categories = orignItem.categories.join(',');
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

  // flat.forEach((e) => {
  //   console.log(`e.cats: ${e.categories}, e.begin: ${e.begin}, e.end: ${e.end}, e.url: ${e.url}\n`);
  // });

  /////////// HERE WE GO
  ///////////
  ///////////
  ///////////

  var fs = require("fs")
  var es = require("event-stream")
  var jsoncsv = require('json-csv');
  const items = flat;

  const options = {
    // begin
    // end
    // url,
    // isCertified,
    // cpf,
    // competence_acquises,
    // sessions,
    // title,
    // categories,
    // level,
    // duration,
    // location,
    // public,
    // goal,
    // requirements,
    // priceHt,
    // ref,
    // program,
    fields: [
      { label: 'Url', name: 'url' },
      { label: 'Certifié', name: 'isCertified' },
      { label: 'CPF', name: 'cpf' },
      { label: 'Compétences Acquises', name: 'competence_acquises' },
      { label: 'Titre', name: 'title' },
      { label: 'Catégories', name: 'categories' },
      { label: 'Niveau', name: 'level' },
      { label: 'Durée', name: 'duration' },
      { label: 'Lieu', name: 'location' },
      { label: 'Public', name: 'public' },
      { label: 'Objectifs', name: 'goal' },
      { label: 'Prérequis', name: 'requirements' },
      { label: 'Prix HT', name: 'priceHt' },
      { label: 'Référence', name: 'ref' },
      { label: 'Programme', name: 'program' },
      { label: 'Date Début', name: 'begin' },
      { label: 'Date Fin', name: 'end' },
    ],
    fieldSeparator : ';'
  };

  var out = fs.createWriteStream("pyramyd-output.csv", {encoding: 'utf8'})
  var readable = es.readArray(items)
  readable
    .pipe(jsoncsv.csv(options))
    .pipe(out)

})();
