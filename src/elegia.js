
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const moment = require('moment');

const puppeteer = require('puppeteer');
const _ = require('lodash');

const baseUrl = 'https://www.elegia.fr/formations';



const getText = (page, selector) => {
  return page.evaluate((selector) => {
    return document.querySelector(selector) ? document.querySelector(selector).innerText : null;
  }, selector);
};

const getFormateurs = (page) => {
  return page.evaluate(() => {
    return [...document.querySelectorAll('#block-views-formateurs-block--2 .views-row')].map(formateur => {
        const name = formateur.querySelector('.nom').innerText;
        const description = formateur.querySelector('p').innerText;
        return { name, description }
    });
  });
};

const browseItem = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);

  const title = await getText(page, 'h1');
  const description = await getText(page, '.panel-pane.fiche-intro.readmore');
  const categories = await page.evaluate(() => {
    const res = [... document.querySelectorAll('.easy-breadcrumb li:not(:first-child):not(:last-child) a')].map((el, i) => {
      return {
        level: i,
        name: el.innerText,
        url: el.href,
      };
    });
    return res || [];
  });
  const sessions = await page.evaluate(() => {
   const res = [...document.querySelectorAll('.dates-et-lieux')].map((session) => {
     return {
       location: session.querySelector('.adresse').innerText,
       dates: [...session.querySelectorAll('ul > li')].map(item => item.innerText),
     };
   });
   return res;
  });

  if (sessions && sessions.length) {
    sessions.forEach((session) => {
//      console.log('\n\n----- SESSION -----');
      let dates = session.dates.map((date) => {
        const splits = date.split(',');
        const dates = splits.map((dateGroup) => {
          let date = dateGroup.trim().split(' ');
          let daysGroup = date[0];
          if (dateGroup.match(/\bDu.*\b au .*/)) {
            return dateGroup.split('Du')[1].trim().split(' au ').map((d) => {
              return parseDate(d, 'DD MMMM');
            });
          }
          if (daysGroup.indexOf('-') === -1) {
            return parseDate(dateGroup.trim(), 'dddd DD MMMM YYYY');
          }
          let month = date[1];
          let year = date[2];
          const dates = daysGroup.split('-').map((day) => parseDate(`${day} ${month} ${year}`, 'DD MMMM YYYY'));
          return dates;
        });
        return dates;
      });
      dates = _.flattenDeep(dates);
      // session.allDates = dates;
      session.begin = dates[0];
      session.end = dates[dates.length - 1];
    });
  }

  // const level = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-level-of-difficulty.field--type-entity-reference.field--label-hidden.field__item > div');
  const duration = await getText(page, '.duree-jour-not');
  const formateurs = await getFormateurs(page);
  // const location = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-location-of-training.field--type-entity-reference.field--label-hidden.field__items > div > div');
  const public = await getText(page, '#public-et-prerequis .field-name-field-formation-public')
  const goal = await getText(page, '.formation-content-objectif > .formation-content-resume');
  let prerequisite = await getText(page, '#public-et-prerequis');
  if (prerequisite) {
    const splits = prerequisite.split('Prérequis');
    if (splits.length >= 2) {
      prerequisite = splits[1];
    } else {
      prerequisite = null;
    }
  }
  let priceHt = await getText(page, '.prix-inter');
  if (priceHt) {
    priceHt = priceHt.split(' €')[0];
  }
  ref = await getText(page, '.page-formations-header-type')
  if (ref) {
    ref = ref.split('#')[1];
  }
  let pointsforts = await getText(page, '#points-forts');
  if (pointsforts && pointsforts.indexOf('Points forts') === 0) {
    pointsforts = pointsforts.substr(12, pointsforts.length);
  }
  const program = await getText(page, '#programme');
  const item = {
    url,
    sessions,
    title,
    description,
    categories,
    // level,
    duration,
    public,
    goal,
    prerequisite,
    priceHt,
    ref,
    program,
    pointsforts,
    formateurs,
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
  await db.collection('elegia').insertMany(result);
  console.log(`SAVED batch ${index + 1} of ${batches.length}`);
  return browseBatchAndGoNext(browser, batches, index + 1, result, db);
};

const goNextPage = async (page, currentPage) => {
  const isLastPage = await page.evaluate(() => {
    return !document.querySelector('.pager-next');
  });
  if (isLastPage) {
    return 'LAST_PAGE';
  }
  const nextPage = await page.evaluate(() => {
    return document.querySelector('.pager-current+.pager-item').innerText;
  });
  console.log(`Current page: #${currentPage}, going to #${nextPage}`);
  await page.click('.pager-next');
  console.log('Is Loading');
  await page.waitForFunction((nextPage) => {
    return document.querySelector('.pager-current').innerText === nextPage;
  }, {}, nextPage);
  await page.waitFor(400);
  console.log('Loaded');
};

const browseAllPages = async (page, start, lastItems) => {
  const items = await getAllItemsUrlFromPage(page);
  const res = await goNextPage(page, start);
  if (res === 'LAST_PAGE') {
    console.log('LAST_PAGE');
    return [...lastItems, ...items];
  }
  return browseAllPages(page, start + 1, [...lastItems, ...items]);
};

const getAllItemsUrlFromPage = async (page) => {
  const pageItems = await page.evaluate(() => {
    return [...document.querySelectorAll('.formation-teaser .title a')].map(link => link.href);
  });
  return pageItems;
};

const parseDate = (dateString, format) => {
  if (!format) {
    format = 'dddd Do MMMM YYYY';
  }
  console.log('PARSE', dateString, '->', format);
  const m = moment(dateString, format, 'fr');
  console.log('--->', moment(m).format())
  return {
    date: moment(m).format(),
    timestamp: moment(m).format('X'),
    text: moment(m).format('dddd Do MMMM YYYY'),
  };
};

(async () => {
  const url = 'mongodb://mrsoyer:adty5M-cj@ds145620-a1.mlab.com:45620/sym';
  const dbName = 'sym';
  const client = new MongoClient(url);

  await client.connect();
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page.waitForFunction(() => !!document.querySelector('#adroll_banner_close'));
  await page.click('#adroll_banner_close');
  await page.waitFor(2000);
  const itemsToBrowse = await browseAllPages(page, 1, []);
  console.log(`${itemsToBrowse.length} to browse`);
  const chunks = _.chunk(itemsToBrowse, 10);
  // const chunks = [
  // ['https://www.elegia.fr/formations/3-minutes-convaincre_512000-0'],
  // // ['https://www.elegia.fr/formations/3-minutes-convaincre_512000'],
  // ];
  console.log(`Got ${chunks.length} batches to browse`);
  await browseBatchAndGoNext(browser, chunks, 0, [], db);
  // const item = await browseItem(browser, 'https://www.elegia.fr/formations/etre-responsable-ressources-humaines-rrh_119005');
  // const item2 = await browseItem(browser, 'https://www.elegia.fr/formations/arreter-cloturer-comptes-annuels_550004-0');
  // const item3 = await browseItem(browser, 'https://www.elegia.fr/formations/actualite-sociale-2018-atelier-negociation-collective-integrer-nouvelles-obligations_600539#dates-et-lieux');
  // console.log(item);
  // console.log(item2);
  // console.log(item3);
})();
