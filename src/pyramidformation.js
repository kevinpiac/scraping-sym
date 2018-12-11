// pyramyd-formation
// https://pyramyd-formation.com/formation/tout
//
//
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const puppeteer = require('puppeteer');
const _ = require('lodash');

const pages = [
  'https://pyramyd-formation.com/formation/tout?page=0',
  'https://pyramyd-formation.com/formation/tout?page=1',
  'https://pyramyd-formation.com/formation/tout?page=2',
  'https://pyramyd-formation.com/formation/tout?page=3',
  'https://pyramyd-formation.com/formation/tout?page=4',
  'https://pyramyd-formation.com/formation/tout?page=5',
  'https://pyramyd-formation.com/formation/tout?page=6',
  'https://pyramyd-formation.com/formation/tout?page=7',
  'https://pyramyd-formation.com/formation/tout?page=8',
];

const getAllItemsUrlFromPage = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);
  const pageItems = await page.evaluate(() => {
    return [...document.querySelectorAll('.item-list li .field-content a')].map(link => {
      const regex = /\bhttps:\/\/pyramyd-formation.com\/formation\/\b(.)*/;
      return (link.href.match(regex) ? link.href : null);
    }).filter(val => val !== null);
  });
  await page.close();
  return pageItems;
};

const getText = (page, selector) => {
  return page.evaluate((selector) => {
    return document.querySelector(selector) ? document.querySelector(selector).innerText : null;
  }, selector);
};

const moment = require('moment');

const parseDate = (string, format, hours, minutes) => {
  console.log(string);
  const dateString = string.replace('é', 'e');
  const m = moment(dateString, format, 'fr').hours(hours).minutes(minutes);
  console.log('---> parsed', dateString, ' ==== ', m.format());
  const res = {
    date: moment(m).format('YYYY-MM-DD[T]HH:mm:ss'),
    dateTz: moment(m).format(),
    timestamp: moment(m).format('X'),
    text: moment(m).format('dddd Do MMMM YYYY'),
  };
  console.log(res);
  console.log('\n\n');
  return res;
};

const monthsMap = {
  'janv.': 01, // sure
  'févr.': 02, // sure
  'mars': 03, // sure
  'avr.': 04, // sure
  'mai': 05, // sure
  'juin': 06, // sure
  'juil.': 07, // sure
  'août': 08, // sure
  'sept.': 09, // sure
  'oct.': 10, // sure
  'nov.': 11, // sure
  'déc.': 12 // sure
};

const browseItem = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);

  const title = await getText(page, 'h1');
  const description = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-sub-title.field--type-text-long.field--label-hidden.field__item');
  const categories = await page.evaluate(() => {
    const res = [...document.querySelectorAll('.breadcrumb__item')].map((item) => item.innerText);
    res.shift();
    return res || [];
  });
  const sessions = await page.evaluate(() => {
    const res = [...document.querySelectorAll('#edit-comming-sessions > fieldset')].map((session) => {
      return {
        location: session.querySelector('span.fieldset-legend').innerText,
        dates: [...session.querySelectorAll('label.option')].map(item => item.innerText),
      };
    });
    return res;
  });

  // PATTERN 1
// 04 et 05 déc. 2018
// 03 et 04 déc. 2018
// 03 et 04 déc. 2000
// 19 au 21 déc. 2018
// 03 au 04 déc. 2001
// 19 au 21 déc. 2018
// 09 au 13 sept. 2019
// 14 au 16 janv. 2019
//
// // PATTERN 2
// 06 nov. 2018
// 06 nog 2019
// 08 NOv 2019
// 08 NOV. 2019
// 20 déc. 2018
// 20 juin. 2018
//
// // PATTERN 3
// 25 sept. 2019 au 15 janv. 2020
//
// // PATTERN 4
// 14 janv. au 05 juin 2019
// 14 janvd. au 05 juin 2019
// 31 janv. et 01 févr. 2019
  if (sessions && sessions.length) {
    sessions.forEach((session) => {
      const dates = session.dates.map((date) => {
        const pattern1 = /^[0-9]{2}.{0,2}\b [a-z-A-Z]{0,2} [0-9]{2}.{0,6} [0-9]{4}$/ // 04 et 05 déc. 2018 OR 03 au 08 déc. 2018
        const pattern2 = /^[0-9]{2}\b .{1,5} \b[0-9]{4}$/ // 06 nov. 2018 OR 06 nov 2019 08 NOV 2019 OR 08 NOV. 2019
        const pattern3 = /^[0-9]{2} .{0,6} [0-9]{1,4} [a-zA-Z]{1,3} [0-9]{2} .{0,6} [0-9]{4}$/ // 25 sept. 2019 au 15 janv. 2020
        const pattern4 = /^[0-9]{2} .{1,6} [a-z]{2} [0-9]{2} .{1,9} [0-9]{4}$/ // 14 janv. au 05 juin 2019 31 janv. et 01 févr. 2019
        const s = date.trim().split(' ');
        let daystart = null;
        let dayend = null;
        let monthStart = null;
        let monthEnd = null
        let yearStart = null;
        let yearEnd = null;
        // console.log('MATCH1', date.trim().match(pattern1));
        // console.log('MATCH2', date.trim().match(pattern2));
        if (date.trim().match(pattern1)) {
          console.log(date, '--- Matches p1');
          daystart = s[0];
          dayend = s[2];
          monthStart = monthsMap[s[3]];
          monthEnd = monthStart;
          yearStart = s[4];
          yearEnd = yearStart;
        } else if (date.trim().match(pattern2)) {
          console.log(date, '--- Matches p2');
          daystart = s[0];
          dayend = s[0];
          monthStart = monthsMap[s[1]];
          monthEnd = monthStart;
          yearStart = s[2];
          yearEnd = yearStart;
        } else if (date.trim().match(pattern3)) {
          console.log(date, '--- Matches p3');
          daystart = s[0];
          dayend = s[4];
          monthStart = monthsMap[s[1]];
          monthEnd = monthsMap[s[5]]
          yearStart = s[2];
          yearEnd = s[6];
        } else if (date.trim().match(pattern4)) {
          console.log(date, '--- Matches p4');
          daystart = s[0];
          dayend = s[3];
          monthStart = monthsMap[s[1]];
          monthEnd = monthsMap[s[4]]
          yearStart = s[5];
          yearEnd = s[5];
        } else {
          console.log(date, 'NO MATCH');
        }
        const dateStart = `${daystart} ${monthStart} ${yearStart}`;
        const dateEnd = `${dayend} ${monthEnd} ${yearEnd}`;

        console.log(date.trim(), ' <--s--> ', dateStart);
        console.log(date.trim(), ' <--e--> ', dateEnd);
        if (!session.formatedDates) {
          session.formatedDates = [];
        }
        session.formatedDates.push({
          begin: parseDate(dateStart, 'DD MM YYYY', 09, 00),
          end: parseDate(dateEnd, 'DD MM YYYY', 17, 30),
        })
      });
    });
  }
  const level = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-level-of-difficulty.field--type-entity-reference.field--label-hidden.field__item > div');
  const duration = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-duration-of-training.field--type-string.field--label-hidden.field__item');
  const location = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-location-of-training.field--type-entity-reference.field--label-hidden.field__items > div > div');
  const public = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-concerned-public.field--type-text-long.field--label-above > div.field__item');
  const goal = await getText(page, 'div.clearfix.text-formatted.field.field--name-objectives.field--type-text-long.field--label-above > div.field__item');
  let requirements = await getText(page, 'div.clearfix.text-formatted.field.field--name-prerequisite.field--type-text-long.field--label-above > div.field__item');
  let competence_acquises = null;
  if (requirements.split('Compétences acquises:').length > 1) {
    competence_acquises = requirements.split('Compétences acquises:')[1];
  }
  let priceHt = await getText(page, '#edit-company-markup-b2b');
  if (priceHt) {
    priceHt = priceHt.split('€')[0];
  }
  const ref = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-right > div > div.block.block-ctools.block-entity-viewnode > div > div.field.field--name-training-ref-id.field--type-string.field--label-inline > div.field__item');
  const program = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-program.field--type-entity-reference-revisions.field--label-above > div.field__items > div > div > div > div');
  const item = {
    url,
    competence_acquises,
    sessions,
    title,
    categories,
    level,
    duration,
    location,
    public,
    goal,
    requirements,
    priceHt,
    ref,
    program,
  };
  await page.close();
  return item;
};

const browseBatchAndGoNext = async (browser, batches, index, lastRes, db) => {
  if (index === batches.length) {
    console.log('DONE', lastRes);
    return lastRes;
  }
  const res = await Promise.all(batches[index].map((itemUrl) => browseItem(browser, itemUrl)));
  const result = res;
  console.log(`Saving results... [${index}]:`, result.length);
  // console.log(result);
  await db.collection('pyramyd-formation').insertMany(result);
  console.log(`SAVED batch ${index} of ${batches.length}`);
  return browseBatchAndGoNext(browser, batches, index + 1, result, db);
};

(async () => {
  const url = 'mongodb://mrsoyer:adty5M-cj@ds145620-a1.mlab.com:45620/sym';
  const dbName = 'sym';
  const client = new MongoClient(url);

  await client.connect();
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  const browser = await puppeteer.launch({ headless: true });
  // const r0 = await browseItem(browser, 'https://pyramyd-formation.com/formation/photo-prise-de-vues-avec-un-smartphone')//https://pyramyd-formation.com/formation/l-experience-utilisateur-ux-les-meilleures-pratiques');
  // const r = await browseItem(browser, 'https://pyramyd-formation.com/formation/l-experience-utilisateur-ux-les-meilleures-pratiques');
  // const r1 = await browseItem(browser, 'https://pyramyd-formation.com/formation/charge-de-conception-et-de-realisation-web-0');

  const p = await browseItem(browser, 'https://pyramyd-formation.com/formation/charge-de-creation-web-0'); // CAS ENVOYé PAR EMAIL
  // //https://pyramyd-formation.com/formation/indesign-niveau-1-1

  // // CAS AVEC START DATE === ENDDATE
  // const p = await browseItem(browser, 'https://pyramyd-formation.com/formation/photo-prise-de-vues-avec-un-smartphone');
  console.log(p);
  return;
  // console.log(r0);
  // console.log(r);
  // console.log(r1);
  const res = await Promise.all(pages.map((page) => getAllItemsUrlFromPage(browser, page)));
  console.log(`Got ${res.length} pages to scrap`);
  const allItems = _.flatten(res);
  console.log(`Got ${allItems.length} items to browse`);
  const chunks = _.chunk(allItems, 4);
  console.log(`Got ${chunks.length} batches to browse`);
  await browseBatchAndGoNext(browser, chunks, 0, [], db);
  console.log('DONE');
})();
