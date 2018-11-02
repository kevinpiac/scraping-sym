
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const puppeteer = require('puppeteer');
const _ = require('lodash');

const baseUrl = 'https://www.comundi.fr/';

const getText = (page, selector) => {
  return page.evaluate((selector) => {
    return document.querySelector(selector) ? document.querySelector(selector).innerText : null;
  }, selector);
};

const browseItem = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);

  const title = await getText(page, 'h1');
  const description = await getText(page, 'h2.small');
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
  // const level = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-level-of-difficulty.field--type-entity-reference.field--label-hidden.field__item > div');
  const duration = await getText(page, 'div.col-sm-8 > table > tbody > tr:nth-child(1) > th');
  // const location = await getText(page, 'body > main > div > div.group-content.layout-center.layout-center--mobile.clearfix > div > div.group-left > div > div > div > div.field.field--name-location-of-training.field--type-entity-reference.field--label-hidden.field__items > div > div');
  const public = await getText(page, '#public div')
  const goal = await getText(page, '#objectifs > div');
  const requirements = await getText(page, '#pre-requis > div');
  const priceHt = await page.evaluate(() => {
    const pattern = /^[0-9\s]{1,9}[,.]{1}[0-9]{0,2}\s{0,}€\sHT$/; // 995.00  € HT OR 2 245.00  € HT
    const res = [...document.querySelectorAll('.fiche td')].filter(e => pattern.test(e.innerText)).map(e => e.innerText)
    return (res.length ? res[0].split('€')[0].trim() : null);
  });
  let ref = await getText(page, '.ref')
  if (ref) {
    ref = ref.split(' ')[1].trim();
  }
  const pointsforts = await getText(page, '#points-forts');
  const program = await getText(page, '#programme+div');
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
  await db.collection('comundi').insertMany(result);
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

  const browser = await puppeteer.launch({ headless: true });

  const categories = await getAllCategoryLinksSequence(browser);
  console.log(`Got #${categories.length} categories`);

  // const categoriesBatches = _.chunk(categories, 10);
  // const subcategories = await loopBatches(categoriesBatches, async (categories) => {
  //  return loopSequence(async (prevRes, i, batch) => {
  //    console.log(`--> ${i}`);
  //    const res = await getAllSubCategoryLinksSequence(browser, batch[i]);
  //    return [...prevRes, ...res];
  //  }, categories, (res, i, batch) => {
  //    console.log(`Batch #${i}, done`);
  //    if (i >= batch.length - 1) {
  //      return false;
  //    }
  //    return true;
  //  }, (res) => {
  //    console.log(`Got #${res.length} subcategories`);
  //    return res;
  //  }, 0, []);
  // }, async (res) => {
  //  const flat = _.flatten(res);
  //  console.log(`ALL PROCESSED DONE, GOT #${flat.length} subcategories`);
  //  return flat;
  // });

  // Sample
  // const subcategories = [
  //   'https://www.comundi.fr/social-et-medico-social-1/formation-evaluation-et-demarches-qualite-1.html',
  //   'https://www.comundi.fr/social-et-medico-social-1/formation-expertise-metiers-1.html',
  // ];

  // const subcategoriesBatches = _.chunk(subcategories, 30);
  // const items = await loopBatches(subcategoriesBatches, async (subcategories) => {
  //   return loopSequence((async (prevRes, i, batch) => {
  //     console.log(`--> ${i}`);
  //     const res = await getAllItemsUrlFromPage(browser, batch[i]);
  //     return [...prevRes, ...res];
  //   }), subcategories, async (res, i, batch) => {
  //     console.log(`Batch #${i}, done`);
  //     if (i >= batch.length - 1) {
  //       return false;
  //     }
  //     return true;
  //   }, async (res) => {
  //     console.log(`Got #${res.length} items`);
  //     return res;
  //   }, 0, []);
  // }, async (res) => {
  //   const flat = _.flatten(res);
  //   console.log(`ALL PROCESSED DONE`);
  //   return flat;
  // });

  // Sample
  const items = [ 'https://www.comundi.fr/formation-evaluation-et-demarches-qualite/formation-mettre-en-place-une-evaluation-externe.html',
  'https://www.comundi.fr/formation-pilotage-strategique-et-management-des-etablissements/formation-piloter-un-projet-systemique-de-qualite-de-vie-au-travail-pour-son-etablissement.html'];

  console.log(items);
  console.log(`Got #${items.length} items`);

  const itemBatches = _.chunk(items, 100);
  await loopBatches(itemBatches, async (items) => {
    return loopSequence(async (prevRes, i, batch) => {
      console.log(`--> ${i}`);
      const res = await browseItem(browser, batch[i]);
      return [...prevRes, res];
    }, items, async (res, i, batch) => {
      if (i >= batch.length - 1) {
        return false;
      }
      return true;
    }, async (res) => {
       console.log(`Got #${res.length} items`);
       console.log(res);
       return res;
    }, 0, []);
  }, async (res) => {
    console.log(`Saved #${res.length} items`);
    return res;
  })

})();
