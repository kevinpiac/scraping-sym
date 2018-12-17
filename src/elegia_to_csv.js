// pyramyd-formation
// https://pyramyd-formation.com/formation/tout
//
//
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const puppeteer = require('puppeteer');
const _ = require('lodash');
const uuidv1 = require('uuid/v1');

(async () => {
  const url = 'mongodb://mrsoyer:adty5M-cj@ds145620-a1.mlab.com:45620/sym';
  const dbName = 'sym';
  const client = new MongoClient(url);

  await client.connect();
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  const col = db.collection('elegia2');
  const arr = await col.find().toArray();
  console.log('got:', arr.length, 'items');
  const res = arr.map((elem) => {
    const orignItem = elem;
    orignItem.categories = orignItem.categories.map(e => e.name).join(',');
    // Duplicate item for each session
    let newItemsPerSession = [];
    if (!elem.sessions || !elem.sessions.length) {
      newItemsPerSession.push(orignItem);
    } else {
      newItemsPerSession = elem.sessions.map((session) => {
        return {
          sessionId: uuidv1(),
          begin: session.begin.date,
          end: session.end.date,
          location: session.location,
          ...orignItem,
        };
      });
    }

    // Duplicate item for each formator
    let newItemsPerFormators = [];
    if (orignItem.formateurs && orignItem.formateurs.length) {
      newItemsPerFormators = orignItem.formateurs.map(e => {
        return {
          formateurName: e.name,
          formateurDesc: e.description,
          ...orignItem,
        };
      });
    }
    return [...newItemsPerSession, ... newItemsPerFormators];
  });
  const flat = _.flattenDeep(res);
  console.log(flat.length);

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
    fields: [
      { label: 'Url', name: 'url' },
      { label: 'Titre', name: 'title' },
      { label: 'Description', name: 'description' },
      { label: 'Catégories', name: 'categories' },
      { label: 'Points forts', name: 'pointsforts' },
      { label: 'Niveau', name: 'level' },
      { label: 'Durée', name: 'duration' },
      { label: 'Lieu', name: 'location' },
      { label: 'Public', name: 'public' },
      { label: 'Objectifs', name: 'goal' },
      { label: 'Prérequis', name: 'prerequisite' },
      { label: 'Nom du formateur', name: 'formateurName' },
      { label: 'Descritpion du formateur', name: 'formateurDesc' },
      { label: 'Prix HT', name: 'priceHt' },
      { label: 'Référence', name: 'ref' },
      { label: 'Programme', name: 'program' },
      { label: 'Date Début', name: 'begin' },
      { label: 'Date Fin', name: 'end' },
      { label: 'Réf Session', name: 'sessionId' },
    ],
    fieldSeparator : ';'
  };

  var out = fs.createWriteStream("elegia-output2.csv", {encoding: 'utf8'})
  var readable = es.readArray(items)
  readable
    .pipe(jsoncsv.csv(options))
    .pipe(out)

})();
