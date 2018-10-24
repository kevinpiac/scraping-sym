// pyramyd-formation
// https://pyramyd-formation.com/formation/tout
//
//
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const config = {
  steps: [
    {
      open: 'https://pyramyd-formation.com/formation/tout',
      options: {
        headless: false,
      },
    },
    {

    },
  ],
};

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
  const level = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-level-of-difficulty.field--type-entity-reference.field--label-hidden.field__item > div');
  const duration = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-duration-of-training.field--type-string.field--label-hidden.field__item');
  const location = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-location-of-training.field--type-entity-reference.field--label-hidden.field__items > div > div');
  const public = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-concerned-public.field--type-text-long.field--label-above > div.field__item');
  const goal = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-objectives.field--type-text-long.field--label-above > div.field__item > p');
  const requirements = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-prerequisite.field--type-text-long.field--label-above > div.field__item > p');
  let priceHt = await getText(page, '#edit-company-markup-b2b');
  if (priceHt) {
    priceHt = priceHt.split('€')[0];
  }
  const ref = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-right > div > div.block.block-ctools.block-entity-viewnode > div > div.field.field--name-training-ref-id.field--type-string.field--label-inline > div.field__item');
  const program = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.clearfix.text-formatted.field.field--name-program.field--type-entity-reference-revisions.field--label-above > div.field__items > div > div > div > div');
  const item = {
    url,
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
  console.log(result);
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
  // const r = await browseItem(browser, 'https://pyramyd-formation.com/formation/l-experience-utilisateur-ux-les-meilleures-pratiques');
  const res = await Promise.all(pages.map((page) => getAllItemsUrlFromPage(browser, page)));
  console.log(`Got ${res.length} pages to scrap`);
  const allItems = _.flatten(res);
  console.log(`Got ${allItems.length} items to browse`);

  const chunks = _.chunk(allItems, 4);
  console.log(`Got ${chunks.length} batches to browse`);

  await browseBatchAndGoNext(browser, chunks, 0, [], db);
  console.log('DONE');
})();
