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

  const col = db.collection('comundi');
  console.log('connected to db... fetching items...');
  const arr = await col.find().limit(200).toArray();
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
          begin: _.get(session, 'begin.date', null),
          end: _.get(session, 'end.date', null),
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
      { label: 'URL', name: 'url' },
      { label: 'Référence', name: 'ref' },
      { label: 'Catégories', name: 'categories' },
      { label: 'ID formation unique par session', name: 'sessionId' },
      { label: 'Durée en jours', name: 'days' }, // TODO
      { label: 'Durée en heures', name: 'hours' }, // TODO
      { label: 'Date Début', name: 'begin' },
      { label: 'Date Fin', name: 'end' },
//ok
      { label: 'Nom de la formation', name: 'title' }, //ok
      { label: 'Description', name: 'description' },
      { label: 'Points forts', name: 'pointsforts' },
      { label: 'Niveau', name: 'level' },
      { label: 'Durée', name: 'duration' },
      { label: 'Lieu', name: 'location' }, //ok
      { label: 'Public', name: 'public' }, //ok
      { label: 'Objectifs', name: 'goal' }, //ok
      { label: 'Prérequis', name: 'prerequisites' }, //ok
      { label: 'Nom du formateur', name: 'formateurName' },
      { label: 'Descritpion du formateur', name: 'formateurDesc' },
      { label: 'Prix HT', name: 'priceHt' },//ok
      { label: 'Programme', name: 'program' }, //ok
      // TODO: subtitle
      // TODO: modalité pédagogique
      // TODO: introduction...
      // TODO: format: inter,intra
    ],
    fieldSeparator : ';'
  };

  var out = fs.createWriteStream("comundi-output.csv", {encoding: 'utf8'})
  var readable = es.readArray(items)
  readable
    .pipe(jsoncsv.csv(options))
    .pipe(out)

})();
