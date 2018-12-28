
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const puppeteer = require('puppeteer');
const _ = require('lodash');
const moment = require('moment');

const baseUrl = 'https://www.comundi.fr/';

const getText = (page, selector) => {
  return page.evaluate((selector) => {
    return document.querySelector(selector) ? document.querySelector(selector).innerText : null;
  }, selector);
};

const getTextByRegex = (page, params) => {
  return page.evaluate((params) => {
    const arr = [...document.querySelectorAll(params.baseSelector)].filter((e) => {
      const regex = new RegExp(params.regex);
      return regex.test(e[params.applyOn]);
    }).map(e => (e ? e.innerText.trim() : null));
    if (arr && arr.length) {
      return arr[0];
    }
    return null;
  }, params);
};

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

const browseItem = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);

  const title = await getText(page, 'h1');
  const description = await getText(page, 'h2.small');
  const sessions = await page.evaluate(() => {
    return [...document.querySelectorAll('#filtre-data.sessions tr')]
    .map(e => {
      const startDateSel = e.querySelector('span[itemprop="startDate"]')
      const endDateSel = e.querySelector('span[itemprop="endDate"]')
      const datestringSel = e.querySelector('tr:nth-child(1) > th > div');
      let dateString = null;
      const location = e.attributes['data-ville'].value;
      let startDate = null;
      if (startDateSel && startDateSel.attributes && startDateSel.attributes.content) {
        startDate = startDateSel.attributes.content.value;
      }
      let endDate = null;
      if (endDateSel && endDateSel.attributes && endDateSel.attributes.content) {
        endDate = endDateSel.attributes.content.value;
      }

      let isString = false;
      // If old format selector not working
      if (!startDate && datestringSel) {
        startDate = datestringSel.innerText;
        isString = true;
      }
      return { startDate, endDate, location, isString };
    });
  });
  sessions.forEach((session) => {
    if (session.startDate) {
      if (session.isString) {
        const s = session.startDate.trim().split(' ');
        let daystart = null;
        let dayend = null;
        let monthStart = null;
        let monthEnd = null
        let yearStart = null;
        let yearEnd = null;
        const pattern1 = /^Du [0-9]{2}.{0,2}\b [a-z-A-Z]{0,2} [0-9]{2}.{0,2} .{0,20} [0-9]{4}$/; // Du 22 au 23 janvier 2019
        if (session.startDate.trim().match(pattern1)) {
          console.log(date, '--- Matches p1');
          daystart = s[1];
          dayend = s[3];
          monthStart = s[4];
          monthEnd = monthStart;
          yearStart = s[5];
          yearEnd = yearStart;
          session.begin = parseDate(`${yearStart}-${monthStart}-${daystart}`, 'YYYY-MMMM-DD', 09, 00);
        }
      } else {
        session.begin = parseDate(session.startDate, 'YYYY-MM-DD', 09, 00);
      }
    } else {
      session.begin = null;
    }
    if (session.endDate) {
      session.end = parseDate(session.endDate, 'YYYY-MM-DD', 17, 30);
    } else {
      session.end = session.begin;
    }
  });

  // const level = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-level-of-difficulty.field--type-entity-reference.field--label-hidden.field__item > div');
  // MATCHING
  // 1 jour - 7 h
  // 3 jours - 21 h
  // 3 heures - 21 h
  // 7heures
  // 1heure
  // 10 heures
  //
  // NOT MATCHING
  // 30 minutes
  // 1 lol - 7 h
  const duration = await getTextByRegex(page, {
    regex: '^.{0,5}(jour|h).*$',
    baseSelector: '.fiche th',
    applyOn: 'innerText',
  });
  // const location = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-location-of-training.field--type-entity-reference.field--label-hidden.field__items > div > div');
  const public = await getText(page, '#public div')
  const goal = await getText(page, '#objectifs > div');
  const prerequisites = await getText(page, '#pre-requis > div');
  const priceHt = await page.evaluate(() => {
    const pattern = /^[0-9\s]{1,9}[,.]{1}[0-9]{0,2}\s{0,}€\sHT$/; // 995.00  € HT OR 2 245.00  € HT
    const res = [...document.querySelectorAll('.fiche td')].filter(e => pattern.test(e.innerText)).map(e => e.innerText)
    return (res.length ? res[0].split('€')[0].trim() : null);
  });
  let ref = await getText(page, '.ref')
  if (ref) {
    ref = ref.split(' ')[1].trim();
  }
  const formateurs = await page.evaluate(() => {
    return [...document.querySelectorAll('#intervenants a.link-block')].map(e => {
      let name = e.querySelector('.h5')
      let description = null;
      if (name) {
        name = name.innerText;
      }
      if (e && name) {
        description = e.innerText.split(name)[1].split('En savoir plus')[0].trim();
      }
      return {
        name,
        description,
      };
    });
  });
  const pointsforts = await getText(page, '#points-forts');
  const program = await getText(page, '#programme+div');

  const getParentCategory = async (page) => {
    return await page.evaluate(() => {
      const parents = [...document.querySelectorAll('#wo-breadcrumbs a')].filter(e => {
        const regex = new RegExp('^https://www.comundi.fr/.{1,}$');
        return regex.test(e.href)
      });

      if (parents.length) {
        return {
          name: parents[0].innerText,
          url: parents[0].href,
        };
      } else {
        return null;
      }
    });
  };

  const getAllParentCategories = async (page, categories, i) => {
    const category = await getParentCategory(page);
    console.log('Category', i, ':', category);
    if (category && category.name !== 'Thèmes des formations') {
      categories.push(category);
      await page.goto(category.url);
      await page.waitForSelector('#wo-breadcrumbs');
      return getAllParentCategories(page, categories, i + 1);
    }
    return categories;
  };

  let categories = await getAllParentCategories(page, [], 0)
  categories = categories.map((cat, i, arr) => {
    // reverting the array to find levels
    return {
      ...cat,
      level: arr.length - i - 1,
    };
  });

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
    prerequisites,
    priceHt,
    ref,
    program,
    formateurs,
  };
  await page.close();
  return item;
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

const getAllItemsUrlFromPage = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);
  const pageItems = await page.evaluate(() => {
    return [...document.querySelectorAll('.result-formation h2 > a')].map(link => link.href)
  });
  page.close();
  return pageItems;
};

const loopSequence = async (sequence, sequenceArgs, evaluate, onEnd, count, prevRes) => {
  const i = count ? count : 0;
  const res = await Promise.resolve(sequence(prevRes, i, sequenceArgs));
  const shouldContinue = await Promise.resolve(evaluate(res, i, sequenceArgs));
  if (!shouldContinue) {
    return Promise.resolve(onEnd(res, i));
  }
  return loopSequence(sequence, sequenceArgs, evaluate, onEnd, i + 1, res);
};

const getAllCategoryLinksSequence = async (browser) => {
  const page = await browser.newPage();
  await page.goto('https://www.comundi.fr/toutes-nos-formations.html');
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('.btn.btn-tag')].map(link => link.href);
  });
  await page.close();
  return links;
};

const getAllSubCategoryLinksSequence = async (browser, mainCategoryUrl) => {
  const page = await browser.newPage();
  await page.goto(mainCategoryUrl);
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('.panel.panel-default a')].map(link => link.href);
  });
  await page.close();
  return links;
};

const loopBatches = async (batches, apply, onEnd) => {
  console.log(`Starting #${batches.length} processes`);
  const res = await Promise.all(batches.map(batch => apply(batch)))
  return onEnd(res);
}

(async () => {
  const url = 'mongodb://mrsoyer:adty5M-cj@ds145620-a1.mlab.com:45620/sym';
  const dbName = 'sym';
  const client = new MongoClient(url);

  await client.connect();
  console.log("Connected correctly to server");

  const db = client.db(dbName);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  // const browser = await puppeteer.launch({ headless: true });

// FETCH ALL ITEMS AND STORE IN DB
//  const categories = await getAllCategoryLinksSequence(browser);
//  console.log(`Got #${categories.length} categories`);
////
//  const categoriesBatches = _.chunk(categories, 10);
//  const subcategories = await loopBatches(categoriesBatches, async (categories) => {
//    return loopSequence(async (prevRes, i, batch) => {
//      console.log(`--> ${i}`);
//      const res = await getAllSubCategoryLinksSequence(browser, batch[i]);
//      return [...prevRes, ...res];
//    }, categories, (res, i, batch) => {
//      console.log(`Batch #${i}, done`);
//      if (i >= batch.length - 1) {
//        return false;
//      }
//      return true;
//    }, (res) => {
//      console.log(`Got #${res.length} subcategories`);
//      return res;
//    }, 0, []);
//  }, async (res) => {
//    const flat = _.flatten(res);
//    console.log(`ALL PROCESSED DONE, GOT #${flat.length} subcategories`);
//    return flat;
//  });
////
//  //// Sample
//  //// const subcategories = [
//  ////   'https://www.comundi.fr/social-et-medico-social-1/formation-evaluation-et-demarches-qualite-1.html',
//  ////   'https://www.comundi.fr/social-et-medico-social-1/formation-expertise-metiers-1.html',
//  //// ];
////
//  const subcategoriesBatches = _.chunk(subcategories, 30);
//  const items = await loopBatches(subcategoriesBatches, async (subcategories) => {
//    return loopSequence((async (prevRes, i, batch) => {
//      console.log(`--> ${i}`);
//      const res = await getAllItemsUrlFromPage(browser, batch[i]);
//      return [...prevRes, ...res];
//    }), subcategories, async (res, i, batch) => {
//      console.log(`Batch #${i}, done`);
//      if (i >= batch.length - 1) {
//        return false;
//      }
//      return true;
//    }, async (res) => {
//      console.log(`Got #${res.length} items`);
//      return res;
//    }, 0, []);
//  }, async (res) => {
//    const flat = _.flatten(res);
//    console.log(`ALL PROCESSED DONE`);
//    return flat;
//  });
////
//  await db.collection('comundiItems').insertMany(items.map(e => { return { url: e }}));
//
///// END




//Sample
   const items = [
     { url: 'https://www.comundi.fr/formation-gpec-1/formation-optimisez-vos-achats-de-formation.html'},
     // { url: 'https://www.comundi.fr/formation-epreuves-filiere-technique/concours-d-ingenieur-e-territorial-par-voie-externe-ecrit.html'},
     // { url: 'https://www.comundi.fr/formation-achat-public/grand-forum-des-marches-publics-2018.html' },
     // { url: 'https://www.comundi.fr/formation-droit-des-societes/formation-le-redressement-judiciaire-et-la-mise-en-liquidation-d-une-societe.html' },
     // { url: 'https://www.comundi.fr/formation-evaluation-et-demarches-qualite/formation-mettre-en-place-une-evaluation-externe.html' },
     // { url: 'https://www.comundi.fr/formation-pilotage-strategique-et-management-des-etablissements/formation-piloter-un-projet-systemique-de-qualite-de-vie-au-travail-pour-son-etablissement.html' },
   ];


// const items = await db.collection('comundiItems').find({}).toArray();
console.log(`Got #${items.length} items`);


//const itemBatches = _.chunk(items, 400);
//await loopBatches(itemBatches, async (items) => {
// return loopSequence(async (prevRes, i, batch) => {
//   console.log(`Processing ITEM -->${i}`);
//   console.log(`Url--> ${batch[i].url}`);
//   const res = await browseItem(browser, batch[i].url);
//   return [...prevRes, res];
// }, items, async (item, i, batch) => {
//   console.log(`Saving item --> ${i}...`);
//   await db.collection('comundi').insertOne(item);
//   console.log(`item --> ${i} Saved`);
//   if (i >= items.length - 1) {
//     return false;
//   }
//   return true;
// }, async () => {
//   console.log('Done');
// }, 0, []);
//}, async (res) => {
// console.log(`Saved #${res.length} items`);
// return res;
//})


const itemBatches = _.chunk(items, 400);

Promise.all(itemBatches.map((items) => {
  return loopSequence(async (prevRes, i, batch) => {
    console.log(`Processing ITEM -->${i}`);
    console.log(`Url--> ${batch[i].url}`);
    try {
      const res = await browseItem(browser, batch[i].url);
      return res;
    } catch (e) {
      console.log(e);
      return -1;
    }
  }, items, async (item, i, items) => {
    if (item !== -1) {
      console.log(`Saving item --> ${i}...`);
      await db.collection('comundi-v2').insertOne(item);
      console.log(`item --> ${i} Saved`);
    } else {
      console.log('ERROR OCCURED (CATCHED)');
    }
    if (i >= items.length - 1) {
      return false;
    }
    return true;
  }, () => {
    console.log('DONE');
  }, 0, []);
}));

})();
